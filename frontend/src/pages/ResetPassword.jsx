import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { PiggyBank, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react'
import { api } from '../api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    setError('')
    try {
      const res = await api.resetPassword({ token, new_password: password })
      setNotice(res.message || 'Your password has been updated.')
      setTimeout(() => navigate('/login'), 1800)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center">
          <h1 className="font-bold text-lg text-slate-900 mb-2">Invalid reset link</h1>
          <p className="text-sm text-slate-500 mb-4">This link is missing or has expired. Request a new one.</p>
          <Link to="/forgot-password" className="text-sm font-semibold text-pink-600">Request a new link</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-pink-600 rounded-xl p-2"><PiggyBank className="w-5 h-5 text-white" /></div>
          <h1 className="font-bold text-xl text-slate-900">Choose a new password</h1>
        </div>

        {notice && <div className="mb-4 bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-2.5 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {notice}</div>}
        {error && <div className="mb-4 bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2.5 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
            <input required type="password" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
            <input required type="password" minLength="6" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg">
            <KeyRound className="w-4 h-4" /> {loading ? 'Saving…' : 'Update password'}
          </button>
        </form>

        <Link to="/login" className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-pink-600">
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </Link>
      </div>
    </div>
  )
}