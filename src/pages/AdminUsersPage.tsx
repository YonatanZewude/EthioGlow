import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminShell from '../components/AdminShell'
import { useAdminSession } from '../hooks/useAdminSession'
import { getAdminUsers } from '../lib/supabase'
import type { AdminUser } from '../types'

const formatJoinedDate = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function AdminUsersPage() {
  const { getToken, isAdmin, isLoaded, loadingProfile, setStatus, status } = useAdminSession()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [subscriptionFilter, setSubscriptionFilter] = useState<'all' | 'active'>('all')

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([])
      return
    }

    setLoading(true)

    try {
      const clerkToken = await getToken()

      if (!clerkToken) {
        setStatus('Could not get Clerk token for admin users.')
        return
      }

      const nextUsers = await getAdminUsers(clerkToken, subscriptionFilter)
      setUsers(nextUsers)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load admin users.'
      setStatus(message)
    } finally {
      setLoading(false)
    }
  }, [getToken, isAdmin, setStatus, subscriptionFilter])

  useEffect(() => {
    if (!isLoaded || loadingProfile || !isAdmin) {
      return
    }

    void loadUsers()
  }, [isAdmin, isLoaded, loadUsers, loadingProfile])

  const activeUsersCount = useMemo(
    () => users.filter((user) => user.subscription_active).length,
    [users],
  )

  if (!isLoaded || loadingProfile) {
    return (
      <AdminShell title="Users" description="Loading users..." status={status}>
        <div className="rounded-2xl border border-gray-700 bg-gray-800 p-8 text-center text-gray-300">
          Preparing user list...
        </div>
      </AdminShell>
    )
  }

  if (!isAdmin) {
    return (
      <AdminShell title="Users" description="This area is only available to admins." status={status}>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-100">
          You do not have permission to open the users page.
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title="Users"
      description="See all users and quickly sort down to the ones with an active subscription."
      status={status}
    >
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[0.95fr_2.05fr]">
        <div className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Members Overview</p>
          <h2 className="mt-4 text-2xl font-serif font-bold text-white">User filters</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Switch between all registered users and only those who currently have an active subscription.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Visible users</p>
              <p className="mt-3 text-3xl font-bold text-white">{users.length}</p>
              <p className="mt-2 text-sm text-slate-300">
                {subscriptionFilter === 'active' ? 'Active subscribers only' : 'All users in profiles'}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Active in current view</p>
              <p className="mt-3 text-3xl font-bold text-white">{activeUsersCount}</p>
              <p className="mt-2 text-sm text-slate-300">Users with `subscription_active = true`</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSubscriptionFilter('all')}
              className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${subscriptionFilter === 'all' ? 'border border-brand-400/50 bg-brand-500/90 text-white shadow-[0_12px_30px_rgba(168,85,247,0.25)]' : 'border border-white/10 bg-white/5 text-gray-200 hover:border-white/20 hover:bg-white/10'}`}
            >
              All users
            </button>
            <button
              type="button"
              onClick={() => setSubscriptionFilter('active')}
              className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all ${subscriptionFilter === 'active' ? 'border border-emerald-400/40 bg-emerald-500/80 text-white shadow-[0_12px_30px_rgba(16,185,129,0.22)]' : 'border border-white/10 bg-white/5 text-gray-200 hover:border-white/20 hover:bg-white/10'}`}
            >
              Active subscription
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadUsers()}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-200 transition-all hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/60 shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">User Directory</p>
              <h2 className="mt-2 text-2xl font-serif font-bold text-white">Profiles</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              Filter: {subscriptionFilter === 'active' ? 'Active subscription' : 'All users'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Subscription</th>
                  <th className="px-6 py-4 font-medium">Active</th>
                  <th className="px-6 py-4 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.length ? (
                  users.map((user) => (
                    <tr key={user.id} className="align-top transition-colors hover:bg-white/3">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{user.email || 'No email'}</p>
                          <p className="mt-1 text-xs text-slate-400">{user.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.role === 'admin' ? 'border border-amber-300/20 bg-amber-300/10 text-amber-100' : 'border border-slate-400/15 bg-slate-400/10 text-slate-200'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-300">{user.subscription_status}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.subscription_active ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border border-rose-300/20 bg-rose-300/10 text-rose-200'}`}>
                          {user.subscription_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-300">{formatJoinedDate(user.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      {loading ? 'Loading users...' : 'No users found for this filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminShell>
  )
}