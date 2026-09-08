import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, PiggyBank } from 'lucide-react'
import { api } from '../api'

export default function Onboard() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', farm_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('piggery_token')) navigate('/login', { replace: true })
    const saved = JSON.parse(localStorage.getItem('piggery_user') || '{}')
    if (saved?.full_name) setForm((f) => ({ ...f, full_name: saved.full_name }))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.onboard(form)
      const saved = JSON.parse(localStorage.getItem('piggery_user') || '{}')
      localStorage.setItem('piggery_user', JSON.stringify({ ...saved, on_boarded: true, full_name: form.full_name, ...form }))
      navigate('/', { replace: true })
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
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg">
            <UserPlus className="w-4 h-4" /> {loading ? 'Saving…' : 'Finish setup'}
          </button>
        </form>
      </div>
    </div>
  )
}