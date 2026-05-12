import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Stripe from 'stripe'
import { createClerkClient, verifyToken } from '@clerk/backend'
import { createClient } from '@supabase/supabase-js'

const app = express()
const port = process.env.PORT || 8787

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Not allowed by CORS'))
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
  }),
)

const updateUserSubscription = async (userId, status, subscriptionId) => {
  const subscriptionActive = ACTIVE_STATUSES.has(status)

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: status,
      subscription_active: subscriptionActive,
      stripe_subscription_id: subscriptionId,
    })
    .eq('id', userId)

  if (error) {
    throw error
  }
}

const mapCustomerToUser = async (customerId) => {
  const { data, error } = await supabaseAdmin
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.user_id || null
}

const getClerkUserFromAuthorization = async (authHeader) => {
  const token = (authHeader || '').replace('Bearer ', '')

  if (!token) {
    throw new Error('Missing bearer token')
  }

  const payload = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
  })

  if (!payload?.sub) {
    throw new Error('Invalid Clerk token payload')
  }

  const user = await clerkClient.users.getUser(payload.sub)
  return {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress || null,
  }
}

const ensureProfile = async (userId, email) => {
  const { error } = await supabaseAdmin.from('profiles').upsert(
    {
      id: userId,
      email,
    },
    { onConflict: 'id' },
  )

  if (error) {
    throw error
  }

  await clerkClient.users.updateUser(userId, { deleteSelfEnabled: false })
}

const upsertStripeCustomer = async (userId, customerId) => {
  const { error } = await supabaseAdmin.from('stripe_customers').upsert(
    {
      user_id: userId,
      stripe_customer_id: String(customerId),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    throw error
  }
}

const getProfileById = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, subscription_status, subscription_active')
    .eq('id', userId)
    .single()

  if (error) {
    throw error
  }

  return data
}

const getProfileSubscriptionDetails = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return {
    stripeSubscriptionId: data?.stripe_subscription_id || null,
  }
}

const getStripeCustomerIdForUser = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.stripe_customer_id || null
}

const deleteStripeCustomerMapping = async (userId) => {
  const { error } = await supabaseAdmin
    .from('stripe_customers')
    .delete()
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}

const markProfileInactive = async (userId) => {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: 'inactive',
      subscription_active: false,
      stripe_subscription_id: null,
    })
    .eq('id', userId)

  if (error) {
    throw error
  }
}

const cancelStripeBillingForUser = async (userId) => {
  const { stripeSubscriptionId } = await getProfileSubscriptionDetails(userId)
  const customerId = await getStripeCustomerIdForUser(userId)

  const subscriptionIds = new Set()

  if (stripeSubscriptionId) {
    subscriptionIds.add(String(stripeSubscriptionId))
  }

  if (customerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    })

    for (const subscription of subscriptions.data) {
      if (subscription.status !== 'canceled' && subscription.status !== 'incomplete_expired') {
        subscriptionIds.add(subscription.id)
      }
    }
  }

  await Promise.all(
    Array.from(subscriptionIds).map(async (subscriptionId) => {
      await stripe.subscriptions.cancel(subscriptionId)
    }),
  )

  if (customerId) {
    await stripe.customers.del(customerId)
    await deleteStripeCustomerMapping(userId)
  }

  await markProfileInactive(userId)
}

const getOtherActiveSessions = async (sessionId) => {
  const session = await clerkClient.sessions.getSession(sessionId)

  if (!session?.userId) {
    throw new Error('Could not find a valid Clerk session')
  }

  const sessionResponse = await clerkClient.sessions.getSessionList({
    userId: session.userId,
    status: 'active',
    limit: 100,
  })

  const activeSessions = Array.isArray(sessionResponse?.data)
    ? sessionResponse.data
    : []

  return activeSessions.filter((activeSession) => activeSession.id !== sessionId)
}

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature']

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' })
    }

    let event

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      )
    } catch (err) {
      return res.status(400).json({ error: `Webhook error: ${err.message}` })
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        const userId = session.metadata?.clerk_user_id
        const customerId = session.customer

        if (userId && customerId) {
          await upsertStripeCustomer(userId, customerId)
        }

        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            String(session.subscription),
          )
          await updateUserSubscription(
            userId,
            subscription.status,
            String(subscription.id),
          )
        }
      }

      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        const subscription = event.data.object
        const customerId = String(subscription.customer)
        const userId = await mapCustomerToUser(customerId)

        if (userId) {
          await updateUserSubscription(
            userId,
            subscription.status,
            String(subscription.id),
          )
        }
      }

      return res.status(200).json({ received: true })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to process webhook' })
    }
  },
)

