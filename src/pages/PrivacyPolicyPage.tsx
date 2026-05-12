import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

const policySections = [
  {
    title: 'Information We Collect',
    body:
      'We may collect account details such as your email address, authentication information provided through third-party identity providers, subscription status, payment-related customer references, and activity needed to operate your member account securely.',
  },
  {
    title: 'How We Use Information',
    body:
      'We use personal information to provide access to the service, process subscriptions, protect accounts, respond to support requests, maintain platform security, and enforce our membership, age-gate, and access rules.',
  },
  {
    title: 'Payments And Billing',
    body:
      'Payments and subscription billing may be handled through approved third-party payment providers. We do not store full payment card details on our own servers. We may store customer or subscription references in order to manage renewals, cancellations, and account status.',
  },
  {
    title: 'Authentication And Account Security',
    body:
      'Sign-in and account authentication may be provided through approved third-party identity providers. We use account and session information to protect access, support verification flows, and enforce one-device or subscription-related access controls when required by the service.',
  },
  {
    title: 'Storage And Service Providers',
    body:
      'We use third-party infrastructure, identity, hosting, storage, and payment providers to operate the platform. These providers process data only as needed to deliver the service, support account access, manage subscriptions, and maintain security.',
  },
  {
    title: 'Cookies, Local Storage, And Similar Tools',
    body:
      'We may use essential cookies, local storage, and related technologies to keep you signed in, remember privacy or age-gate preferences, maintain session security, and support core site functionality.',
  },
  {
    title: 'Age Restricted Service',
    body:
      'This service is intended only for adults who meet the legal age requirement in their location. We may process age-gate and account-access information to help enforce that restriction and protect the platform.',
  },
  {
    title: 'Data Retention',
    body:
      'We keep information for as long as reasonably necessary to operate the service, comply with legal obligations, resolve disputes, prevent abuse, and maintain account history. Inactive accounts may remain in our database with limited access status for service continuity and recordkeeping.',
  },
  {
    title: 'Your Choices',
    body:
      'You may manage your password and security settings through your account, manage or cancel your subscription through billing tools when available, and request support if you need help with account access or billing status.',
  },
  {
    title: 'Contact',
    body:
      'If you have privacy questions, please contact the EthioGlow support contact published through the website or official support channel associated with your account.',
  },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-950 via-slate-900 to-black text-white flex flex-col">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-brand-300 font-semibold">
              Legal
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-bold text-white">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm sm:text-base text-gray-300 max-w-2xl">
              This page explains how EthioGlow handles account, subscription, and service data.
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
                EthioGlow is committed to handling personal information carefully and using it only for legitimate business and platform operations. This policy describes the main categories of information we process and how that information supports account access, membership services, and security.
              </p>
            </div>

            <div className="grid gap-6">
              {policySections.map((section) => (
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
              This page is provided for general transparency about platform operations and should be reviewed periodically as features, providers, or legal requirements change.
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}