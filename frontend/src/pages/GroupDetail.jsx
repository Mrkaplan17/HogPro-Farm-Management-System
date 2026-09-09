import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import { Plus, Trash2, Lock, Pencil, Check, X, ArrowLeft, Grid3x3, Users, Printer, Skull, TrendingUp } from 'lucide-react'
import { api } from '../api'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import { MONEY } from '../components/InsightCharts'
import DevCredit from '../components/DevCredit'
import { PageSkeleton } from '../components/Skeleton'
import Modal, { ConfirmDialog } from '../components/Modal'

const EXPENSE_CATEGORIES = ['piglets', 'feed', 'medicine', 'veterinary', 'utilities', 'labor', 'maintenance', 'misc']

export default function GroupDetail() {
  const { id } = useParams()
  const { isAdmin, user } = useAuth()
  const [group, setGroup] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [sales, setSales] = useState([])
  const [mortalities, setMortalities] = useState([])
  const [breakdown, setBreakdown] = useState({})
  const [tab, setTab] = useState(isAdmin ? 'ledger' : 'overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [statement, setStatement] = useState(null)
  const [closeTarget, setCloseTarget] = useState(false)

  const isLocked = group?.status === 'closed'
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const totalRevenue = sales.reduce((s, x) => s + x.total_revenue, 0)
  const totalHeadsLost = mortalities.reduce((s, m) => s + m.head_count, 0)
  const totalHeadsSold = sales.reduce((s, x) => s + x.heads_sold, 0)

  useEffect(() => { loadAll() }, [id, isAdmin])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [g, e, m, s, b] = await Promise.all([
        api.getBatch(id),
        api.getExpenses(id),
        api.getMortalities(id),
        isAdmin ? api.getSales(id) : Promise.resolve([]),
        isAdmin ? api.getExpenseBreakdown(id) : Promise.resolve({}),
      ])
      setGroup(g)
      setExpenses(e)
      setMortalities(m)
      setSales(s)
      setBreakdown(b)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showReport && !statement) {
      api.getStatement(id).then(setStatement).catch(() => {})
    }
  }, [showReport, id])

  const tabs = [
    ...(isAdmin ? [{ key: 'ledger', label: 'Ledger' }] : []),
    { key: 'overview', label: 'Overview' },
    { key: 'cages', label: `Cages (${group?.cages?.length || 0})` },
    { key: 'expenses', label: `Expenses (${expenses.length})` },
    ...(isAdmin ? [{ key: 'sales', label: `Sales (${sales.length})` }] : []),
    { key: 'mortalities', label: `Deaths (${mortalities.length})` },
  ]

  if (loading) return <PageSkeleton cards={3} />
  if (error) return <div className="p-8 max-w-7xl mx-auto text-red-500">Error: {error}</div>
  if (!group) return <div className="p-8 max-w-7xl mx-auto text-slate-500">Group not found</div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {showReport && (
        <ReportOverlay
          statement={statement}
          batchName={group?.name}
          ownerName={user?.full_name || ''}
          onClose={() => { setShowReport(false); setStatement(null) }}
        />
      )}

      <div>
        <Link to="/operations" className="text-sm text-slate-500 hover:text-pink-600 inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Back to operations
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{group.name}</h1>
            <StatusBadge status={group.status} />
            {isLocked && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <Lock className="w-3 h-3" /> Locked history
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowReport(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                <Printer className="w-4 h-4" /> Print Report
              </button>
            )}
            {isAdmin && !isLocked && (
              <button
                onClick={() => {
                  if (group.current_head_count > 0) {
                    alert(`Cannot close: ${group.current_head_count} heads still remaining. Record all sales first.`)
                    return
                  }
                  setCloseTarget(true)
                }}
                className="px-4 py-2 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 font-medium"
              >
                Close & Lock
              </button>
            )}
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { label: 'Heads in', value: group.initial_head_count },
            { label: 'Heads left', value: group.current_head_count },
            { label: 'Heads sold', value: totalHeadsSold },
            { label: 'Heads lost', value: totalHeadsLost },
            { label: 'Cages', value: group.cages?.length || 0 },
            { label: 'Expenses', value: MONEY(totalExpenses), tone: 'red' },
            { label: 'Revenue', value: MONEY(totalRevenue), tone: 'green' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className={`text-lg font-bold mt-1 ${s.tone === 'red' ? 'text-red-600' : s.tone === 'green' ? 'text-green-600' : 'text-slate-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Heads in', value: group.initial_head_count },
            { label: 'Heads left', value: group.current_head_count },
            { label: 'Heads lost', value: totalHeadsLost },
            { label: 'Cages', value: group.cages?.length || 0 },
            { label: 'Expenses', value: MONEY(totalExpenses), tone: 'red' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className={`text-lg font-bold mt-1 ${s.tone === 'red' ? 'text-red-600' : 'text-slate-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-pink-600 text-pink-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ledger' && isAdmin && (
        <LedgerSection
          expenses={expenses}
          sales={sales}
          isLocked={isLocked}
        />
      )}

      {tab === 'overview' && (
        <OverviewSection
          isAdmin={isAdmin}
          breakdown={breakdown}
          expenses={expenses}
          sales={sales}
          group={group}
          totalHeadsLost={totalHeadsLost}
        />
      )}

      {tab === 'cages' && (
        <CagesSection group={group} isLocked={isLocked} isAdmin={isAdmin} loadAll={loadAll} />
      )}

      {tab === 'expenses' && (
        <ExpensesSection batchId={id} expenses={expenses} cages={group.cages} isLocked={isLocked} isAdmin={isAdmin} loadAll={loadAll} />
      )}

      {tab === 'sales' && isAdmin && (
        <SalesSection batchId={id} sales={sales} expenses={expenses} cages={group.cages} isLocked={isLocked} remainingHeads={group.current_head_count} marketPrice={group.market_price_per_kg || 140} loadAll={loadAll} />
      )}

      {tab === 'mortalities' && (
        <MortalitiesSection batchId={id} mortalities={mortalities} cages={group.cages} isLocked={isLocked} isAdmin={isAdmin} loadAll={loadAll} />
      )}

      <ConfirmDialog
        open={closeTarget}
        onClose={() => setCloseTarget(false)}
        onConfirm={async () => {
          try { await api.closeBatch(group.id); setCloseTarget(false); loadAll() } catch (e) { setCloseTarget(false); alert(e.message) }
        }}
        title="Close and lock this group?"
        message="All records become read-only history. This cannot be undone."
        confirmLabel="Close & Lock"
        danger
      />
    </div>
  )
}

