import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Stripe from 'stripe'
import { createClerkClient, verifyToken } from '@clerk/backend'
import { createClient } from '@supabase/supabase-js'

const app = express()
const port = process.env.PORT || 8787
app.set('trust proxy', true)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

const normalizeNullableString = (value, maxLength = 255) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  return trimmed.slice(0, maxLength)
}

const normalizeIpAddress = (value) => {
  const normalized = normalizeNullableString(value, 128)

  if (!normalized) {
    return null
  }

  return normalized.replace(/^::ffff:/, '')
}

const getClientIpAddress = (req) => {
  const forwardedHeader = req.headers['x-forwarded-for']
  const forwardedValue = Array.isArray(forwardedHeader)
    ? forwardedHeader[0]
    : forwardedHeader
  const forwardedIp = normalizeIpAddress(forwardedValue?.split(',')[0] || '')

  if (forwardedIp) {
    return forwardedIp
  }

  return normalizeIpAddress(req.ip || '')
}

const isPrivateIpAddress = (ipAddress) => {
  if (!ipAddress) {
    return true
  }

  return (
    ipAddress === '127.0.0.1' ||
    ipAddress === '::1' ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ipAddress) ||
    ipAddress.startsWith('fc') ||
    ipAddress.startsWith('fd')
  )
}

