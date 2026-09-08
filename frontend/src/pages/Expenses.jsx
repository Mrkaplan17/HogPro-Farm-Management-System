import { useEffect, useState } from 'react'
import { Trash2, PackagePlus, Info } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import { MONEY } from '../components/InsightCharts'
import { Skeleton } from '../components/Skeleton'

const CATEGORIES = ['piglets', 'feed', 'medicine', 'veterinary', 'utilities', 'labor', 'maintenance', 'inventory', 'misc']

export default function Expenses() {
  const { isAdmin } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [batches, setBatches] = useState([])
  const [category, setCategory] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadAll() {
    setLoading(true)
    try {
      const [e, b] = await Promise.all([
        api.getExpenses({
          ...(category ? { category } : {}),
          ...(batchFilter ? { batch_id: batchFilter } : {}),
        }),
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

  useEffect(() => { loadAll() }, [category, batchFilter])

  async function remove(id) {
    if (!confirm('Delete this expense?')) return
    try { await api.deleteExpense(id); loadAll() } catch (err) { setError(err.message) }
  }

  const total = expenses.reduce((s, x) => s + x.amount, 0)
  const batchName = (id) => batches.find((b) => b.id === Number(id))?.name || ''
  const hasBatchFilter = Boolean(batchFilter)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Expenses Ledger</h1>
        <p className="text-sm text-slate-500 mt-0.5">Auto-generated from inventory restocks and production batches — audit spend per production cycle.</p>
      </header>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">{error}</div>}

      <div className="flex items-start gap-2 bg-sky-50 text-sky-800 border border-sky-200 rounded-xl p-4 text-sm">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Expenses are written automatically when you restock inventory or create a production batch.
          There is no manual entry form, so the ledger always matches what you actually bought.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 flex-wrap">
          <button onClick={() => setCategory('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${category === '' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(category === c ? '' : c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${category === c ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>{c}</button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch</span>
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="text-sm bg-transparent py-1 pr-6 focus:outline-none"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {!loading && (
          <span className="text-sm text-slate-500 ml-auto">
            {hasBatchFilter ? <><PackagePlus className="inline w-3.5 h-3.5 mr-1" /> {batchName(batchFilter)} · </> : null}Total · {' '}
            <strong className="text-red-600">{MONEY(total)}</strong>
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-72" />
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">
          {hasBatchFilter ? 'No expenses for this batch yet. Restock feed or medicine against a batch to see it here.' : 'No expenses yet. Restock inventory or create a batch with a piglet cost to get started.'}
        </div>
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
                      <span className={`px-2 py-0.5 rounded-full text-xs ${e.source === 'inventory' ? 'bg-sky-100 text-sky-700' : e.source === 'batch' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                        {e.source === 'batch' ? 'batch' : e.source || 'manual'}
                      </span>
                    </td>
                    {isAdmin && e.source === 'manual' && (
                      <td className="py-3 px-5 w-14 text-right">
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