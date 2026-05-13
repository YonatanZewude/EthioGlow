import { Link } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { useAdminSession } from '../hooks/useAdminSession'

const adminCards = [
  {
    title: 'Visitor Analytics',
    description: 'See where visitors came from, when they visited, and what device they used.',
    href: '/admin/analytics',
  },
  {
    title: 'Admin Upload',
    description: 'Upload new images and videos without keeping the form inside the dashboard.',
    href: '/admin/upload',
  },
  {
    title: 'Open Dashboard',
    description: 'Admins still keep access to the member dashboard for browsing and content controls.',
    href: '/dashboard',
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {adminCards.map((card) => (
          <Link
            key={card.href}
            to={card.href}
            className="rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-lg transition-all hover:-translate-y-1 hover:border-brand-500/60 hover:shadow-xl"
          >
            <h2 className="text-xl font-serif font-bold text-white">{card.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-300">{card.description}</p>
            <span className="mt-5 inline-flex text-sm font-semibold text-brand-400">Open page</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  )
}