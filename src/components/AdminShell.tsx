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
  `rounded-full px-4 py-2.5 text-sm font-medium transition-all ${isActive ? 'border border-brand-400/50 bg-brand-500/90 text-white shadow-[0_12px_30px_rgba(168,85,247,0.25)]' : 'border border-white/10 bg-white/5 text-gray-200 hover:border-white/20 hover:bg-white/10'}`

export default function AdminShell({ title, description, children, status }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.18),_transparent_28%),linear-gradient(180deg,_#111827_0%,_#162033_45%,_#0f172a_100%)] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/65 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-300/80">EthioGlow Admin</p>
            <h1 className="mt-2 text-3xl font-serif font-bold text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">{description}</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <NavLink to="/dashboard" end className={navLinkClassName}>
              Dashboard
            </NavLink>
            <NavLink to="/admin" end className={navLinkClassName}>
              Admin Home
            </NavLink>
            <NavLink to="/admin/analytics" end className={navLinkClassName}>
              Visitor Analytics
            </NavLink>
            <NavLink to="/admin/users" end className={navLinkClassName}>
              Users
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
            className={`mb-6 rounded-2xl p-4 text-sm shadow-lg ${
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