const getTrafficSourceLabel = (rawSource) => {
  const source = normalizeNullableString(rawSource, 120)?.toLowerCase()

  if (!source) {
    return 'Direct'
  }

  const knownSources = [
    { label: 'TikTok', patterns: ['tiktok'] },
    { label: 'Google', patterns: ['google'] },
    { label: 'YouTube', patterns: ['youtube', 'youtu.be'] },
    { label: 'Instagram', patterns: ['instagram'] },
    { label: 'Facebook', patterns: ['facebook', 'fb.com'] },
    { label: 'X', patterns: ['twitter', 'x.com', 't.co'] },
    { label: 'Telegram', patterns: ['telegram', 't.me'] },
    { label: 'Reddit', patterns: ['reddit'] },
  ]

  for (const sourceEntry of knownSources) {
    if (sourceEntry.patterns.some((pattern) => source.includes(pattern))) {
      return sourceEntry.label
    }
  }

  return source
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const deriveTrafficSource = ({ utmSource, referrerUrl }) => {
  if (utmSource) {
    return getTrafficSourceLabel(utmSource)
  }

  const normalizedReferrer = normalizeNullableString(referrerUrl, 1024)

  if (!normalizedReferrer) {
    return 'Direct'
  }

  try {
    const hostname = new URL(normalizedReferrer).hostname.replace(/^www\./, '')
    return getTrafficSourceLabel(hostname)
  } catch {
    return getTrafficSourceLabel(normalizedReferrer)
  }
}

const getHeaderValue = (req, headerName, maxLength = 120) => {
  const rawValue = req.headers[headerName]
  const normalizedValue = Array.isArray(rawValue) ? rawValue[0] : rawValue
  const value = normalizeNullableString(normalizedValue, maxLength)

  if (value === 'XX') {
    return null
  }

  return value
}

const getGeoLocationFromHeaders = (req) => ({
  city:
    getHeaderValue(req, 'x-vercel-ip-city') ||
    getHeaderValue(req, 'x-city') ||
    getHeaderValue(req, 'cf-ipcity'),
  country:
    getHeaderValue(req, 'x-vercel-ip-country') ||
    getHeaderValue(req, 'x-country-code') ||
    getHeaderValue(req, 'cf-ipcountry'),
})

const getGeoLocationFromIpAddress = async (ipAddress) => {
  if (!ipAddress || isPrivateIpAddress(ipAddress)) {
    return { city: null, country: null }
  }

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ipAddress)}`, {
      signal: AbortSignal.timeout(2500),
    })

    if (!response.ok) {
      return { city: null, country: null }
    }

    const data = await response.json()

    if (!data?.success) {
      return { city: null, country: null }
    }

    return {
      city: normalizeNullableString(data.city, 120),
      country: normalizeNullableString(data.country, 120),
    }
  } catch {
    return { city: null, country: null }
  }
}

const resolveVisitorLocation = async (req) => {
  const headerLocation = getGeoLocationFromHeaders(req)

  if (headerLocation.city && headerLocation.country) {
    return headerLocation
  }

  const ipAddress = getClientIpAddress(req)
  const ipLocation = await getGeoLocationFromIpAddress(ipAddress)

  return {
    city: headerLocation.city || ipLocation.city,
    country: headerLocation.country || ipLocation.country,
  }
}

const getDeviceContextFromUserAgent = (req) => {
  const userAgent = normalizeNullableString(getHeaderValue(req, 'user-agent', 1024), 1024)

  if (!userAgent) {
    return {
      deviceType: 'Unknown',
      deviceOs: 'Unknown',
      browser: 'Unknown',
    }
  }

  const normalizedUserAgent = userAgent.toLowerCase()

  const deviceType = (() => {
    if (/ipad|tablet|playbook|silk/.test(normalizedUserAgent)) {
      return 'Tablet'
    }

    if (/mobile|iphone|ipod|android/.test(normalizedUserAgent)) {
      return 'Mobile'
    }

    return 'Desktop'
  })()

  const deviceOs = (() => {
    if (/iphone|ipad|ipod/.test(normalizedUserAgent)) {
      return 'iOS'
    }

    if (/android/.test(normalizedUserAgent)) {
      return 'Android'
    }

    if (/windows nt/.test(normalizedUserAgent)) {
      return 'Windows'
    }

    if (/mac os x|macintosh/.test(normalizedUserAgent)) {
      return 'macOS'
    }

    if (/linux/.test(normalizedUserAgent)) {
      return 'Linux'
    }

    return 'Unknown'
  })()

  const browser = (() => {
    if (/tiktok/.test(normalizedUserAgent)) {
      return 'TikTok Browser'
    }

    if (/instagram/.test(normalizedUserAgent)) {
      return 'Instagram Browser'
    }

    if (/fbav|fban|facebook/.test(normalizedUserAgent)) {
      return 'Facebook Browser'
    }

    if (/edg\//.test(normalizedUserAgent)) {
      return 'Edge'
    }

    if (/opr\//.test(normalizedUserAgent) || /opera/.test(normalizedUserAgent)) {
      return 'Opera'
    }

    if (/crios\//.test(normalizedUserAgent) || /chrome\//.test(normalizedUserAgent)) {
      return 'Chrome'
    }

    if (/firefox\//.test(normalizedUserAgent)) {
      return 'Firefox'
    }

    if (/safari\//.test(normalizedUserAgent) && !/chrome\//.test(normalizedUserAgent) && !/crios\//.test(normalizedUserAgent)) {
      return 'Safari'
    }

    return 'Unknown'
  })()

  return { deviceType, deviceOs, browser }
}

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

const getAdminUserFromAuthorization = async (authHeader) => {
  const user = await getClerkUserFromAuthorization(authHeader)
  const profile = await getProfileById(user.id)

  if (profile.role !== 'admin') {
    const error = new Error('Admin access required')
    error.statusCode = 403
    throw error
  }

  return { user, profile }
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

app.post('/api/analytics/track-visit', async (req, res) => {
  try {
    const pagePath = normalizeNullableString(req.body?.pagePath, 300) || '/'
    const referrerUrl = normalizeNullableString(req.body?.referrer, 1024)
    const utmSource = normalizeNullableString(req.body?.utmSource, 120)
    const source = deriveTrafficSource({ utmSource, referrerUrl })
    const location = await resolveVisitorLocation(req)
    const deviceContext = getDeviceContextFromUserAgent(req)

    const { error } = await supabaseAdmin.from('visitor_events').insert({
      page_path: pagePath,
      source,
      referrer_url: referrerUrl,
      city: location.city,
      country: location.country,
      device_type: deviceContext.deviceType,
      device_os: deviceContext.deviceOs,
      browser: deviceContext.browser,
    })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(201).json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Could not track visitor visit' })
  }
})

app.get('/api/admin/visitor-events', async (req, res) => {
  try {
    await getAdminUserFromAuthorization(req.headers.authorization)

    const rawLimit = Number.parseInt(String(req.query.limit || '100'), 10)
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, 500)
      : 100

    const { data, error } = await supabaseAdmin
      .from('visitor_events')
      .select('id, page_path, source, referrer_url, city, country, device_type, device_os, browser, visited_at')
      .order('visited_at', { ascending: false })
      .limit(limit)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true, events: data || [] })
  } catch (err) {
    console.error(err)

    if (err?.statusCode === 403) {
      return res.status(403).json({ error: err.message })
    }

    return res.status(500).json({ error: 'Could not load visitor events' })
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
