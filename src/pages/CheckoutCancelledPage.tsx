import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClerk } from '@clerk/clerk-react'

const HOME_URL = 'https://www.ethioglow.com'

export default function CheckoutCancelledPage() {
  const { signOut } = useClerk()
  const [status, setStatus] = useState('Returning to the home page...')

  useEffect(() => {
    const endSession = async () => {
      try {
        await signOut({ redirectUrl: HOME_URL })
        setStatus('Your session has been closed because an active subscription is required.')
      } catch {
        setStatus('Payment was cancelled. You can return to the start page.')
      }
    }

    void endSession()
  }, [signOut])

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-gray-800 border border-gray-700 rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-3xl font-serif font-bold text-white mb-4">Subscription required</h1>
        <p className="text-gray-300 mb-6">
          Payment was not completed. An active subscription is required before access is granted.
        </p>
        <p className="text-sm text-gray-400 mb-8">{status}</p>
        <div className="flex items-center justify-center gap-3">
          <a
            href={HOME_URL}
            className="px-6 py-3 rounded-full bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-all"
          >
            Go to home
          </a>
          <Link
            to="/login"
            className="px-6 py-3 rounded-full bg-gray-700 text-white font-semibold hover:bg-gray-600 transition-all"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  )
}