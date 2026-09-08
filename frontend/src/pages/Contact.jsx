import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, Send } from 'lucide-react'
import { api } from '../api'

export default function Contact() {
  const [form, setForm] = useState({ subject: '', message: '' })
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const res = await api.sendContact(form)
      setNotice('Message received. We\'ll get back to you soon.')
      setForm({ subject: '', message: '' })
      if (res) setNotice(res.status === 'sent' ? 'Message sent successfully.' : notice)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white mb-4">
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </Link>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-pink-600 rounded-xl p-2"><Mail className="w-5 h-5 text-white" /></div>
            <h1 className="font-bold text-xl text-slate-900">Farm Support</h1>
          </div>
          <p className="text-sm text-slate-500 mb-5">
            Questions, feedback or issues? Send us a message — we reply by email.
          </p>

          {notice && <div className="mb-4 bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-2.5 text-sm">{notice}</div>}
          {error && <div className="mb-4 bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2.5 text-sm">{error}</div>}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="e.g. How do I close a batch?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
              <textarea required rows="5" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Describe your question or problem…" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg">
              <Send className="w-4 h-4" /> {loading ? 'Sending…' : 'Send message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}