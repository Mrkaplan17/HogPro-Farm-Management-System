import { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import { MONEY } from '../components/InsightCharts'
import { Skeleton } from '../components/Skeleton'

const CATEGORIES = ['piglets', 'feed', 'medicine', 'veterinary', 'utilities', 'labor', 'maintenance', 'inventory', 'misc']

const EMPTY = { category: 'feed', description: '', quantity: '', unit_price: '', date: new Date().toISOString().split('T')[0], batch_id: '' }

export default function Expenses() {
  const { isAdmin } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [batches, setBatches] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)

  async function loadAll() {
    setLoading(true)
    try {
      const [e, b] = await Promise.all([
        api.getExpenses(filter ? { category: filter } : {}),
        api.getBatches().catch(() => []),
      ])
      setExpenses(e)
      setBatches(b)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [filter])

  async function submit(e) {
    e.preventDefault()
    const quantity = parseFloat(form.quantity)
    const unit_price = parseFloat(form.unit_price)
    if (!(quantity > 0)) return alert('Enter a quantity.')
    if (!(unit_price >= 0)) return alert('Enter a unit price.')
    try {
      await api.createExpense({
        batch_id: form.batch_id ? parseInt(form.batch_id) : null,
        category: form.category,
        description: form.description,
        quantity,
        unit_price,
        date: form.date,
      })
      setShowForm(false)
      setForm(EMPTY)
      loadAll()
    } catch (err) { setError(err.message) }
  }

  async function remove(id) {
    if (!confirm('Delete this expense?')) return
    try { await api.deleteExpense(id); loadAll() } catch (err) { setError(err.message) }
  }

  const total = expenses.reduce((s, x) => s + x.amount, 0)
  const lineTotal = (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0)
  const batchName = (id) => batches.find((b) => b.id === Number(id))?.name || ''

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses Ledger</h1>
          <p className="text-sm text-slate-500 mt-0.5">Every farm expense — batch-linked or general.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Close' : 'Add Expense'}
          </button>
        )}
      </header>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">{error}</div>}

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 25 sacks grower feed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input required type="number" step="0.01" min="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit price (₱)</label>
              <input required type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Batch / group</label>
              <select value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">General farm expense</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <p className="text-sm text-slate-600">Total cost: <strong className="text-red-600">₱{lineTotal.toLocaleString()}</strong></p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm text-white bg-pink-600 rounded-lg font-semibold">Save Expense</button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1">
          <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === '' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>All</button>
          {CATEGORIES.filter((c) => c !== 'inventory').map((c) => (
            <button key={c} onClick={() => setFilter(filter === c ? '' : c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filter === c ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>{c}</button>
          ))}
        </div>
        {!loading && (
          <span className="text-sm text-slate-500 ml-auto">
            Total · <strong className="text-red-600">₱{total.toLocaleString()}</strong>
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-72" />
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">No expenses in this view yet.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5">Description</th>
                  <th className="py-3 px-5">Batch</th>
                  <th className="py-3 px-5 text-right">Qty</th>
                  <th className="py-3 px-5 text-right">Unit ₱</th>
                  <th className="py-3 px-5 text-right">Amount</th>
                  <th className="py-3 px-5">Source</th>
                  {isAdmin && <th className="py-3 px-5 w-14" />}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-3 px-5 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="py-3 px-5"><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 capitalize">{e.category}</span></td>
                    <td className="py-3 px-5 text-slate-700">{e.description}</td>
                    <td className="py-3 px-5">{batchName(e.batch_id) || '—'}</td>
                    <td className="py-3 px-5 text-right">{Number(e.quantity).toLocaleString()}</td>
                    <td className="py-3 px-5 text-right">{MONEY(e.unit_price || 0)}</td>
                    <td className="py-3 px-5 text-right font-semibold text-red-600">{MONEY(e.amount)}</td>
                    <td className="py-3 px-5">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${e.source === 'inventory' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                        {e.source || 'manual'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-5 text-right">
                        <button onClick={() => remove(e.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}