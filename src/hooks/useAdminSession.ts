import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { createSupabaseClient, syncProfileWithBackend } from '../lib/supabase'
import type { Profile } from '../types'

export const useAdminSession = () => {
  const { userId, getToken, isLoaded } = useAuth()
  const [supabaseToken, setSupabaseToken] = useState<string | undefined>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  const supabase = useMemo(() => createSupabaseClient(supabaseToken), [supabaseToken])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (!userId) {
      setSupabaseToken(undefined)
      setProfile(null)
      setLoadingProfile(false)
      return
    }

    let isActive = true

    const syncSession = async () => {
      setLoadingProfile(true)
      setStatus(null)

      const clerkToken = await getToken()

      if (!clerkToken) {
        if (isActive) {
          setStatus('Could not get Clerk token.')
          setLoadingProfile(false)
        }
        return
      }

      let tokenFromTemplate: string | null = null

      try {
        tokenFromTemplate = await getToken({ template: 'supabase' })
      } catch (error) {
        console.warn('Missing Clerk JWT template "supabase", falling back to the default session token.', error)
      }

      const token = tokenFromTemplate || clerkToken
      const nextSupabase = createSupabaseClient(token)

      try {
        await syncProfileWithBackend(clerkToken)
      } catch (error) {
        if (isActive) {
          const message = error instanceof Error ? error.message : 'Could not sync profile.'
          setStatus(message)
          setLoadingProfile(false)
        }
        return
      }

      const { data, error } = await nextSupabase
        .from('profiles')
        .select('id, email, role, subscription_status, subscription_active')
        .eq('id', userId)
        .single()

      if (!isActive) {
        return
      }

      if (error) {
        setStatus(error.message)
        setLoadingProfile(false)
        return
      }

      setSupabaseToken(token)
      setProfile(data as Profile)
      setLoadingProfile(false)
    }

    void syncSession()

    return () => {
      isActive = false
    }
  }, [getToken, isLoaded, userId])

  return {
    getToken,
    isAdmin: profile?.role === 'admin',
    isLoaded,
    loadingProfile,
    profile,
    setStatus,
    status,
    supabase,
    supabaseToken,
    userId,
  }
}