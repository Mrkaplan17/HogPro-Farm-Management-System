import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Wallet, TrendingUp, BadgeDollarSign, Layers, Lock, PiggyBank, Weight, Target, Printer } from 'lucide-react'
import { api } from '../api'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import { MONEY } from '../components/InsightCharts'

const SCOPES = [
  { key: 'all', label: 'All batches' },
  { key: 'active', label: 'Active' },
  { key: 'closed', label: 'Closed history' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [scope, setScope] = useState('all')
  const [selected, setSelected] = useState([])
  const [showPrint, setShowPrint] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const data = await api.getDashboard()
      setDashboard(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!dashboard) return
    setSelected(dashboard.batches.filter((s) => scope === 'all' || s.batch.status === scope).map((s) => s.batch.id))
  }, [dashboard, scope])

  const visible = useMemo(() => {
    if (!dashboard) return []
    let list = dashboard.batches
    if (scope !== 'all') list = list.filter((s) => s.batch.status === scope)
    return list.filter((s) => selected.includes(s.batch.id))
  }, [dashboard, scope, selected])

  const totals = useMemo(() => visible.reduce((acc, s) => {
    acc.heads += s.heads_remaining
    acc.sold += s.heads_sold
    acc.weight += s.total_weight_sold || 0
    acc.expenses += s.total_expenses
    acc.revenue += s.total_revenue
    acc.net += s.net_profit
    return acc
  }, { heads: 0, sold: 0, weight: 0, expenses: 0, revenue: 0, net: 0 }), [visible])

  const avgKg = totals.weight > 0 ? totals.revenue / totals.weight : 0

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  if (loading) return <div className="p-8 text-slate-500">Loading insights…</div>
  if (error && !dashboard) return <div className="p-8 text-red-500">Error: {error}</div>
  if (!dashboard) return null

  const scopeBatches = dashboard.batches.filter((s) => scope === 'all' || s.batch.status === scope)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {showPrint && (
        <InsightsPrintOverlay
          rows={visible}
          totals={totals}
          avgKg={avgKg}
          scopeLabel={SCOPES.find((s) => s.key === scope)?.label || ''}
          ownerName={user?.full_name || ''}
          onClose={() => setShowPrint(false)}
        />
      )}

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Executive Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Batch profitability &amp; operational insights.</p>
        </div>
        <Link to="/operations" className="bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm">
          New Group
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Batches" value={dashboard.active_batches} sublabel={`${dashboard.closed_batches} locked in history`} icon={Layers} color="bg-slate-900" />
        <StatCard label="Current Head Count" value={dashboard.total_current_heads.toLocaleString()} sublabel="Pigs on hand (active batches)" icon={PiggyBank} color="bg-pink-600" />
        <StatCard label="Feed Consumed" value={`${dashboard.total_feeds_consumed_kg.toLocaleString()} kg`} sublabel="Active batches, all feeds" icon={Weight} color="bg-blue-600" />
        <StatCard label="Projected Revenue" value={MONEY(dashboard.projected_revenue)} sublabel="Based on recorded sales averages" icon={Target} color="bg-green-600" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={MONEY(dashboard.total_revenue)} sublabel="Active batches only" icon={TrendingUp} color="bg-green-600" />
        <StatCard label="Total Expenses" value={MONEY(dashboard.total_expenses)} sublabel="Active batches only" icon={Wallet} color="bg-red-600" />
        <StatCard label="Net Result" value={MONEY(dashboard.total_profit)} sublabel={dashboard.total_profit >= 0 ? 'Positive on active batches' : 'At a loss on active batches'} icon={BadgeDollarSign} color="bg-blue-600" />
        <StatCard label="Groups Tracked" value={dashboard.active_batches} sublabel="Active now" icon={Layers} color="bg-slate-900" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-semibold text-slate-900 text-lg">Insights</h2>
            <p className="text-sm text-slate-500 mt-0.5">Batch-level heads, sales, pricing and net result.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-slate-100 rounded-xl p-1">
              {SCOPES.map((s) => (
                <button key={s.key} onClick={() => setScope(s.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${scope === s.key ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPrint(true)}
              disabled={visible.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" /> Print Report
            </button>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Filter batches</p>
          <div className="flex items-center gap-2 flex-wrap">
            {scopeBatches.map((s) => (
              <button key={s.batch.id} onClick={() => toggle(s.batch.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selected.includes(s.batch.id) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}`}>
                {s.batch.status === 'closed' && <Lock className="w-3 h-3" />}
                {s.batch.name}
              </button>
            ))}
            {scopeBatches.length === 0 && <span className="text-sm text-slate-400">No batches in this scope.</span>}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-16">Select at least one batch to see its summary.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visible.map((s) => <BatchMetricCard key={s.batch.id} s={s} />)}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Batch Profitability</h2>
            <p className="text-sm text-slate-500">All groups — locked history stays visible.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-500">
                <th className="py-3 px-5">Group</th>
                <th className="py-3 px-5 text-right">Heads</th>
                <th className="py-3 px-5 text-right">Cost/head</th>
                <th className="py-3 px-5 text-right">Buy/head</th>
                <th className="py-3 px-5 text-right">Sell/head</th>
                <th className="py-3 px-5 text-right">Revenue</th>
                <th className="py-3 px-5 text-right">Profit</th>
                <th className="py-3 px-5 text-right">Margin</th>
                <th className="py-3 px-5">Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.batches.length === 0 && (
                <tr><td colSpan="9" className="py-12 text-center text-slate-400">No data yet.</td></tr>
              )}
              {dashboard.batches.map((s) => (
                <tr key={s.batch.id} className={`border-t border-slate-100 ${s.batch.status === 'closed' ? 'bg-slate-50/60' : ''}`}>
                  <td className="py-3 px-5 font-medium">
                    <Link to={`/operations/${s.batch.id}`} className="inline-flex items-center gap-1.5 hover:text-pink-600 text-slate-900">
                      {s.batch.status === 'closed' && <Lock className="w-3 h-3 text-slate-400" />}
                      {s.batch.name}
                    </Link>
                  </td>
                  <td className="py-3 px-5 text-right">{s.heads_sold}{s.heads_remaining > 0 ? ` (+${s.heads_remaining})` : ''}</td>
                  <td className="py-3 px-5 text-right">{MONEY(s.cost_per_head)}</td>
                  <td className="py-3 px-5 text-right">{s.buy_price_per_head > 0 ? MONEY(s.buy_price_per_head) : '—'}</td>
                  <td className={`py-3 px-5 text-right font-medium ${s.sell_price_per_head > 0 ? 'text-green-600' : ''}`}>{s.sell_price_per_head > 0 ? MONEY(s.sell_price_per_head) : '—'}</td>
                  <td className="py-3 px-5 text-right text-green-600">{MONEY(s.total_revenue)}</td>
                  <td className={`py-3 px-5 text-right font-semibold ${s.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{MONEY(s.net_profit)}</td>
                  <td className="py-3 px-5 text-right">{s.profit_margin_pct}%</td>
                  <td className="py-3 px-5"><StatusBadge status={s.batch.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function BatchMetricCard({ s }) {
  return (
    <div className="border border-slate-200 rounded-2xl bg-slate-50/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <Link to={`/operations/${s.batch.id}`} className="font-semibold text-slate-900 hover:text-pink-600 inline-flex items-center gap-2">
          {s.batch.status === 'closed' && <Lock className="w-3.5 h-3.5 text-slate-400" />}
          {s.batch.name}
        </Link>
        <StatusBadge status={s.batch.status} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricTile label="Heads" value={s.heads_remaining.toLocaleString()} sub={`of ${s.batch.initial_head_count}`} />
        <MetricTile label="Heads sold" value={s.heads_sold.toLocaleString()} />
        <MetricTile label="Weight sold" value={`${s.total_weight_sold.toLocaleString()} kg`} />
        <MetricTile label="Avg selling price" value={`₱${s.avg_selling_price_kg.toFixed(2)}/kg`} />
        <MetricTile label="Total expense" value={MONEY(s.total_expenses)} tone="red" />
        <MetricTile label="Revenue" value={MONEY(s.total_revenue)} tone="green" />
        <MetricTile label="Net income" value={MONEY(s.net_profit)} tone={s.net_profit >= 0 ? 'green' : 'red'} />
      </div>
    </div>
  )
}

function MetricTile({ label, value, sub, tone }) {
  const toneClass = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-slate-900'
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
      <p className={`text-lg font-bold ${toneClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

function InsightsPrintOverlay({ rows, totals, avgKg, scopeLabel, ownerName, onClose }) {
  const money = (v) => { const n = Number(v); return (v == null || Number.isNaN(n)) ? '₱0' : `₱${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` }
  const displayName = ownerName || 'Farm Manager'
  const scopeText = scopeLabel || 'All Batches'

  function handlePrint() {
    const prevTitle = document.title
    const safeScope = scopeText.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_')
    document.title = `${safeScope}_Batch_Performance_Report`
    window.print()
    document.title = prevTitle
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-12 px-4 print-overlay" onClick={onClose}>
<div className="print-area bg-white rounded-2xl shadow-2xl w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
          <div className="no-print flex items-center justify-between px-8 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Batch Insights Report</h2>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 text-sm bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-semibold">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg">Close</button>
            </div>
          </div>

                    <div className="px-10 py-8 print-body summary-report-print">
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
                <p className="font-semibold text-slate-700">Executive Report · CONFIDENTIAL</p>
                <p>Generated: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* 2. Document title + period */}
            <div className="py-4">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Batch Performance &amp; Financial Report</h1>
              <p className="mt-1 text-sm font-semibold text-cyan-600">
                Reporting Period: {new Date().toLocaleDateString()} · {scopeText}
              </p>
            </div>

            {/* 3. Summary table */}
            <table className="w-full text-sm summary-table">
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr className="text-left text-slate-100">
                  <th className="py-2.5 px-3">Group</th>
                  <th className="py-2.5 px-3">Start</th>
                  <th className="py-2.5 px-3">End</th>
                  <th className="py-2.5 px-3 text-right">Heads Sold</th>
                  <th className="py-2.5 px-3 text-right">Weight Sold</th>
                  <th className="py-2.5 px-3 text-right">₱/kg</th>
                  <th className="py-2.5 px-3 text-right">Expense</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan="9" className="py-10 text-center text-slate-400">No batches selected.</td></tr>
                )}
                {rows.map((s) => {
                  const endDate = s.batch.status === 'closed' && s.batch.closed_at ? String(s.batch.closed_at).slice(0, 10) : '—'
                  const idx = rows.indexOf(s)
                  return (
                    <tr key={s.batch.id} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                      <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">{s.batch.name}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{s.batch.start_date}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{endDate}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">{s.heads_sold}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">{s.total_weight_sold.toLocaleString()} kg</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">₱{s.avg_selling_price_kg.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap text-red-600">{money(s.total_expenses)}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap text-green-700">{money(s.total_revenue)}</td>
                      <td className={`py-2.5 px-3 text-right whitespace-nowrap font-semibold ${s.net_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{money(s.net_profit)}</td>
                    </tr>
                  )
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="totals-row">
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-900" colSpan="3">Overall Total</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">{totals.sold}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">{totals.weight.toLocaleString()} kg</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">{avgKg > 0 ? `₱${avgKg.toFixed(2)}` : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-red-700 whitespace-nowrap">{money(totals.expenses)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-green-700 whitespace-nowrap">{money(totals.revenue)}</td>
                    <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${totals.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>{money(totals.net)}</td>
                  </tr>
                </tfoot>
              )}
            </table>

            {/* Footer — fixed to the bottom of the printed page */}
            <footer className="print-report-footer">
              <div className="text-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Accountable Person</p>
                <p className="font-semibold text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-500">Farm Manager / Owner</p>
              </div>
            </footer>
          </div>
        </div>
    </div>,
    document.body
  )
}