import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useSignIn } from '@clerk/clerk-react'
import Footer from '../components/Footer'
import { syncProfileWithBackend } from '../lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetPassword, setResetPassword] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus(null)
    setBusy(true)

    try {
      if (!signInLoaded || !signIn || !setSignInActive) {
        setStatus('Sign-in is not loaded yet. Please try again.')
        setBusy(false)
        return
      }

      const signInAttempt = await signIn.create({
        identifier: email,
        password: password,
      })

      if (signInAttempt.status === 'complete' && signInAttempt.createdSessionId) {
        await setSignInActive({ session: signInAttempt.createdSessionId })
        const clerkToken = await getToken()

        if (!clerkToken) {
          throw new Error('Could not get Clerk token after sign-in.')
        }

        await syncProfileWithBackend(clerkToken)
        setStatus('Signed in successfully.')
        navigate('/dashboard')
      } else {
        setStatus('Could not sign in. Please check your credentials.')
      }
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'errors' in error
          ? String((error as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage || 'Auth error')
          : 'Auth error'
      setStatus(message)
    }

    setBusy(false)
  }

  const handleGoogleAuth = async () => {
    setStatus(null)
    setBusy(true)

    try {
      if (!signInLoaded || !signIn) {
        setStatus('Google sign-in is not loaded yet. Please try again.')
        setBusy(false)
        return
      }

      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: window.location.origin,
        redirectUrlComplete: window.location.origin + '/dashboard',
      })
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'errors' in error
          ? String((error as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage || 'Google auth error')
          : 'Google auth error'
      setStatus(message)
      setBusy(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setStatus('Please enter your email address first.')
      return
    }

    setStatus(null)
    setBusy(true)

    try {
      if (!signInLoaded || !signIn) {
        setStatus('Sign-in is not loaded yet. Please try again.')
        setBusy(false)
        return
      }

      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      })

      setResetPassword(true)
      setStatus('Password reset code sent! Check your email.')
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'errors' in error
          ? String((error as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage || 'Error sending reset email')
          : 'Error sending reset email'
      setStatus(message)
    }

    setBusy(false)
  }

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault()
    setStatus(null)
    setBusy(true)

    try {
      if (!signInLoaded || !signIn || !setSignInActive) {
        setStatus('Sign-in is not loaded yet. Please try again.')
        setBusy(false)
        return
      }

      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode,
        password: newPassword,
      })

      if (result.status === 'complete' && result.createdSessionId) {
        await setSignInActive({ session: result.createdSessionId })
        const clerkToken = await getToken()

        if (!clerkToken) {
          throw new Error('Could not get Clerk token after password reset.')
        }

        await syncProfileWithBackend(clerkToken)
        setStatus('Password reset successful!')
        navigate('/dashboard')
      } else {
        setStatus('Could not reset password. Please try again.')
      }
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'errors' in error
          ? String((error as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage || 'Error resetting password')
          : 'Error resetting password'
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
                href="/register"
                className="px-6 py-2 rounded-full text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-all shadow-md cursor-pointer"
              >
                Register
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
              Welcome Back
            </h2>
            <p className="text-gray-300 text-lg">
              Sign in to access your premium content
            </p>
          </div>

          <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
            {!resetPassword ? (
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
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={busy}
                      className="text-sm text-white hover:text-gray-200 cursor-pointer transition-colors font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder-gray-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 px-6 bg-white text-purple-700 font-bold rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xl hover:shadow-2xl"
                >
                  {busy ? 'Signing in...' : 'Sign In'}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-gray-800 text-gray-400">or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={busy}
                  className="w-full py-3 px-6 bg-white border-2 border-gray-400 text-gray-800 font-semibold rounded-lg hover:bg-gray-50 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-3 shadow-md"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </button>
              </form>
            ) : (
              <form className="space-y-5" onSubmit={handleResetPassword}>
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
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Reset Password</h3>
                  <p className="text-sm text-gray-300">
                    Enter the code sent to <strong>{email}</strong>
                  </p>
                </div>

                <div>
                  <label htmlFor="reset-code" className="block text-sm font-medium text-gray-300 mb-2">
                    Reset code
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    placeholder="Enter code from email"
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder-gray-400"
                  />
                </div>

                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-2">
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder-gray-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 px-6 bg-white text-purple-700 font-bold rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xl hover:shadow-2xl"
                >
                  {busy ? 'Resetting...' : 'Reset Password'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResetPassword(false)
                    setResetCode('')
                    setNewPassword('')
                    setStatus(null)
                  }}
                  className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  ← Back to sign in
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
                    : status.toLowerCase().includes('success')
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {status}
              </div>
            )}

            <p className="mt-6 text-center text-sm text-gray-400">
              Don't have an account?{' '}
              <a href="/register" className="font-semibold text-brand-400 hover:text-brand-300 cursor-pointer">
                Create one here
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
