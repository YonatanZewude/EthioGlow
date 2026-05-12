import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useSignUp } from '@clerk/clerk-react'
import Footer from '../components/Footer'
import { createCheckoutSession, syncProfileWithBackend } from '../lib/supabase'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus(null)
    setBusy(true)

    try {
      if (!signUpLoaded || !signUp || !setSignUpActive) {
        setStatus('Sign-up is not loaded yet. Please try again.')
        setBusy(false)
        return
      }

      const signUpAttempt = await signUp.create({
        emailAddress: email,
        password: password,
      })

      if (signUpAttempt.status === 'complete' && signUpAttempt.createdSessionId) {
        await setSignUpActive({ session: signUpAttempt.createdSessionId })
        const clerkToken = await getToken()

        if (!clerkToken) {
          throw new Error('Could not get Clerk token after sign-up.')
        }

        const profile = await syncProfileWithBackend(clerkToken)
        setPendingVerification(false)
        setVerificationCode('')

        if (profile?.subscription_active || profile?.role === 'admin') {
          navigate('/dashboard')
          return
        }

        const checkoutUrl = await createCheckoutSession(clerkToken)
        window.location.href = checkoutUrl
      } else {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        setPendingVerification(true)
        setStatus('Check your email and enter the verification code to finish sign-up.')
      }
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'errors' in error
          ? String(
              (error as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage ||
                'Auth error',
            )
          : 'Auth error'
      setStatus(message)
    }

    setBusy(false)
  }

  const handleEmailCodeVerification = async (event: FormEvent) => {
    event.preventDefault()
    setStatus(null)
    setBusy(true)

    try {
      if (!signUpLoaded || !signUp || !setSignUpActive) {
        setStatus('Sign-up verification is not loaded yet. Please try again.')
        setBusy(false)
        return
      }

      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      })

      if (result.status === 'complete' && result.createdSessionId) {
        await setSignUpActive({ session: result.createdSessionId })
        const clerkToken = await getToken()

        if (!clerkToken) {
          throw new Error('Could not get Clerk token after email verification.')
        }

        const profile = await syncProfileWithBackend(clerkToken)
        setPendingVerification(false)
        setVerificationCode('')

        if (profile?.subscription_active || profile?.role === 'admin') {
          navigate('/dashboard')
          return
        }

        const checkoutUrl = await createCheckoutSession(clerkToken)
        window.location.href = checkoutUrl
      } else {
        setStatus('Verification is incomplete. Please try the code again.')
      }
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'errors' in error
          ? String(
              (error as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage ||
                'Verification error',
            )
          : 'Verification error'
      setStatus(message)
    }

    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-700 bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 shadow-sm backdrop-blur-sm bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <a href="/" className="flex items-center cursor-pointer">
              <h1 className="text-3xl font-serif font-bold text-white">
                EthioGlow<span className="text-brand-500">.</span>
              </h1>
            </a>
            <div className="flex gap-2">
              <a
                href="/"
                className="px-6 py-2 rounded-full text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition-all border border-gray-600 shadow-md cursor-pointer"
              >
                Home
              </a>
              <a
                href="/login"
                className="px-6 py-2 rounded-full text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-all shadow-md cursor-pointer"
              >
                Login
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-serif font-bold text-white mb-3">
              Get Started
            </h2>
            <p className="text-gray-300 text-lg">
              Create an account to unlock 10,000+ AI-generated images
            </p>
          </div>

          <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
            {!pendingVerification ? (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder-gray-400"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder-gray-400"
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Must be at least 8 characters long
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 px-6 bg-white text-purple-700 font-bold rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xl hover:shadow-2xl"
                >
                  {busy ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            ) : (
              <form className="space-y-5" onSubmit={handleEmailCodeVerification}>
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-brand-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Verify your email</h3>
                  <p className="text-sm text-gray-300">
                    We sent a 6-digit code to <strong>{email}</strong>
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="verification-code"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Verification code
                  </label>
                  <input
                    id="verification-code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    autoComplete="one-time-code"
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-center text-2xl tracking-widest font-mono placeholder-gray-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || !verificationCode.trim()}
                  className="w-full py-3 px-6 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg hover:shadow-xl"
                >
                  {busy ? 'Verifying...' : 'Verify Email'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPendingVerification(false)
                    setVerificationCode('')
                    setStatus(null)
                  }}
                  className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  ← Back to registration
                </button>
              </form>
            )}

            <div id="clerk-captcha" className="mt-4" />

            {status && (
              <div
                className={`mt-4 p-4 rounded-lg text-sm ${
                  status.toLowerCase().includes('error') ||
                  status.toLowerCase().includes('failed') ||
                  status.toLowerCase().includes('could not')
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : status.toLowerCase().includes('success') ||
                        status.toLowerCase().includes('verified')
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {status}
              </div>
            )}

            {!pendingVerification && (
              <p className="mt-6 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <a href="/login" className="font-semibold text-brand-500 hover:text-brand-600 cursor-pointer">
                  Sign in here
                </a>
              </p>
            )}
          </div>

          {!pendingVerification && (
            <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-3 text-center">
                What you'll get:
              </h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Access to 10,000+ premium AI-generated Ethiopian model images</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Exclusive video content of Ethiopian models</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Smart filtering and category organization</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Save favorites and personalize your experience</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
