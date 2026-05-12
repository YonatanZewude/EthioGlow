import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

const copyrightSections = [
  {
    title: 'Ownership Of Site Materials',
    body:
      'The EthioGlow platform design, branding, layout, text, graphics, curated media collections, and related materials are protected by copyright, trademark, and other applicable rights. Access to the service does not transfer ownership to users.',
  },
  {
    title: 'Limited User License',
    body:
      'Subscribers receive a limited, revocable, non-transferable right to access content for personal viewing through the service. This does not include the right to copy, download outside permitted features, reproduce, sell, distribute, edit, republish, or publicly display protected material.',
  },
  {
    title: 'Unauthorized Use',
    body:
      'You may not capture, repost, screen-record, mirror, scrape, archive, redistribute, or commercially exploit content from EthioGlow without express written permission. Unauthorized use may result in account termination and legal enforcement.',
  },
  {
    title: 'Reporting Infringement',
    body:
      'If you believe that material on EthioGlow infringes your copyright or other intellectual property rights, you should submit a written notice identifying the protected work, the allegedly infringing material, your contact details, and the basis for your claim.',
  },
  {
    title: 'Review And Removal Process',
    body:
      'We may investigate infringement claims, request additional information, restrict access to disputed material, or remove content when appropriate. We may also take action against accounts that repeatedly misuse platform materials or submit abusive claims.',
  },
  {
    title: 'Repeat Violations',
    body:
      'Accounts involved in repeated copyright abuse, unauthorized redistribution, or deliberate misuse of protected materials may be suspended, deactivated, or permanently banned from the service.',
  },
  {
    title: 'Contact For Copyright Notices',
    body:
      'Copyright-related notices should be sent to the official EthioGlow support or rights-management contact associated with the platform. Keep notices accurate, complete, and made in good faith.',
  },
]

export default function CopyrightRulesPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-950 via-slate-900 to-black text-white flex flex-col">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-brand-300 font-semibold">
              Legal
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-bold text-white">
              Copyright Rules
            </h1>
            <p className="mt-3 text-sm sm:text-base text-gray-300 max-w-2xl">
              This page explains how EthioGlow protects platform materials and handles copyright-related complaints.
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
                EthioGlow respects intellectual property rights and expects users to do the same. The rules below explain the permitted use of site materials and the process for reporting suspected infringement.
              </p>
            </div>

            <div className="grid gap-6">
              {copyrightSections.map((section) => (
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
              This page is a general copyright notice and takedown framework. You should tailor it further if you adopt a formal DMCA-style process or designate a dedicated legal contact.
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}