import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminShell from '../components/AdminShell'
import { useAdminSession } from '../hooks/useAdminSession'
import { getVisitorEvents } from '../lib/supabase'
import type { VisitorEvent } from '../types'

const VISITOR_EVENTS_PER_PAGE = 12

const buildTopCounts = (values: Array<string | null | undefined>, fallbackLabel: string) => {
  const counts = new Map<string, number>()

  for (const value of values) {
    const key = value?.trim() || fallbackLabel
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])
}

const formatVisitTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export default function AdminAnalyticsPage() {
  const { getToken, isAdmin, isLoaded, loadingProfile, setStatus, status } = useAdminSession()
  const [visitorEvents, setVisitorEvents] = useState<VisitorEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalEvents, setTotalEvents] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const loadVisitorAnalytics = useCallback(async () => {
    if (!isAdmin) {
      setVisitorEvents([])
      setTotalEvents(0)
      setTotalPages(1)
      return
    }

    setLoading(true)

    try {
      const clerkToken = await getToken()

      if (!clerkToken) {
        setStatus('Could not get Clerk token for visitor analytics.')
        return
      }

      const response = await getVisitorEvents(clerkToken, {
        limit: VISITOR_EVENTS_PER_PAGE,
        page: currentPage,
      })
      setVisitorEvents(response.events)
      setTotalEvents(response.pagination.total)
      setTotalPages(response.pagination.totalPages)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load visitor analytics.'
      setStatus(message)
    } finally {
      setLoading(false)
    }
  }, [currentPage, getToken, isAdmin, setStatus])

  useEffect(() => {
    if (!isLoaded || loadingProfile || !isAdmin) {
      return
    }

    void loadVisitorAnalytics()
  }, [isAdmin, isLoaded, loadVisitorAnalytics, loadingProfile])

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) {
      return
    }

    setCurrentPage(nextPage)
  }

  const topVisitorSources = useMemo(
    () => buildTopCounts(visitorEvents.map((event) => event.source), 'Direct').slice(0, 5),
    [visitorEvents],
  )

  const topVisitorCountries = useMemo(
    () => buildTopCounts(visitorEvents.map((event) => event.country), 'Unknown').slice(0, 5),
    [visitorEvents],
  )

  const topVisitorCities = useMemo(
    () => buildTopCounts(visitorEvents.map((event) => event.city), 'Unknown').slice(0, 5),
    [visitorEvents],
  )

  const topVisitorDevices = useMemo(
    () =>
      buildTopCounts(
        visitorEvents.map(
          (event) => `${event.device_type || 'Unknown'} | ${event.device_os || 'Unknown'} | ${event.browser || 'Unknown'}`,
        ),
        'Unknown | Unknown | Unknown',
      ).slice(0, 5),
    [visitorEvents],
  )

  const topVisitorSource = topVisitorSources[0]?.[0] || 'Direct'
  const topVisitorCountry = topVisitorCountries[0]?.[0] || 'Unknown'
  const topVisitorCity = topVisitorCities[0]?.[0] || 'Unknown'
  const topVisitorDevice = topVisitorDevices[0]?.[0] || 'Unknown | Unknown | Unknown'

  if (!isLoaded || loadingProfile) {
    return (
      <AdminShell title="Visitor Analytics" description="Loading analytics..." status={status}>
        <div className="rounded-2xl border border-gray-700 bg-gray-800 p-8 text-center text-gray-300">
          Preparing analytics...
        </div>
      </AdminShell>
    )
  }

  if (!isAdmin) {
    return (
      <AdminShell title="Visitor Analytics" description="This area is only available to admins." status={status}>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-100">
          You do not have permission to open visitor analytics.
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title="Visitor Analytics"
      description="Recent visits with country, city, device, visit time, and traffic source."
      status={status}
    >
      <div className="rounded-2xl border-2 border-gray-700 bg-gray-800 p-8 shadow-lg">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-serif font-bold text-white">Latest Visitor Data</h2>
            <p className="mt-2 text-sm text-gray-300">This page now lives outside the dashboard so analytics has its own admin view.</p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadVisitorAnalytics()}
            className="rounded-lg bg-gray-700 px-4 py-2 text-white transition-all hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh analytics'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Recent visits</p>
            <p className="mt-3 text-3xl font-bold text-white">{totalEvents}</p>
            <p className="mt-2 text-sm text-blue-100/80">All tracked homepage visits</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Top country</p>
            <p className="mt-3 text-2xl font-bold text-white">{topVisitorCountry}</p>
            <p className="mt-2 text-sm text-emerald-100/80">Most common visitor country</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Top city</p>
            <p className="mt-3 text-2xl font-bold text-white">{topVisitorCity}</p>
            <p className="mt-2 text-sm text-amber-100/80">Most common visitor city</p>
          </div>
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-200">Top source</p>
            <p className="mt-3 text-2xl font-bold text-white">{topVisitorSource}</p>
            <p className="mt-2 text-sm text-purple-100/80">Where visitors found the site</p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Top device</p>
            <p className="mt-3 text-xl font-bold text-white">{topVisitorDevice}</p>
            <p className="mt-2 text-sm text-cyan-100/80">Device type, OS, and browser</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-gray-700 bg-gray-900/50 p-5">
            <h3 className="text-lg font-semibold text-white">Top traffic sources</h3>
            <div className="mt-4 space-y-3">
              {topVisitorSources.length ? (
                topVisitorSources.map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-gray-800/70 px-4 py-3 text-sm text-gray-200">
                    <span>{label}</span>
                    <span className="font-semibold text-white">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No source data yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-700 bg-gray-900/50 p-5">
            <h3 className="text-lg font-semibold text-white">Top locations</h3>
            <div className="mt-4 space-y-3">
              {topVisitorCountries.length ? (
                topVisitorCountries.map(([country, count]) => (
                  <div key={country} className="flex items-center justify-between rounded-xl bg-gray-800/70 px-4 py-3 text-sm text-gray-200">
                    <span>{country}</span>
                    <span className="font-semibold text-white">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No location data yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-700 bg-gray-900/50 p-5">
            <h3 className="text-lg font-semibold text-white">Top devices</h3>
            <div className="mt-4 space-y-3">
              {topVisitorDevices.length ? (
                topVisitorDevices.map(([device, count]) => (
                  <div key={device} className="flex items-center justify-between rounded-xl bg-gray-800/70 px-4 py-3 text-sm text-gray-200">
                    <span>{device}</span>
                    <span className="font-semibold text-white">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No device data yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-700 bg-gray-900/50">
          <table className="min-w-full divide-y divide-gray-700 text-left text-sm text-gray-200">
            <thead className="bg-gray-900/80 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Device</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Referrer</th>
                <th className="px-4 py-3 font-medium">Page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {visitorEvents.length ? (
                visitorEvents.map((event) => (
                  <tr key={event.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3">{formatVisitTime(event.visited_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{event.country || 'Unknown'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{event.city || 'Unknown'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{`${event.device_type || 'Unknown'} | ${event.device_os || 'Unknown'} | ${event.browser || 'Unknown'}`}</td>
                    <td className="whitespace-nowrap px-4 py-3">{event.source || 'Direct'}</td>
                    <td className="max-w-xs break-all px-4 py-3 text-gray-400">{event.referrer_url || 'Direct / none'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-400">{event.page_path}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    No visitor analytics have been recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-300">
          <p>
            Showing {visitorEvents.length} visitors on page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={currentPage === 1 || loading}
              onClick={() => handlePageChange(currentPage - 1)}
              className="rounded-full border border-gray-600 bg-gray-900 px-4 py-2 font-medium text-gray-200 transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <div className="rounded-full border border-gray-700 bg-gray-800 px-4 py-2 font-medium text-white">
              {currentPage} / {totalPages}
            </div>
            <button
              type="button"
              disabled={currentPage === totalPages || loading}
              onClick={() => handlePageChange(currentPage + 1)}
              className="rounded-full border border-gray-600 bg-gray-900 px-4 py-2 font-medium text-gray-200 transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}