/* ─────────── OVERVIEW ─────────── */

function OverviewSection({ isAdmin, breakdown, expenses, sales, group, totalHeadsLost }) {
  const expList = expenses || []
  const saleList = sales || []

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const inMonth = (d) => String(d).substring(0, 7) === monthKey
  const monthRevenue = saleList.filter((s) => inMonth(s.sale_date)).reduce((s, x) => s + x.total_revenue, 0)
  const monthExpenses = expList.filter((e) => inMonth(e.date)).reduce((s, x) => s + x.amount, 0)
  const monthNet = monthRevenue - monthExpenses

  const CAT_TITLES = {
    piglets: 'Piglets (stock)', feed: 'Feed', medicine: 'Medicine', veterinary: 'Veterinary',
    utilities: 'Utilities', labor: 'Labor', maintenance: 'Maintenance', misc: 'Miscellaneous',
  }
  const breakdownRows = Object.entries(breakdown || {}).sort((a, b) => b[1] - a[1])
  const breakdownTotal = breakdownRows.reduce((s, [, v]) => s + v, 0)

  const recent = [
    ...saleList.map((s) => ({
      id: `sale-${s.id}`, date: s.sale_date, type: 'Sale', credit: true,
      title: `${s.heads_sold} heads · ${s.weight_kg.toLocaleString()} kg`, amount: s.total_revenue,
    })),
    ...expList.map((e) => ({
      id: `exp-${e.id}`, date: e.date, type: CAT_TITLES[e.category] || e.category, credit: false,
      title: e.description, amount: e.amount,
    })),
  ].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0)).slice(0, 8)

  if (!isAdmin) {
    const recentExpenses = expList.slice(0, 8)
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Heads left', value: group.current_head_count },
            { label: 'Heads lost', value: totalHeadsLost },
            { label: 'Cages', value: group.cages?.length || 0 },
            { label: 'Total expenses', value: MONEY(expList.reduce((s, e) => s + e.amount, 0)) },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className="text-lg font-bold mt-1 text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Expenses</h2>
              <p className="text-sm text-slate-500">Latest expenses recorded in this group.</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500">
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Category</th>
                <th className="py-3 px-5">Description</th>
                <th className="py-3 px-5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentExpenses.length === 0 && <tr><td colSpan="4" className="py-12 text-center text-slate-400">No expenses recorded yet.</td></tr>}
              {recentExpenses.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="py-3 px-5">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="py-3 px-5"><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 capitalize">{CAT_TITLES[e.category] || e.category}</span></td>
                  <td className="py-3 px-5 text-slate-600">{e.description}</td>
                  <td className="py-3 px-5 text-right text-red-600 font-medium">{MONEY(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-4">This Month</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Revenue</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{MONEY(monthRevenue)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs text-red-700 font-semibold uppercase tracking-wide">Expenses</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{MONEY(monthExpenses)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Net income</p>
            <p className={`text-2xl font-bold mt-1 ${monthNet >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{MONEY(monthNet)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          {[
            { label: 'Heads in', value: group.initial_head_count },
            { label: 'Heads left', value: group.current_head_count },
            { label: 'Heads sold', value: totalHeadsSold },
            { label: 'Heads lost', value: totalHeadsLost },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className="text-xl font-bold mt-1 text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-900">Expense Breakdown</h2>
          <p className="text-sm text-slate-500">Where this group's money went, by category.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-500">
              <th className="py-3 px-5">Category</th>
              <th className="py-3 px-5 text-right">Amount</th>
              <th className="py-3 px-5 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {breakdownRows.length === 0 && <tr><td colSpan="3" className="py-12 text-center text-slate-400">No expenses recorded yet.</td></tr>}
            {breakdownRows.map(([cat, amt]) => (
              <tr key={cat} className="border-t border-slate-100">
                <td className="py-3 px-5 capitalize">{CAT_TITLES[cat] || cat}</td>
                <td className="py-3 px-5 text-right text-red-600">{MONEY(amt)}</td>
                <td className="py-3 px-5 text-right text-slate-500">{breakdownTotal > 0 ? `${Math.round((amt / breakdownTotal) * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
          {breakdownTotal > 0 && (
            <tfoot className="bg-slate-50 font-semibold">
              <tr className="border-t border-slate-200">
                <td className="py-3 px-5">Total</td>
                <td className="py-3 px-5 text-right text-red-600">{MONEY(breakdownTotal)}</td>
                <td className="py-3 px-5 text-right">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          <p className="text-sm text-slate-500">Latest sales and expenses.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-500">
              <th className="py-3 px-5">Date</th>
              <th className="py-3 px-5">Type</th>
              <th className="py-3 px-5">Details</th>
              <th className="py-3 px-5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && <tr><td colSpan="4" className="py-12 text-center text-slate-400">No activity yet.</td></tr>}
            {recent.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-3 px-5">{new Date(r.date).toLocaleDateString()}</td>
                <td className="py-3 px-5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.credit ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                    {r.type}
                  </span>
                </td>
                <td className="py-3 px-5 text-slate-600">{r.title}</td>
                <td className={`py-3 px-5 text-right font-medium ${r.credit ? 'text-green-600' : 'text-red-600'}`}>
                  {`${r.credit ? '+' : '−'}${MONEY(r.amount)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────── LEDGER ─────────── */

function LedgerSection({ expenses, sales, isLocked }) {
  const rows = [
    ...sales.map((s) => ({
      id: `sale-${s.id}`,
      date: s.sale_date,
      type: 'credit',
      title: 'Sale',
      detail: `${s.heads_sold} heads · ${s.weight_kg.toLocaleString()} kg @ ₱${s.price_per_kilo}/kg`,
      extra: s.buyer_name || '',
      amount: s.total_revenue,
    })),
    ...expenses.map((e) => ({
      id: `exp-${e.id}`,
      date: e.date,
      type: 'debit',
      title: e.category,
      detail: e.description,
      extra: '',
      amount: e.amount,
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  let running = 0
  const withBalance = rows.map((r) => {
    running += r.type === 'credit' ? r.amount : -r.amount
    return { ...r, balance: running }
  })
  const displayed = [...withBalance].reverse()

  const totalCredit = sales.reduce((s, x) => s + x.total_revenue, 0)
  const totalDebit = expenses.reduce((s, x) => s + x.amount, 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Ledger</h2>
          <p className="text-sm text-slate-500">Every transaction in this group, oldest to newest, with running balance.</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-slate-500">Revenue <span className="text-green-600 font-semibold ml-1">₱{totalCredit.toLocaleString()}</span></p>
          <p className="text-slate-500">All Costs <span className="text-red-600 font-semibold ml-1">₱{totalDebit.toLocaleString()}</span></p>
          <p className="font-semibold text-slate-900">Net balance <span className={`ml-1 ${running >= 0 ? 'text-green-600' : 'text-red-600'}`}>₱{running.toLocaleString()}</span></p>
        </div>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-700 px-5 py-3 text-sm flex items-center gap-2">
          <Lock className="w-4 h-4" /> Locked group — records are permanent history.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-500">
              <th className="py-3 px-5">Date</th>
              <th className="py-3 px-5">Transaction</th>
              <th className="py-3 px-5">Details</th>
              <th className="py-3 px-5 text-right">Out (₱)</th>
              <th className="py-3 px-5 text-right">In (₱)</th>
              <th className="py-3 px-5 text-right">Balance (₱)</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 && (
              <tr><td colSpan="6" className="py-12 text-center text-slate-400">No transactions yet. Add expenses or record a sale to build the ledger.</td></tr>
            )}
            {displayed.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-3 px-5 whitespace-nowrap">{new Date(r.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                <td className="py-3 px-5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                    {r.type === 'credit' ? 'Sale' : r.title.charAt(0).toUpperCase() + r.title.slice(1)}
                  </span>
                </td>
                <td className="py-3 px-5 text-slate-600">{r.detail}{r.extra ? <span className="text-slate-400"> · {r.extra}</span> : null}</td>
                <td className="py-3 px-5 text-right text-red-600">{r.type === 'debit' && r.amount > 0 ? `₱${r.amount.toLocaleString()}` : ''}</td>
                <td className="py-3 px-5 text-right text-green-600">{r.type === 'credit' ? `₱${r.amount.toLocaleString()}` : ''}</td>
                <td className={`py-3 px-5 text-right font-semibold ${r.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>₱{r.balance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          {displayed.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td colSpan="3" className="py-3 px-5">Totals</td>
                <td className="py-3 px-5 text-right text-red-600">₱{totalDebit.toLocaleString()}</td>
                <td className="py-3 px-5 text-right text-green-600">₱{totalCredit.toLocaleString()}</td>
                <td className={`py-3 px-5 text-right ${running >= 0 ? 'text-green-600' : 'text-red-600'}`}>₱{running.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

/* ─────────── CAGES ─────────── */

function CagesSection({ group, isLocked, isAdmin, loadAll }) {
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [form, setForm] = useState({ name: '', head_count: '' })
  const [editForm, setEditForm] = useState({ name: '', head_count: '' })
  const canEdit = isAdmin && !isLocked

  async function submitAdd(e) {
    e.preventDefault()
    try {
      await api.createCage(group.id, { name: form.name.trim(), head_count: parseInt(form.head_count) })
      setAdding(false)
      setForm({ name: '', head_count: '' })
      loadAll()
    } catch (err) { alert(err.message) }
  }

  async function submitEdit(e) {
    e.preventDefault()
    try {
      await api.updateCage(editId, { name: editForm.name.trim(), head_count: parseInt(editForm.head_count) })
      setEditId(null)
      loadAll()
    } catch (err) { alert(err.message) }
  }

  async function remove(cid) {
    try { await api.deleteCage(cid); loadAll() } catch (err) { alert(err.message) }
  }

  const cageTotal = (group.cages || []).reduce((s, c) => s + c.head_count, 0)

  return (
    <div className="space-y-4">
      {(isLocked || !isAdmin) && (
        <div className={`border rounded-xl p-4 text-sm flex items-center gap-2 ${isLocked ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
          {isLocked ? <Lock className="w-4 h-4" /> : null} {isLocked ? 'Locked group — cage layout is fixed history.' : 'Cage structure is managed by admins.'}
        </div>
      )}
      {canEdit && (
        <div className="flex justify-end">
          {!adding ? (
            <button onClick={() => setAdding(true)} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
              <Plus className="w-4 h-4" /> Add Cage
            </button>
          ) : (
            <form onSubmit={submitAdd} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-2 w-full flex-wrap">
              <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cage name (e.g. Cage 1)" className="flex-1 min-w-[180px] border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <input required type="number" min="1" value={form.head_count} onChange={(e) => setForm({ ...form, head_count: e.target.value })} placeholder="Heads" className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <button type="submit" className="px-4 py-2 text-sm text-white bg-pink-600 hover:bg-pink-700 rounded-lg font-semibold">Save</button>
              <button type="button" onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg"><X className="w-4 h-4" /></button>
            </form>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Cage layout</h2>
          </div>
          <span className="text-sm text-slate-500">
            <strong className="text-slate-900">{cageTotal}</strong> heads across <strong className="text-slate-900">{group.cages?.length || 0}</strong> cages
          </span>
        </div>
        {(group.cages || []).length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No cages yet. {isAdmin && 'Add cages to split this group into smaller sub-groups.'}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(group.cages || []).map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between bg-slate-50/50">
                {editId === c.id ? (
                  <form onSubmit={submitEdit} className="flex items-center gap-2 flex-1">
                    <input autoFocus value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-24 border border-pink-400 rounded-lg px-2 py-1 text-sm" />
                    <input type="number" min="1" value={editForm.head_count} onChange={(e) => setEditForm({ ...editForm, head_count: e.target.value })} className="w-16 border border-pink-400 rounded-lg px-2 py-1 text-sm" />
                    <button type="submit" className="text-green-600"><Check className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setEditId(null)} className="text-slate-400"><X className="w-4 h-4" /></button>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-900 text-white rounded-lg p-2"><Users className="w-4 h-4" /></div>
                      <div>
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.head_count} heads</p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditId(c.id); setEditForm({ name: c.name, head_count: c.head_count }) }} className="p-1.5 text-slate-400 hover:text-pink-600"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setRemoveTarget(c)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => { remove(removeTarget.id); setRemoveTarget(null) }}
        title="Remove this cage?"
        message={`"${removeTarget?.name}" and its piglets will be removed from the group.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  )
}

/* ─────────── EXPENSES ─────────── */

function ExpensesSection({ batchId, expenses, cages, isLocked, isAdmin, loadAll }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: 'piglets', description: '', quantity: '', unit_price: '', date: new Date().toISOString().split('T')[0], cage_id: '' })
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const isPiglets = form.category === 'piglets'
  const lineTotal = (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0)
  const pigletHeads = isPiglets ? parseInt(form.quantity) || 0 : 0
  const usedCageIds = new Set((expenses || []).filter((e) => e.category === 'piglets').map((e) => e.cage_id))
  const availableCages = (cages || []).filter((c) => !usedCageIds.has(c.id))

  async function submit(e) {
    e.preventDefault()
    if (isPiglets) {
      if (!form.cage_id) return alert('Pick a cage for the piglets — each cage is one group.')
      if (!(pigletHeads > 0)) return alert('Enter how many piglets (quantity) were bought.')
    }
    if (!(parseFloat(form.quantity) > 0)) return alert('Enter a quantity (for piglets, the number of heads).')
    if (!(lineTotal > 0)) return alert('Enter a unit price so the total cost can be computed.')
    const payload = {
      ...form,
      quantity: parseFloat(form.quantity),
      unit_price: parseFloat(form.unit_price),
      cage_id: isPiglets ? parseInt(form.cage_id) : null,
    }
    try {
      await api.createExpense({ ...payload, batch_id: batchId })
      setShowForm(false)
      setForm({ category: 'piglets', description: '', quantity: '', unit_price: '', date: new Date().toISOString().split('T')[0], cage_id: '' })
      loadAll()
    } catch (err) { alert(err.message) }
  }

  function cageName(id) {
    return cages?.find((c) => c.id === id)?.name || '—'
  }

  function qtyLabel(e) {
    if (e.category === 'piglets') return `${e.head_count} heads`
    return Number(e.quantity).toLocaleString()
  }

  return (
    <div className="space-y-4">
      {isLocked && <LockedNotice />}
      {!isLocked && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      )}
      <Modal open={showForm && !isLocked} onClose={() => setShowForm(false)} title="Add Expense" subtitle="Record a cost against this group" maxWidth="max-w-2xl" icon={<Plus className="w-5 h-5" />}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            {isPiglets && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Group / Cage</label>
                <select value={form.cage_id} onChange={(e) => setForm({ ...form, cage_id: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select cage…</option>
                  {availableCages.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.head_count} heads)</option>)}
                </select>
                {availableCages.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Every cage already has a piglet cost recorded — one piglet purchase per cage.</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{isPiglets ? 'Heads bought (quantity)' : 'Quantity'}</label>
              <input required type="number" step="0.01" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder={isPiglets ? 'e.g. 10' : 'e.g. 50'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{isPiglets ? 'Price per head (₱)' : 'Unit price (₱)'}</label>
              <input required type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. 1500" />
            </div>
          </div>

          <p className="text-sm text-slate-600">
            Total cost: <strong className="text-red-600">₱{lineTotal.toLocaleString()}</strong>
            {isPiglets && (
              <span className="text-slate-400"> — recorded against {cageName(parseInt(form.cage_id)) || 'the selected cage'}. Inventory is managed in the Cages tab.</span>
            )}
          </p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm text-white bg-pink-600 rounded-lg font-semibold">Save Expense</button>
          </div>
        </form>
      </Modal>
      <SectionCard title="Expense records" right={<span className="text-slate-600">Total · <strong className="text-red-600">₱{total.toLocaleString()}</strong></span>}>
        <DataTable
          headers={['Date', 'Category', 'Description', 'Group / Cage', 'Qty', 'Unit ₱', 'Amount']}
          rows={expenses}
          locked={isLocked}
          empty="No expenses recorded for this group."
          alignRight={['Qty', 'Unit ₱', 'Amount']}
          renderRow={(e) => [
            new Date(e.date).toLocaleDateString(),
            <span key="c" className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">{e.category}</span>,
            e.description,
            e.category === 'piglets' ? cageName(e.cage_id) : '—',
            qtyLabel(e),
            <span key="u" className="text-slate-600">₱{Number(e.unit_price || 0).toLocaleString()}</span>,
            <span key="a" className="font-medium text-red-600">₱{e.amount.toLocaleString()}</span>,
          ]}
          onDelete={!isAdmin ? null : isLocked ? null : async (e) => { await api.deleteExpense(e.id); loadAll() }}
          confirmDelete={{ title: 'Delete this expense?', message: 'This expense entry will be permanently removed from the ledger.' }}
        />
      </SectionCard>
    </div>
  )
}

/* ─────────── SALES (admin, item-based) ─────────── */

function SalesSection({ batchId, sales, expenses, cages, isLocked, remainingHeads, marketPrice, loadAll }) {
  const [showForm, setShowForm] = useState(false)
  const [items, setItems] = useState([{ cage_id: '', tag_id: '', head_count: 1, live_weight_kg: '', price_per_kilo: marketPrice }])
  const [form, setForm] = useState({ sale_date: new Date().toISOString().split('T')[0], buyer_name: '', buyer_contact: '', notes: '' })
  const totalRevenue = sales.reduce((s, x) => s + x.total_revenue, 0)
  const totalHeadsSold = sales.reduce((s, x) => s + x.heads_sold, 0)

  const pigletExpenses = (expenses || []).filter((e) => e.category === 'piglets')
  const pigletHeads = pigletExpenses.reduce((s, e) => s + (e.head_count || 0), 0)
  const pigletCost = pigletExpenses.reduce((s, e) => s + e.amount, 0)
  const buyPerHead = pigletHeads > 0 ? pigletCost / pigletHeads : 0
  const overallSellPerHead = totalHeadsSold > 0 ? totalRevenue / totalHeadsSold : 0

  const sellableCages = (cages || []).filter((c) => (c.head_count || 0) > 0)
  const headsAvailable = sellableCages.length > 0 ? sellableCages.reduce((s, c) => s + (c.head_count || 0), 0) : (remainingHeads || 0)
  const cageHeads = (id) => {
    const c = (cages || []).find((cc) => cc.id === Number(id))
    return c ? (c.head_count || 0) : 0
  }

  function updateItem(idx, field, val) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }
  function addItem() {
    setItems((prev) => [...prev, { cage_id: '', tag_id: '', head_count: 1, live_weight_kg: '', price_per_kilo: marketPrice }])
  }
  function removeItem(idx) {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const itemsSummary = items.map((it) => {
    const hc = parseInt(it.head_count) || 0
    const lw = parseFloat(it.live_weight_kg) || 0
    const ppk = parseFloat(it.price_per_kilo) || 0
    return { ...it, head_count: hc, live_weight_kg: lw, price_per_kilo: ppk, amount: lw * ppk }
  })
  const sumHeads = itemsSummary.reduce((s, x) => s + x.head_count, 0)
  const sumWeight = itemsSummary.reduce((s, x) => s + x.live_weight_kg, 0)
  const sumRevenue = itemsSummary.reduce((s, x) => s + x.amount, 0)
  const avgPrice = sumWeight > 0 ? sumRevenue / sumWeight : 0
  const formSellPerHead = sumHeads > 0 ? sumRevenue / sumHeads : 0
  const overWarning = itemsSummary.some((it) => it.cage_id && it.head_count > cageHeads(it.cage_id))

  const headers = ['Tag ID', 'Cage', 'Heads', 'Total Wt (kg)', '₱/kg', 'Amount', '']

  async function submit(e) {
    e.preventDefault()
    if (!(sumHeads > 0)) return alert('Enter at least one head to sell.')
    for (const it of itemsSummary) {
      if (!it.cage_id) return alert('Select a cage for every line item.')
      const left = cageHeads(it.cage_id)
      if (it.head_count > left) return alert(`That cage only has ${left} head${left === 1 ? '' : 's'} left.`)
    }
    if (!(sumRevenue > 0)) return alert('Enter a total weight and ₱/kg for at least one line item.')
    try {
      await api.createSale({
        batch_id: parseInt(batchId),
        heads_sold: sumHeads,
        weight_kg: sumWeight,
        price_per_kilo: avgPrice,
        total_revenue: sumRevenue,
        buyer_name: form.buyer_name,
        buyer_contact: form.buyer_contact,
        sale_date: form.sale_date,
        notes: form.notes,
        items: itemsSummary.map((it) => ({
          cage_id: it.cage_id ? parseInt(it.cage_id) : null,
          tag_id: it.tag_id || '',
          head_count: it.head_count,
          live_weight_kg: it.live_weight_kg,
          price_per_kilo: it.price_per_kilo,
          amount: it.amount,
        })),
      })
      setShowForm(false)
      setItems([{ cage_id: '', tag_id: '', head_count: 1, live_weight_kg: '', price_per_kilo: marketPrice }])
      setForm({ sale_date: new Date().toISOString().split('T')[0], buyer_name: '', buyer_contact: '', notes: '' })
      loadAll()
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-4">
      {isLocked && <LockedNotice />}
      {!isLocked && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
            <Plus className="w-4 h-4" /> Record Sale
          </button>
        </div>
      )}
      <Modal open={showForm && !isLocked} onClose={() => setShowForm(false)} title="Record Sale" subtitle="Sell heads from this group" maxWidth="max-w-4xl" icon={<TrendingUp className="w-5 h-5" />}>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-500">
              Heads available to sell: <strong className="text-slate-900">{headsAvailable}</strong>
              {sellableCages.length === 0 && <span className="text-amber-600"> (no cages with heads left — set stock in the Cages tab)</span>}
            </p>
          </div>
          <p className="text-sm text-slate-500">Per kilo: enter the <strong>total weight of the heads being sold</strong> on each line (e.g. 7 heads totaling 610 kg), and the price per kg. Revenue = total weight × ₱/kg.</p>

          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-slate-500 px-1">
            {headers.map((h) => <div key={h} className={h === 'Amount' ? 'text-right' : ''}>{h}</div>)}
          </div>
          {items.map((it, idx) => {
            const amt = (parseFloat(it.live_weight_kg) || 0) * (parseFloat(it.price_per_kilo) || 0)
            const over = it.cage_id && ((parseInt(it.head_count) || 0) > cageHeads(it.cage_id))
            return (
              <div key={idx} className="grid grid-cols-7 gap-2 items-center">
                <input value={it.tag_id} onChange={(e) => updateItem(idx, 'tag_id', e.target.value)} placeholder={`Tag ${idx + 1}`} className="col-span-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                <select value={it.cage_id} onChange={(e) => updateItem(idx, 'cage_id', e.target.value ? parseInt(e.target.value) : '')} className="col-span-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
                  <option value="">—</option>
                  {sellableCages.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.head_count} head{c.head_count === 1 ? '' : 's'} left)</option>)}
                </select>
                <input type="number" min="1" value={it.head_count} onChange={(e) => updateItem(idx, 'head_count', e.target.value)} className={`col-span-1 border rounded-lg px-2 py-1.5 text-sm ${over ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} />
                <input type="number" step="0.1" min="0" value={it.live_weight_kg} onChange={(e) => updateItem(idx, 'live_weight_kg', e.target.value)} className="col-span-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" placeholder="kg" />
                <input type="number" step="0.01" min="0" value={it.price_per_kilo} onChange={(e) => updateItem(idx, 'price_per_kilo', e.target.value)} className="col-span-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                <span className="col-span-1 text-right text-sm font-medium text-green-600">₱{amt.toLocaleString()}</span>
                <button type="button" onClick={() => removeItem(idx)} className="col-span-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            )
          })}
          {overWarning && <p className="text-xs text-red-500">Heads sold on a line exceed that cage's remaining heads. Lower the head count or pick another cage.</p>}
          <button type="button" onClick={addItem} className="text-sm text-pink-600 hover:text-pink-700 font-medium inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add another line item
          </button>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heads sold</label>
              <p className="font-bold text-lg text-slate-900">{sumHeads}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Weight (kg total)</label>
              <p className="font-bold text-lg text-slate-900">{sumWeight.toLocaleString()}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Avg price</label>
              <p className="font-bold text-lg text-slate-900">₱{avgPrice.toFixed(2)}/kg</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total revenue</label>
              <p className="font-bold text-lg text-green-600">₱{sumRevenue.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 bg-slate-50 rounded-xl p-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Piglet buy price</label>
              <p className="font-bold text-lg text-slate-900">{pigletHeads > 0 ? `₱${buyPerHead.toFixed(2)}/head` : '— add piglet purchases'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Your selling avg (this sale)</label>
              <p className="font-bold text-lg text-green-600">{sumHeads > 0 ? `₱${formSellPerHead.toFixed(2)}/head` : '—'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Margin per head</label>
              <p className={`font-bold text-lg ${formSellPerHead - buyPerHead >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pigletHeads > 0 && sumHeads > 0 ? `₱${(formSellPerHead - buyPerHead).toFixed(2)}` : '—'}
              </p>
            </div>
          </div>
          {overallSellPerHead > 0 && buyPerHead > 0 && (
            <p className="text-xs text-slate-500">
              Earlier sales averaged <strong>₱{overallSellPerHead.toFixed(2)}/head</strong> vs buy price <strong>₱{buyPerHead.toFixed(2)}/head</strong> → tracked profit per head <strong className="text-green-600">₱{(overallSellPerHead - buyPerHead).toFixed(2)}</strong>.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sale date</label>
              <input required type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Buyer name</label>
              <input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Buyer contact</label>
              <input value={form.buyer_contact} onChange={(e) => setForm({ ...form, buyer_contact: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" rows="2" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm text-white bg-green-600 rounded-lg font-semibold">Save Sale</button>
          </div>
        </form>
      </Modal>

      <SectionCard title="Sales records" right={<span className="text-slate-600">Revenue · <strong className="text-green-600">₱{totalRevenue.toLocaleString()}</strong> ({totalHeadsSold} heads)</span>}>
        <DataTable
          headers={['Date', 'Heads', 'Weight', 'Price', 'Revenue', 'Buyer', 'Items']}
          rows={sales}
          locked={isLocked}
          empty="No sales recorded for this group."
          alignRight={['Heads', 'Weight', 'Price', 'Revenue']}
          renderRow={(s) => {
            const priceLabel = s.price_per_kilo > 0 ? `₱${s.price_per_kilo}/kg` : '—'
            return [
              new Date(s.sale_date).toLocaleDateString(),
              s.heads_sold,
              s.weight_kg > 0 ? `${s.weight_kg.toLocaleString()} kg` : '—',
              priceLabel,
              <span key="r" className="font-medium text-green-600">₱{s.total_revenue.toLocaleString()}</span>,
              s.buyer_name || '—',
              s.items?.length > 0 ? <span key="it" className="text-xs text-slate-500">{s.items.length} line{s.items.length > 1 ? 's' : ''}</span> : '—',
            ]
          }}
          onDelete={isLocked ? null : async (s) => { await api.deleteSale(s.id); loadAll() }}
          confirmDelete={{ title: 'Delete this sale?', message: 'This sale will be removed and heads restored to the selected cages.' }}
        />
      </SectionCard>
    </div>
  )
}

/* ─────────── MORTALITIES ─────────── */

function MortalitiesSection({ batchId, mortalities, cages, isLocked, isAdmin, loadAll }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], head_count: '', cause: '', cage_id: '', notes: '' })
  const totalLost = mortalities.reduce((s, m) => s + m.head_count, 0)

  async function submit(e) {
    e.preventDefault()
    try {
      await api.createMortality({
        batch_id: parseInt(batchId),
        cage_id: form.cage_id ? parseInt(form.cage_id) : null,
        date: form.date,
        head_count: parseInt(form.head_count),
        cause: form.cause,
        notes: form.notes,
      })
      setShowForm(false)
      setForm({ date: new Date().toISOString().split('T')[0], head_count: '', cause: '', cage_id: '', notes: '' })
      loadAll()
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-4">
      {isLocked && <LockedNotice />}
      {!isLocked && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
            <Skull className="w-4 h-4" /> Log Mortality
          </button>
        </div>
      )}
      <Modal open={showForm && !isLocked} onClose={() => setShowForm(false)} title="Log Mortality" subtitle="Record heads lost in this group" maxWidth="max-w-xl" icon={<Skull className="w-5 h-5" />}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heads lost</label>
              <input required type="number" min="1" value={form.head_count} onChange={(e) => setForm({ ...form, head_count: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cage (optional)</label>
              <select value={form.cage_id} onChange={(e) => setForm({ ...form, cage_id: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Unknown</option>
                {(cages || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cause</label>
              <input value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Disease, injury" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm text-white bg-red-500 rounded-lg font-semibold">Log Mortality</button>
          </div>
        </form>
      </Modal>

      <SectionCard title="Mortality log" right={<span className="text-slate-600">Total lost · <strong className="text-red-600">{totalLost}</strong> heads</span>}>
        <DataTable
          headers={['Date', 'Cage', 'Heads', 'Cause', 'Notes']}
          rows={mortalities}
          locked={isLocked}
          empty="No mortality recorded for this group."
          alignRight={['Heads']}
          renderRow={(m) => [
            new Date(m.date).toLocaleDateString(),
            cages?.find((c) => c.id === m.cage_id)?.name || '—',
            <span key="h" className="font-medium text-red-600">{m.head_count}</span>,
            m.cause || '—',
            m.notes || '—',
          ]}
          onDelete={!isAdmin ? null : isLocked ? null : async (m) => { await api.deleteMortality(m.id); loadAll() }}
          confirmDelete={{ title: 'Delete this mortality record?', message: 'The lost heads will be restored to the group.' }}
        />
      </SectionCard>
    </div>
  )
}

/* ─────────── REPORT OVERLAY ─────────── */

function ReportOverlay({ statement, batchName, ownerName, onClose }) {
  if (!statement) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl p-12 text-slate-500" onClick={(e) => e.stopPropagation()}>
          <p className="text-center">Loading statement…</p>
        </div>
      </div>
    )
  }

  const b = statement
  const batch = b.batch
  const statusLabel = batch.status === 'active' ? 'Active' : batch.status === 'closed' ? 'Closed' : batch.status
  const createdDate = batch.created_at ? String(batch.created_at).slice(0, 10) : '—'
  const lockDate = batch.status === 'closed' && batch.closed_at ? String(batch.closed_at).slice(0, 10) : '—'
  const displayName = ownerName || 'Farm Owner'

  function handlePrint() {
    const prevTitle = document.title
    const safeName = (batch.name || 'Batch').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_')
    document.title = `${safeName}_Batch_Performance_Report`
    window.print()
    document.title = prevTitle
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-12 px-4 print-overlay" onClick={onClose}>
      <div className="print-area bg-white rounded-2xl shadow-2xl w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        {/* Header toolbar — hidden on print */}
          <div className="no-print flex items-center justify-between px-8 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Profit &amp; Loss Statement</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 text-sm bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-semibold">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">Close</button>
          </div>
        </div>

        {/* Document body */}
        <div className="px-10 py-8 print-body">

          {/* 1. Company/Farm header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-lg">
                H
              </div>
              <div>
                <p className="text-base font-bold text-slate-900 leading-tight">HogPros Farm Management</p>
                <p className="text-xs text-slate-500">Batch Performance &amp; Financial Reporting</p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-semibold text-slate-700">Farm Report · CONFIDENTIAL</p>
              <p>Generated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* 2. Document title + period */}
          <div className="py-4">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Batch Performance &amp; Financial Report</h1>
            <p className="mt-1 text-sm font-semibold text-cyan-600">
              Reporting Period: {batch.start_date} — {b.period_end}
            </p>
          </div>

          {/* 3. Metadata grid */}
          <div className="report-meta-grid">
            <MetaField label="Batch Name" value={batch.name} />
            <MetaField label="Status" value={statusLabel} accent />
            <MetaField label="Creation Date" value={createdDate} />
            <MetaField label="Lock Date" value={lockDate} />
          </div>

          {/* 4. Production + Financial blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div className="report-card">
              <div className="card-head flex items-center gap-2 border-b border-slate-200 px-5 py-3 bg-slate-50/70 rounded-t-lg">
                <span className="w-1.5 h-4 rounded bg-pink-600"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Production</h3>
              </div>
              <table className="w-full text-sm detail-table"><tbody>
                <Row label="Initial heads" value={batch.initial_head_count} />
                <Row label="Current heads" value={batch.current_head_count} />
                <Row label="Heads sold" value={b.heads_sold} />
                <Row label="Heads lost (mortality)" value={b.heads_lost} />
                <Row label="Weight sold" value={`${b.total_weight_kg.toLocaleString()} kg`} />
                <Row label="Avg selling price" value={`₱${b.avg_selling_price_kg.toFixed(2)}/kg`} bold />
                <Row label="Piglets bought" value={b.piglet_heads} bold />
                <Row label="Buy price (piglets)" value={b.buy_price_per_head > 0 ? `₱${b.buy_price_per_head.toFixed(2)}/head` : '—'} />
                <Row label="Sell price" value={b.sell_price_per_head > 0 ? `₱${b.sell_price_per_head.toFixed(2)}/head` : '—'} />
                <Row label="Buy → sell gain" value={b.buy_price_per_head > 0 && b.sell_price_per_head > 0 ? `₱${(b.sell_price_per_head - b.buy_price_per_head).toFixed(2)}/head` : '—'} bold green={b.sell_price_per_head - b.buy_price_per_head >= 0} red={b.sell_price_per_head - b.buy_price_per_head < 0} />
              </tbody></table>
            </div>
            <div className="report-card">
              <div className="card-head flex items-center gap-2 border-b border-slate-200 px-5 py-3 bg-slate-50/70 rounded-t-lg">
                <span className="w-1.5 h-4 rounded bg-green-600"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Financial Summary</h3>
              </div>
              <table className="w-full text-sm detail-table"><tbody>
                <Row label="Total revenue" value={`₱${b.total_revenue.toLocaleString()}`} green />
                <Row label="Piglets (stock)" value={`₱${(b.piglet_cost || 0).toLocaleString()}`} red />
                <Row label="Other expenses" value={`₱${(b.other_expenses - (b.piglet_cost || 0)).toLocaleString()}`} red />
                <Row label="Feed cost" value={`₱${(b.feed_cost || 0).toLocaleString()}`} red />
                <Row label="Total expenses" value={`₱${b.total_expenses.toLocaleString()}`} red bold />
                <Row label="Net income" value={`₱${b.net_income.toLocaleString()}`} bold green={b.net_income >= 0} red={b.net_income < 0} />
                <Row label="Profit margin" value={`${b.profit_margin_pct}%`} bold />
              </tbody></table>
            </div>
          </div>

          {/* 5. Sales Detail block — visible only for closed batches */}
          {batch.status === 'closed' && b.sales.length > 0 && (
            <div className="report-card mt-5">
              <div className="card-head flex items-center gap-2 border-b border-slate-200 px-5 py-3 bg-slate-50/70 rounded-t-lg">
                <span className="w-1.5 h-4 rounded bg-blue-600"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Sales Detail</h3>
              </div>
              <table className="w-full text-sm sales-table no-round">
                <thead>
                  <tr className="text-left text-slate-100">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Heads</th>
                    <th className="py-2.5 px-3 text-right">Weight</th>
                    <th className="py-2.5 px-3 text-right">₱/kg</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                    <th className="py-2.5 px-3">Buyer</th>
                  </tr>
                </thead>
                <tbody>
                  {b.sales.map((s, i) => (
                    <tr key={s.id} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                      <td className="py-2.5 px-3">{s.sale_date}</td>
                      <td className="py-2.5 px-3 text-right">{s.heads_sold}</td>
                      <td className="py-2.5 px-3 text-right">{s.weight_kg.toLocaleString()} kg</td>
                      <td className="py-2.5 px-3 text-right">₱{s.price_per_kilo}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-green-700">₱{s.total_revenue.toLocaleString()}</td>
                      <td className="py-2.5 px-3">{s.buyer_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer — fixed to the bottom of the printed page */}
          <footer className="print-report-footer">
            <div className="flex items-end justify-between gap-6">
              <div className="text-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Accountable Person</p>
                <p className="font-semibold text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-500">Farm Manager / Owner</p>
              </div>
              <DevCredit centered={false} />
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Row({ label, value, bold, green, red }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 text-slate-600">{label}</td>
      <td className={`py-2 text-right font-semibold ${green ? 'text-green-600' : red ? 'text-red-600' : 'text-slate-900'}`}>{value}</td>
    </tr>
  )
}

function MetaField({ label, value, accent }) {
  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${accent ? 'text-pink-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

/* ─────────── SHARED TABLES ─────────── */

function SectionCard({ title, right, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}

function DataTable({ headers, rows, locked, empty, renderRow, alignRight = [], onDelete, confirmDelete }) {
  const [pending, setPending] = useState(null)
  const hasAction = !locked && onDelete != null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-slate-500">
            {headers.map((h) => (
              <th key={h} className={`py-3 px-5 ${alignRight.includes(h) ? 'text-right' : ''}`}>{h}</th>
            ))}
            {hasAction && <th className="py-3 px-5 w-14" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={headers.length + (hasAction ? 1 : 0)} className="py-12 text-center text-slate-400">{empty}</td></tr>
          )}
          {rows.map((r) => {
            const cells = renderRow(r)
            return (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                {cells.map((c, i) => (
                  <td key={i} className={`py-3 px-5 ${alignRight.includes(headers[i]) ? 'text-right' : ''} ${typeof c === 'number' || typeof c === 'string' ? 'text-slate-800' : ''}`}>
                    {typeof c === 'number' ? c.toLocaleString() : c}
                  </td>
                ))}
                {hasAction && (
                  <td className="py-3 px-5 text-right">
                    <button onClick={() => setPending(r)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={() => { onDelete(pending); setPending(null) }}
        title={confirmDelete?.title || 'Delete this record?'}
        message={confirmDelete?.message || 'This record will be permanently removed.'}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}

function LockedNotice() {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 text-sm flex items-center gap-2">
      <Lock className="w-4 h-4" /> Locked group — records are permanent history and cannot be modified.
    </div>
  )
}