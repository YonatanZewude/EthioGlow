import { createClient } from '@supabase/supabase-js'
import type { AdminUser, VisitorEventsPage } from '../types'

type SyncedProfile = {
  id: string
  email: string | null
  role: 'admin' | 'paying_user'
  subscription_status: string
  subscription_active: boolean
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check .env.local')
}

export const createSupabaseClient = (token?: string) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers,
    },
  })
}

export const syncProfileWithBackend = async (token: string) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/auth/sync-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Could not sync profile')
  }

  return data.profile as SyncedProfile
}

export const checkSessionConflict = async (sessionId: string) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/auth/session-conflict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Could not check active sessions')
  }

  return {
    hasOtherSessions: Boolean(data.hasOtherSessions),
    otherSessionCount: Number(data.otherSessionCount || 0),
  }
}

export const resolveSessionConflict = async (sessionId: string, action: 'replace' | 'cancel') => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/auth/resolve-session-conflict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId, action }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Could not resolve active sessions')
  }

  return data as { ok: true; revokedSessionCount?: number }
}

export const deactivateAccount = async (token: string) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/auth/deactivate-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Could not deactivate account')
  }

  return data.profile as SyncedProfile
}

export const createCheckoutSession = async (token: string) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.url) {
    throw new Error(data.error || 'Checkout failed')
  }

  return data.url as string
}

export const syncCheckoutSessionWithBackend = async (token: string, sessionId: string) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/stripe/sync-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Could not sync checkout session')
  }

  return data.profile as SyncedProfile
}

export const createBillingPortalSession = async (token: string) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/stripe/create-billing-portal-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.url) {
    throw new Error(data.error || 'Could not open billing portal')
  }

  return data.url as string
}

export const trackVisitorVisit = async (payload: {
  pagePath: string
  referrer?: string | null
  utmSource?: string | null
}) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/analytics/track-visit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Could not track visitor visit')
  }
}

export const getVisitorEvents = async (token: string, options?: { limit?: number; page?: number }) => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const limit = options?.limit ?? 100
  const page = options?.page ?? 1

  const response = await fetch(`${backendUrl}/api/admin/visitor-events?limit=${limit}&page=${page}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Could not load visitor events')
  }

  return {
    events: data.events || [],
    pagination: data.pagination || {
      page,
      limit,
      total: 0,
      totalPages: 1,
    },
  } as VisitorEventsPage
}

export const getAdminUsers = async (token: string, subscription: 'all' | 'active' = 'all') => {
  const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

  if (!backendUrl) {
    throw new Error('Backend URL is missing.')
  }

  const response = await fetch(`${backendUrl}/api/admin/users?subscription=${subscription}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Could not load admin users')
  }

  return (data.users || []) as AdminUser[]
}