app.use(express.json())

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.post('/api/auth/sync-profile', async (req, res) => {
  try {
    const user = await getClerkUserFromAuthorization(req.headers.authorization)
    await ensureProfile(user.id, user.email)
    const profile = await getProfileById(user.id)

    return res.status(200).json({ ok: true, userId: user.id, profile })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Could not sync profile' })
  }
})

app.post('/api/auth/deactivate-account', async (req, res) => {
  try {
    const user = await getClerkUserFromAuthorization(req.headers.authorization)

    await cancelStripeBillingForUser(user.id)
    const profile = await getProfileById(user.id)

    return res.status(200).json({ ok: true, profile })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Could not deactivate account' })
  }
})

app.post('/api/auth/session-conflict', async (req, res) => {
  try {
    const { sessionId } = req.body || {}

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' })
    }

    const otherSessions = await getOtherActiveSessions(sessionId)

    return res.status(200).json({
      ok: true,
      hasOtherSessions: otherSessions.length > 0,
      otherSessionCount: otherSessions.length,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Could not check active sessions' })
  }
})

app.post('/api/auth/resolve-session-conflict', async (req, res) => {
  try {
    const { sessionId, action } = req.body || {}

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' })
    }

    if (action !== 'replace' && action !== 'cancel') {
      return res.status(400).json({ error: 'Invalid session conflict action' })
    }

    if (action === 'cancel') {
      await clerkClient.sessions.revokeSession(sessionId)
      return res.status(200).json({ ok: true })
    }

    const otherSessions = await getOtherActiveSessions(sessionId)
    await Promise.all(otherSessions.map((session) => clerkClient.sessions.revokeSession(session.id)))

    return res.status(200).json({ ok: true, revokedSessionCount: otherSessions.length })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Could not resolve active sessions' })
  }
})

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const user = await getClerkUserFromAuthorization(req.headers.authorization)
    await ensureProfile(user.id, user.email)

    const { data: existingCustomer, error: customerError } = await supabaseAdmin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (customerError) {
      return res.status(500).json({ error: customerError.message })
    }

    let customerId = existingCustomer?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          clerk_user_id: user.id,
        },
      })
      customerId = customer.id

      await supabaseAdmin.from('stripe_customers').upsert(
        {
          user_id: user.id,
          stripe_customer_id: customer.id,
        },
        { onConflict: 'user_id' },
      )
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/checkout/cancelled`,
      metadata: {
        clerk_user_id: user.id,
      },
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Could not create checkout session' })
  }
})

app.post('/api/stripe/sync-checkout-session', async (req, res) => {
  try {
    const user = await getClerkUserFromAuthorization(req.headers.authorization)
    const sessionId = req.body?.sessionId

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' })
    }

    const session = await stripe.checkout.sessions.retrieve(String(sessionId))

    if (session.metadata?.clerk_user_id !== user.id) {
      return res.status(403).json({ error: 'Checkout session does not belong to this user' })
    }

    if (session.customer) {
      await upsertStripeCustomer(user.id, session.customer)
    }

    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(String(session.subscription))
      await updateUserSubscription(user.id, subscription.status, String(subscription.id))
    }

    const profile = await getProfileById(user.id)
    return res.status(200).json({ ok: true, profile })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Could not sync checkout session' })
  }
})

app.post('/api/stripe/create-billing-portal-session', async (req, res) => {
  try {
    const user = await getClerkUserFromAuthorization(req.headers.authorization)
    const customerId = await getStripeCustomerIdForUser(user.id)

    if (!customerId) {
      return res.status(404).json({ error: 'No Stripe customer found for this user' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.APP_URL}/dashboard`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Could not create billing portal session' })
  }
})

app.listen(port, () => {
  console.log(`Stripe backend listening on ${port}`)
})
