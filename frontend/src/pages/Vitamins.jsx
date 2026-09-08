import { useEffect, useState } from 'react'
import { Plus, Trash2, CheckCircle2, X, Syringe, CalendarClock, Bell } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import { Skeleton } from '../components/Skeleton'

const EMPTY_V = { batch_id: '', vitamin_name: '', dosage: '', unit: 'ml', date_administered: new Date().toISOString().split('T')[0], next_due_date: '', create_reminder: false, notes: '' }
const EMPTY_R = { title: '', description: '', reminder_type: 'general', batch_id: '', due_date: new Date().toISOString().split('T')[0], recurring: false }

export default function Vitamins() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('admin')
  const [logs, setLogs] = useState([])
  const [reminders, setReminders] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showV, setShowV] = useState(false)
  const [vForm, setVForm] = useState(EMPTY_V)
  const [showR, setShowR] = useState(false)
  const [rForm, setRForm] = useState(EMPTY_R)

  async function loadAll() {
    setLoading(true)
    try {
      const [v, r, b] = await Promise.all([
        api.getVitamins(),
        api.getReminders(),
        api.getBatches().catch(() => []),
      ])
      setLogs(v)
      setReminders(r)
      setBatches(b)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function submitV(e) {
    e.preventDefault()
    if (!(parseFloat(vForm.dosage) > 0)) return alert('Enter the dosage per head.')
    try {
      await api.createVitamin({
        batch_id: vForm.batch_id ? parseInt(vForm.batch_id) : null,
        vitamin_name: vForm.vitamin_name,
        dosage: parseFloat(vForm.dosage),
        unit: vForm.unit,
        date_administered: vForm.date_administered,
        next_due_date: vForm.next_due_date || null,
        create_reminder: vForm.create_reminder,
        notes: vForm.notes,
      })
      setShowV(false)
      setVForm(EMPTY_V)
      loadAll()
    } catch (err) { setError(err.message) }
  }

  async function submitR(e) {
    e.preventDefault()
    try {
      await api.createReminder({
        title: rForm.title,
        description: rForm.description || '',
        reminder_type: rForm.reminder_type,
        batch_id: rForm.batch_id ? parseInt(rForm.batch_id) : null,
        due_date: rForm.due_date,
        recurring: rForm.recurring,
      })
      setShowR(false)
      setRForm(EMPTY_R)
      loadAll()
    } catch (err) { setError(err.message) }
  }

  async function complete(id) {
    try { await api.completeReminder(id); loadAll() } catch (err) { setError(err.message) }
  }

  async function remove(id, kind) {
    if (!confirm('Delete this record?')) return
    try {
      if (kind === 'reminder') await api.deleteReminder(id)
      else await api.deleteVitamin(id)
      loadAll()
    } catch (err) { setError(err.message) }
  }

  const pendingCount = reminders.filter((r) => r.status === 'pending').length

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Vitamins &amp; Health Schedule</h1>
        <p className="text-sm text-slate-500 mt-0.5">Deworming / vitamin injections and upcoming due dates.</p>
      </header>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">{error}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1">
          {[['admin', 'Administration'], ['schedule', `Schedule (${pendingCount} pending)`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
              {label}
            </button>
          ))}
        </div>
        {(tab === 'admin' ? isAdmin : true) && (
          <button onClick={() => (tab === 'admin' ? setShowV((s) => !s) : setShowR((s) => !s))}
            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
            {tab === 'admin' ? <><Syringe className="w-4 h-4" /> Log Dose</> : <><Plus className="w-4 h-4" /> New Reminder</>}
          </button>
        )}
      </div>

      {tab === 'admin' ? (
        <>
          {showV && (
            <form onSubmit={submitV} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vitamin / dewormer</label>
                  <input required value={vForm.vitamin_name} onChange={(e) => setVForm({ ...vForm, vitamin_name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Oxytetra LA" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date administered</label>
                  <input required type="date" value={vForm.date_administered} onChange={(e) => setVForm({ ...vForm, date_administered: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch / group</label>
                  <select value={vForm.batch_id} onChange={(e) => setVForm({ ...vForm, batch_id: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">None (general)</option>
                    {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dosage</label>
                  <input required type="number" step="0.01" min="0.01" value={vForm.dosage} onChange={(e) => setVForm({ ...vForm, dosage: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                  <select value={vForm.unit} onChange={(e) => setVForm({ ...vForm, unit: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    {['ml', 'cc', 'dose', 'mg', 'per head'].map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Next dose due (optional)</label>
                  <input type="date" value={vForm.next_due_date} onChange={(e) => setVForm({ ...vForm, next_due_date: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input value={vForm.notes} onChange={(e) => setVForm({ ...vForm, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={vForm.create_reminder}
                    onChange={(e) => setVForm({ ...vForm, create_reminder: e.target.checked })}
                    disabled={!vForm.next_due_date} className="rounded" />
                  Create a schedule reminder for the next dose
                  {!vForm.next_due_date && <span className="text-xs text-slate-400">(set a next dose date to enable)</span>}
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowV(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm text-white bg-pink-600 rounded-lg font-semibold">Save Dose</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">No vitamin doses logged yet.</div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-slate-500">
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5">Vitamin</th>
                      <th className="py-3 px-5">Batch</th>
                      <th className="py-3 px-5 text-right">Dosage</th>
                      <th className="py-3 px-5">Next due</th>
                      <th className="py-3 px-5">Notes</th>
                      {isAdmin && <th className="py-3 px-5 w-14" />}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((v) => {
                      const batch = batches.find((b) => b.id === v.batch_id)
                      return (
                        <tr key={v.id} className="border-t border-slate-100">
                          <td className="py-3 px-5 whitespace-nowrap">{new Date(v.date_administered).toLocaleDateString()}</td>
                          <td className="py-3 px-5 font-medium">{v.vitamin_name}</td>
                          <td className="py-3 px-5">{batch?.name || '—'}</td>
                          <td className="py-3 px-5 text-right">{v.dosage} {v.unit}</td>
                          <td className="py-3 px-5">{v.next_due_date ? new Date(v.next_due_date).toLocaleDateString() : '—'}</td>
                          <td className="py-3 px-5 text-slate-600">{v.notes || '—'}</td>
                          {isAdmin && (
                            <td className="py-3 px-5 text-right">
                              <button onClick={() => remove(v.id, 'vitamin')} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Bell className="w-4 h-4" /> {pendingCount} pending schedule {pendingCount === 1 ? 'item' : 'items'}.
          </div>

          {showR && (
            <form onSubmit={submitR} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input required value={rForm.title} onChange={(e) => setRForm({ ...rForm, title: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Vaccination day" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select value={rForm.reminder_type} onChange={(e) => setRForm({ ...rForm, reminder_type: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="general">General</option>
                    <option value="vitamin">Vitamin / dose</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due date</label>
                  <input required type="date" value={rForm.due_date} onChange={(e) => setRForm({ ...rForm, due_date: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch (optional)</label>
                  <select value={rForm.batch_id} onChange={(e) => setRForm({ ...rForm, batch_id: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">None</option>
                    {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <input value={rForm.description} onChange={(e) => setRForm({ ...rForm, description: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
                    <input type="checkbox" checked={rForm.recurring} onChange={(e) => setRForm({ ...rForm, recurring: e.target.checked })} className="rounded" />
                    Recurring
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowR(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm text-white bg-pink-600 rounded-lg font-semibold">Save Reminder</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : reminders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">Nothing scheduled yet.</div>
          ) : (
            <div className="space-y-3">
              {reminders.map((r) => {
                const batch = batches.find((b) => b.id === r.batch_id)
                const overdue = r.status === 'pending' && new Date(r.due_date) < new Date()
                return (
                  <div key={r.id} className={`bg-white rounded-2xl border p-5 flex items-center justify-between gap-4 ${overdue ? 'border-red-300' : r.status === 'done' ? 'border-slate-200 opacity-70' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`rounded-lg p-2 shrink-0 ${r.reminder_type === 'vitamin' ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-500'}`}>
                        {r.reminder_type === 'vitamin' ? <Syringe className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{r.title}</p>
                        <p className="text-sm text-slate-500">
                          Due {new Date(r.due_date).toLocaleDateString()}
                          {overdue && <span className="text-red-600 font-medium"> · overdue</span>}
                          {batch ? ` · ${batch.name}` : ''}
                          {r.recurring ? ' · recurring' : ''}
                        </p>
                        {r.description && <p className="text-sm text-slate-600 mt-0.5">{r.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'done' ? 'bg-green-100 text-green-700' : overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status}
                      </span>
                      {r.status !== 'done' && (
                        <button onClick={() => complete(r.id)} title="Mark done" className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><CheckCircle2 className="w-4 h-4" /></button>
                      )}
                      {isAdmin && (
                        <button onClick={() => remove(r.id, 'reminder')} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}