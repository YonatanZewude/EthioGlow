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
          await supabaseAdmin.from('stripe_customers').upsert(
            {
              user_id: userId,
              stripe_customer_id: String(customerId),
            },
            { onConflict: 'user_id' },
          )
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
      success_url: `${process.env.APP_URL}/?checkout=success`,
      cancel_url: `${process.env.APP_URL}/?checkout=cancelled`,
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

app.listen(port, () => {
  console.log(`Stripe backend listening on ${port}`)
})
