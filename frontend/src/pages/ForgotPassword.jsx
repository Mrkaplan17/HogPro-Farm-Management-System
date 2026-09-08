import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PiggyBank, ArrowLeft, KeyRound } from 'lucide-react'
import { api } from '../api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const res = await api.forgotPassword({ email })
      setNotice(res.message || 'If an account exists for that email, a reset link has been sent.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-pink-600 rounded-xl p-2"><PiggyBank className="w-5 h-5 text-white" /></div>
          <h1 className="font-bold text-xl text-slate-900">Reset your password</h1>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Enter the email you signed up with and we'll send a password reset link (valid for 30 minutes).
        </p>

        {notice && <div className="mb-4 bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-2.5 text-sm">{notice}</div>}
        {error && <div className="mb-4 bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2.5 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="you@farm.com" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg">
            <KeyRound className="w-4 h-4" /> {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <Link to="/login" className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-pink-600">
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </Link>
      </div>
    </div>
  )
}