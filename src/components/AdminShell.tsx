import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import Footer from './Footer'

type AdminShellProps = {
  title: string
  description: string
  children: ReactNode
  status?: string | null
}

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition-all ${isActive ? 'bg-brand-500 text-white shadow-md' : 'border border-gray-600 bg-gray-900 text-gray-200 hover:bg-gray-700'}`

export default function AdminShell({ title, description, children, status }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-800 to-slate-900 flex flex-col">
      <header className="border-b border-gray-700 bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 shadow-sm backdrop-blur-sm bg-opacity-95 sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">EthioGlow Admin</p>
            <h1 className="mt-1 text-2xl font-serif font-bold text-white sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-300">{description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <NavLink to="/dashboard" end className={navLinkClassName}>
              Dashboard
            </NavLink>
            <NavLink to="/admin" end className={navLinkClassName}>
              Admin Home
            </NavLink>
            <NavLink to="/admin/analytics" end className={navLinkClassName}>
              Visitor Analytics
            </NavLink>
            <NavLink to="/admin/upload" end className={navLinkClassName}>
              Admin Upload
            </NavLink>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl grow px-4 py-8 sm:px-6 lg:px-8">
        {status && (
          <div
            className={`mb-6 rounded-lg p-4 text-sm ${
              status.toLowerCase().includes('error') ||
              status.toLowerCase().includes('failed') ||
              status.toLowerCase().includes('could not')
                ? 'border border-red-200 bg-red-50 text-red-800'
                : status.toLowerCase().includes('success') || status.toLowerCase().includes('uploaded')
                  ? 'border border-green-200 bg-green-50 text-green-800'
                  : 'border border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            {status}
          </div>
        )}

        {children}
      </main>

      <Footer />
    </div>
  )
}