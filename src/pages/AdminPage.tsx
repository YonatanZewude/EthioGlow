import { Link } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { useAdminSession } from '../hooks/useAdminSession'

const adminCards = [
  {
    title: 'Visitor Analytics',
    description: 'See where visitors came from, when they visited, and what device they used.',
    href: '/admin/analytics',
    eyebrow: 'Insights',
    accent: 'from-cyan-500/30 via-sky-500/15 to-transparent',
    metric: '100 latest visits',
  },
  {
    title: 'Admin Upload',
    description: 'Upload new images and videos without keeping the form inside the dashboard.',
    href: '/admin/upload',
    eyebrow: 'Publishing',
    accent: 'from-fuchsia-500/30 via-purple-500/15 to-transparent',
    metric: 'Images and videos',
  },
  {
    title: 'Users',
    description: 'See all users and quickly filter down to members with an active subscription.',
    href: '/admin/users',
    eyebrow: 'Members',
    accent: 'from-emerald-500/30 via-teal-500/15 to-transparent',
    metric: 'All and active',
  },
  {
    title: 'Open Dashboard',
    description: 'Admins still keep access to the member dashboard for browsing and content controls.',
    href: '/dashboard',
    eyebrow: 'Workspace',
    accent: 'from-amber-400/30 via-orange-400/15 to-transparent',
    metric: 'Member view',
  },
]

export default function AdminPage() {
  const { isAdmin, isLoaded, loadingProfile, status } = useAdminSession()

  if (!isLoaded || loadingProfile) {
    return (
      <AdminShell title="Admin Home" description="Loading admin tools..." status={status}>
        <div className="rounded-2xl border border-gray-700 bg-gray-800 p-8 text-center text-gray-300">
          Preparing admin access...
        </div>
      </AdminShell>
    )
  }

  if (!isAdmin) {
    return (
      <AdminShell title="Admin Home" description="This area is only available to admins." status={status}>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-100">
          You do not have permission to open the admin pages.
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title="Admin Home"
      description="Admin tools now live outside the dashboard. Use these pages for analytics and uploads while keeping dashboard access for normal browsing."
      status={status}
    >
      <section className="relative overflow-hidden rounded-4xl border border-white/10 bg-white/5 px-6 py-7 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:px-8 sm:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.18),transparent_30%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div>
            <div className="inline-flex rounded-full border border-brand-400/30 bg-brand-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">
              Control Center
            </div>
            <h2 className="mt-5 max-w-3xl text-4xl font-serif font-bold leading-tight text-white sm:text-5xl">
              A cleaner home for admin work.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
              Analytics, uploads, and dashboard access now live in clearer lanes. The page is built to get you to the right tool fast instead of feeling like an empty holding screen.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pages</p>
              <p className="mt-3 text-3xl font-bold text-white">4</p>
              <p className="mt-2 text-sm text-slate-300">Dedicated admin destinations</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Access</p>
              <p className="mt-3 text-3xl font-bold text-white">Admin</p>
              <p className="mt-2 text-sm text-slate-300">Dashboard access remains intact</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Flow</p>
              <p className="mt-3 text-3xl font-bold text-white">Faster</p>
              <p className="mt-2 text-sm text-slate-300">Less clutter inside the member dashboard</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:col-span-1">
          {adminCards.map((card) => (
            <Link
              key={card.href}
              to={card.href}
              className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/65 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-1.5 hover:border-white/20 hover:shadow-[0_32px_80px_rgba(0,0,0,0.38)]"
            >
              <div className={`absolute inset-x-0 top-0 h-28 bg-linear-to-br ${card.accent} opacity-90 transition-transform duration-300 group-hover:scale-110`} />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{card.eyebrow}</p>
                    <h2 className="mt-3 text-2xl font-serif font-bold text-white">{card.title}</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                    {card.metric}
                  </span>
                </div>
                <p className="mt-5 text-sm leading-7 text-slate-300">{card.description}</p>
                <div className="mt-8 flex items-center justify-between">
                  <span className="text-sm font-semibold text-brand-300 transition-colors group-hover:text-white">Open page</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-all group-hover:border-brand-400/40 group-hover:bg-brand-500/20">
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <aside className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Quick Focus</p>
          <h3 className="mt-4 text-2xl font-serif font-bold text-white">What this admin area is for</h3>
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
              <p className="text-sm font-semibold text-cyan-200">Visitor Analytics</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Track source, city, country, browser, device type, and visit timing in one place.</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="text-sm font-semibold text-emerald-200">Users</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Review the full member list and switch instantly to active subscription users only.</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-400/15 bg-fuchsia-400/5 p-4">
              <p className="text-sm font-semibold text-fuchsia-200">Admin Upload</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Publish new content without pushing upload controls into the browsing experience.</p>
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/5 p-4">
              <p className="text-sm font-semibold text-amber-100">Dashboard</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Keep the normal premium browsing flow available while admin tools stay organized outside it.</p>
            </div>
          </div>
        </aside>
      </section>
    </AdminShell>
  )
}