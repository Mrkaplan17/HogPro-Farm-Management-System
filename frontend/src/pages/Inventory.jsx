import { useEffect, useState } from 'react'
import { Plus, Trash2, PackagePlus, PackageMinus, AlertTriangle, X, Boxes } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import { Skeleton } from '../components/Skeleton'

const CATEGORIES = ['feed', 'medicine', 'vitamin', 'supplies']

const EMPTY = { name: '', category: 'feed', unit: 'kg', stock_qty: '', threshold_qty: '', unit_cost: '', supplier: '', notes: '' }

export default function Inventory() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [transactions, setTransactions] = useState([])
  const [banner, setBanner] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [action, setAction] = useState(null) // { type: 'restock'|'issue', item }
  const [txn, setTxn] = useState({ qty: '', unit_cost: '', batch_id: '', notes: '' })
  const [batches, setBatches] = useState([])

  async function loadAll() {
    setLoading(true)
    try {
      const [itemsData, txnData, alerts, batchesData] = await Promise.all([
        api.getInventory(),
        api.getInventoryTransactions({ limit: 50 }).catch(() => []),
        api.getInventoryAlerts().catch(() => []),
        api.getBatches().catch(() => []),
      ])
      setItems(itemsData)
      setTransactions(txnData)
      setBatches(batchesData)
      setBanner(alerts.length > 0
        ? `${alerts.length} item${alerts.length > 1 ? 's' : ''} at or below reorder level — restock soon to avoid shortages.`
        : '')
    } catch (e) {
      setBanner(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function submitItem(e) {
    e.preventDefault()
    try {
      await api.createInventoryItem({
        ...form,
        stock_qty: parseFloat(form.stock_qty) || 0,
        threshold_qty: parseFloat(form.threshold_qty) || 0,
        unit_cost: parseFloat(form.unit_cost) || 0,
      })
      setShowForm(false)
      setForm(EMPTY)
      loadAll()
    } catch (err) { setBanner(err.message) }
  }

  async function submitTxn(e) {
    e.preventDefault()
    if (!action) return
    const qty = parseFloat(txn.qty)
    if (!(qty > 0)) return alert('Enter a quantity.')
    try {
      const payload = {
        qty,
        batch_id: txn.batch_id ? parseInt(txn.batch_id) : null,
        notes: txn.notes || '',
      }
      if (action.type === 'restock') {
        payload.unit_cost = parseFloat(txn.unit_cost) || 0
        await api.restockItem(action.item.id, payload)
      } else {
        await api.issueItem(action.item.id, payload)
      }
      setAction(null)
      setTxn({ qty: '', unit_cost: '', batch_id: '', notes: '' })
      loadAll()
    } catch (err) { setBanner(err.message) }
  }

  async function removeItem(item) {
    if (!confirm(`Delete "${item.name}"? This removes its transaction history too.`)) return
    try { await api.deleteInventoryItem(item.id); loadAll() } catch (err) { setBanner(err.message) }
  }

  const lowItems = items.filter((i) => i.is_low_stock)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Feeds, medicines, vitamins &amp; supplies with reorder alerts.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Close' : 'New Item'}
        </button>
      </header>

      {banner && (
        <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-4 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {banner}
        </div>
      )}

      {showForm && (
        <form onSubmit={submitItem} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Item name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Grower Feed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {['kg', 'sack', 'bottle', 'vial', 'ml', 'piece'].map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Starting stock</label>
              <input type="number" step="0.01" min="0" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reorder at (threshold)</label>
              <input type="number" step="0.01" min="0" value={form.threshold_qty} onChange={(e) => setForm({ ...form, threshold_qty: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit cost (₱)</label>
              <input type="number" step="0.01" min="0" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
              <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm text-white bg-pink-600 rounded-lg font-semibold">Save Item</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">
          No inventory items yet. Add your first feed or medicine.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {items.map((item) => (
            <div key={item.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${item.is_low_stock ? 'border-amber-300' : 'border-slate-200'}`}>
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="bg-slate-900 text-white rounded-lg p-2 shrink-0"><Boxes className="w-4 h-4" /></div>
                    <div>
                      <h3 className="font-semibold text-slate-900 truncate">{item.name}</h3>
                      <span className="text-xs text-slate-500 capitalize">{item.category}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => removeItem(item)} className="text-slate-300 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                {item.is_low_stock && (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    <AlertTriangle className="w-3 h-3" /> LOW STOCK
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-200 ml-5 mr-5">
                <div className="bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">In stock</p>
                  <p className="text-lg font-bold text-slate-900">{item.stock_qty.toLocaleString()} <span className="text-xs font-normal text-slate-500">{item.unit}</span></p>
                  <p className="text-[11px] text-slate-400">reorder at {item.threshold_qty.toLocaleString()}</p>
                </div>
                <div className="bg-white p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Unit cost</p>
                  <p className="text-lg font-bold text-slate-900">₱{Number(item.unit_cost).toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400">{item.supplier || '—'}</p>
                </div>
              </div>
              <div className="p-4 border-t flex gap-2">
                <button onClick={() => { setAction({ type: 'restock', item }); setTxn({ qty: '', unit_cost: '', batch_id: '', notes: '' }) }} className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg py-2 font-semibold">
                  <PackagePlus className="w-4 h-4" /> Restock
                </button>
                <button onClick={() => { setAction({ type: 'issue', item }); setTxn({ qty: '', unit_cost: '', batch_id: '', notes: '' }) }} className="flex-1 flex items-center justify-center gap-1.5 text-sm text-white bg-amber-500 hover:bg-amber-600 rounded-lg py-2 font-semibold">
                  <PackageMinus className="w-4 h-4" /> Issue
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {action && (
        <form onSubmit={submitTxn} className="bg-white rounded-2xl border border-slate-300 p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">
              {action.type === 'restock' ? 'Restock' : 'Issue'} — {action.item.name}
              <span className="text-sm font-normal text-slate-500 ml-2">({action.item.stock_qty.toLocaleString()} {action.item.unit} on hand)</span>
            </h2>
            <button type="button" onClick={() => setAction(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity ({action.item.unit})</label>
              <input required type="number" step="0.01" min="0.01" value={txn.qty} onChange={(e) => setTxn({ ...txn, qty: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            {action.type === 'restock' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit cost (₱)</label>
                <input type="number" step="0.01" min="0" value={txn.unit_cost} onChange={(e) => setTxn({ ...txn, unit_cost: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder={`${action.item.unit_cost || 0}`} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Batch (optional)</label>
              <select value={txn.batch_id} onChange={(e) => setTxn({ ...txn, batch_id: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">None / general</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <input value={txn.notes} onChange={(e) => setTxn({ ...txn, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            {action.type === 'restock' && (
              <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2">
                <PackagePlus className="w-4 h-4 shrink-0" />
                This restock automatically records an expense in the ledger.
              </div>
            )}
            <div>
              {action.type === 'issue' && (
                <p className="text-xs text-slate-400">Issuing stock is a usage entry only — expenses are booked when you restock.</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAction(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">Cancel</button>
            <button type="submit" className={`px-5 py-2 text-sm text-white rounded-lg font-semibold ${action.type === 'restock' ? 'bg-green-600' : 'bg-amber-500'}`}>
              {action.type === 'restock' ? 'Complete Restock' : 'Issue'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-slate-900">Recent transactions</h2>
          <p className="text-sm text-slate-500">Stock movements and expense links.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500">
                <th className="py-3 px-5">When</th>
                <th className="py-3 px-5">Item</th>
                <th className="py-3 px-5">Type</th>
                <th className="py-3 px-5 text-right">Qty</th>
                <th className="py-3 px-5">Batch</th>
                <th className="py-3 px-5">Notes</th>
                <th className="py-3 px-5">Expense?</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr><td colSpan="7" className="py-12 text-center text-slate-400">No stock movements yet.</td></tr>
              )}
              {transactions.map((t) => {
                const item = items.find((i) => i.id === t.item_id)
                const batch = batches.find((b) => b.id === t.batch_id)
                return (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="py-3 px-5 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-5 font-medium">{item?.name || `Item #${t.item_id}`}</td>
                    <td className="py-3 px-5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'restock' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-semibold">{t.qty.toLocaleString()}</td>
                    <td className="py-3 px-5">{batch?.name || '—'}</td>
                    <td className="py-3 px-5 text-slate-600">{t.notes || '—'}</td>
                    <td className="py-3 px-5">{t.creates_expense ? `Yes (₱${(t.total_cost || t.qty * (t.unit_cost || 0)).toLocaleString()})` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}