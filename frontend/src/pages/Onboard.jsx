import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, PiggyBank } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'

export default function Onboard() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({ full_name: '', farm_name: '', farm_location: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('piggery_token')) navigate('/login', { replace: true })
    if (user?.full_name) setForm((f) => ({ ...f, full_name: user.full_name }))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.onboard({
        ...form,
        farm_location: form.farm_location || null,
      })
      updateUser(res)
      navigate(res.is_onboarded ? '/' : '/onboard', { replace: true })
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
          <h1 className="font-bold text-xl text-slate-900">Tell us about your farm</h1>
        </div>
        <p className="text-sm text-slate-500 mb-5">A couple of quick details and you're ready to go.</p>

        {error && <div className="mb-4 bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2.5 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Farm name</label>
            <input required value={form.farm_name} onChange={(e) => setForm({ ...form, farm_name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="e.g. Alcayaga Pig Farm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Farm location</label>
            <input value={form.farm_location} onChange={(e) => setForm({ ...form, farm_location: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="e.g. Barangay San Isidro, Batangas" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg">
            <UserPlus className="w-4 h-4" /> {loading ? 'Saving…' : 'Finish setup'}
          </button>
        </form>
      </div>
    </div>
  )
}