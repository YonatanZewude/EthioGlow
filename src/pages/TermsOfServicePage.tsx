import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

const termsSections = [
  {
    title: 'Eligibility',
    body:
      'EthioGlow is intended only for adults who meet the legal age requirement in their location. By using the service, you confirm that you are legally permitted to access the platform and its members-only content.',
  },
  {
    title: 'Account Responsibility',
    body:
      'You are responsible for keeping your login credentials secure, for all activity that occurs under your account, and for providing accurate registration and billing information. You may not share access in violation of the platform rules.',
  },
  {
    title: 'Subscriptions And Billing',
    body:
      'Paid access is offered on a subscription basis. Billing, renewals, cancellations, and payment processing may be handled through approved third-party providers. Access may be restricted if a payment fails, is reversed, or is canceled.',
  },
  {
    title: 'Access Rules',
    body:
      'Your access to premium material depends on an active account status and a valid membership when required. We may suspend, limit, or deactivate access to protect the platform, enforce billing rules, or respond to misuse, fraud, or policy violations.',
  },
  {
    title: 'Permitted Use',
    body:
      'You may use the service only for personal, lawful, non-commercial viewing and account management. You may not copy, redistribute, scrape, republish, record, resell, or exploit site material or platform features without prior written permission.',
  },
  {
    title: 'Prohibited Conduct',
    body:
      'You may not attempt unauthorized access, interfere with platform security, bypass subscription controls, abuse payment systems, upload malicious material, impersonate others, or use the service in any way that harms EthioGlow, its providers, or other users.',
  },
  {
    title: 'Termination Or Deactivation',
    body:
      'We may suspend or deactivate accounts that breach these terms, violate law, or create security, payment, or operational risk. Account deactivation may also occur when requested through available account tools or membership controls.',
  },
  {
    title: 'Service Availability',
    body:
      'We may update, change, pause, or discontinue any part of the platform at any time. We do not guarantee uninterrupted availability, perfect compatibility, or error-free operation across all devices, locations, or networks.',
  },
  {
    title: 'Disclaimers And Liability',
    body:
      'The service is provided on an as-available basis to the extent permitted by law. EthioGlow is not liable for indirect, incidental, or consequential losses arising from use of the platform, access interruptions, billing disputes, or third-party provider outages.',
  },
  {
    title: 'Changes To These Terms',
    body:
      'We may revise these terms from time to time. Continued use of the service after an update takes effect means you accept the revised version. Users should review this page periodically.',
  },
]

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-950 via-slate-900 to-black text-white flex flex-col">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-brand-300 font-semibold">
              Legal
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-bold text-white">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm sm:text-base text-gray-300 max-w-2xl">
              These terms describe the rules for using EthioGlow, maintaining an account, and accessing premium membership features.
            </p>
          </div>
          <Link
            to="/"
            className="shrink-0 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-10 shadow-2xl">
            <div className="border-b border-white/10 pb-6 mb-8">
              <p className="text-sm text-gray-400">Effective date: May 12, 2026</p>
              <p className="mt-4 text-base sm:text-lg text-gray-200 leading-relaxed max-w-3xl">
                These terms govern your use of EthioGlow. By creating an account, subscribing, or accessing the service, you agree to comply with the platform rules, legal restrictions, and membership conditions described below.
              </p>
            </div>

            <div className="grid gap-6">
              {termsSections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-2xl border border-white/10 bg-black/20 px-5 py-5 sm:px-6"
                >
                  <h2 className="text-xl font-serif font-bold text-white">{section.title}</h2>
                  <p className="mt-3 text-sm sm:text-base leading-relaxed text-gray-300">
                    {section.body}
                  </p>
                </section>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm leading-relaxed text-amber-100">
              This page is a general platform terms page and should be updated if your billing model, legal requirements, or service rules change.
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}