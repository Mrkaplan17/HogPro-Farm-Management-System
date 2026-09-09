import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Lock, Trash2, Pencil, Check, X, Grid3x3, Users } from 'lucide-react'
import { api } from '../api'
import StatusBadge from '../components/StatusBadge'
import { TableSkeleton } from '../components/Skeleton'
import Modal, { ConfirmDialog } from '../components/Modal'

const EMPTY_CAGE = { name: '', head_count: '' }

export default function Operations() {
  const [groups, setGroups] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // {type:'close'|'delete', id}
  const [form, setForm] = useState({
    name: '',
    initial_head_count: 50,
    start_date: new Date().toISOString().split('T')[0],
    piglet_cost_amount: '',
    notes: '',
    cages: [{ ...EMPTY_CAGE }],
  })

  async function load() {
    setLoading(true)
    try {
      const data = await api.getBatches(filter || undefined)
      setGroups(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  function resetForm() {
    setForm({
      name: '',
      initial_head_count: 50,
      start_date: new Date().toISOString().split('T')[0],
      piglet_cost_amount: '',
      notes: '',
      cages: [{ ...EMPTY_CAGE }],
    })
  }

  function updateCageRow(i, field, value) {
    setForm((f) => {
      const cages = f.cages.map((c, idx) => (idx === i ? { ...c, [field]: value } : c))
      const total = cages.reduce((s, c) => s + (parseInt(c.head_count) || 0), 0)
      return { ...f, cages, initial_head_count: total || f.initial_head_count }
    })
  }

  function addCageRow() {
    setForm((f) => ({ ...f, cages: [...f.cages, { ...EMPTY_CAGE }] }))
  }

  function removeCageRow(i) {
    setForm((f) => {
      const cages = f.cages.filter((_, idx) => idx !== i)
      const total = cages.reduce((s, c) => s + (parseInt(c.head_count) || 0), 0)
      return { ...f, cages, initial_head_count: total }
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    try {
      const filled = form.cages.filter((c) => c.name.trim() && c.head_count)
      const useCages = filled.length > 0
      await api.createBatch({
        name: form.name,
        initial_head_count: parseInt(form.initial_head_count),
        start_date: form.start_date,
        piglet_cost_amount: parseFloat(form.piglet_cost_amount) || undefined,
        notes: form.notes,
        cages: useCages ? filled.map((c) => ({ name: c.name.trim(), head_count: parseInt(c.head_count) })) : null,
      })
      setShowForm(false)
      resetForm()
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleSaveName(id) {
    const name = editName.trim()
    if (!name) return
    setSaving(true)
    try {
      await api.updateBatch(id, { name })
      setEditingId(null)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleClose(id) {
    try {
      await api.closeBatch(id)
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteBatch(id)
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  const filledCageTotal = form.cages.reduce((s, c) => s + (parseInt(c.head_count) || 0), 0)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Your pig groups, their cages, and every record attached to them.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm shadow-pink-900/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Group
        </button>
      </header>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">{error}</div>
      )}

      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); resetForm() }}
        title="Create a new group"
        subtitle="Plan your next production batch"
        maxWidth="max-w-2xl"
        icon={<Grid3x3 className="w-5 h-5" />}
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                placeholder="e.g. Farrow 03"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                required
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Grid3x3 className="w-4 h-4 text-slate-400" /> Cages in this group
              </label>
              <span className="text-xs text-slate-500">
                Total heads: <strong className="text-slate-900">{filledCageTotal}</strong>
              </span>
            </div>
            <div className="space-y-2">
              {form.cages.map((cage, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={cage.name}
                    onChange={(e) => updateCageRow(i, 'name', e.target.value)}
                    placeholder={`Cage ${i + 1}`}
                    className="w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <input
                    type="number"
                    min="1"
                    value={cage.head_count}
                    onChange={(e) => updateCageRow(i, 'head_count', e.target.value)}
                    placeholder="Heads"
                    className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <button type="button" onClick={() => removeCageRow(i)} className="p-2 text-slate-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addCageRow} className="mt-3 text-sm text-pink-600 hover:text-pink-700 font-medium inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add another cage
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Piglet purchase cost (₱, optional)</label>
              <input
                type="number"
                min="0"
                value={form.piglet_cost_amount}
                onChange={(e) => setForm({ ...form, piglet_cost_amount: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                placeholder="e.g. 45000"
              />
              <p className="text-xs text-slate-400 mt-1">Auto-records a piglets expense in the ledger with this batch.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              rows="2"
            />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 text-sm text-white bg-pink-600 hover:bg-pink-700 rounded-lg font-semibold">
              Create Group
            </button>
          </div>
        </form>
      </Modal>

      <div className="flex items-center gap-2">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1">
          {[['', 'All'], ['active', 'Active'], ['closed', 'Closed']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === val ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {filter === 'closed' && (
          <span className="text-xs text-slate-500">Closed groups are locked history — read-only.</span>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
          <p className="text-slate-400">No groups yet. Create your first group to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {groups.map((g) => (
            <div key={g.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className="p-5 pb-0">
                <div className="flex items-start justify-between">
                  {editingId === g.id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName(g.id)}
                        className="flex-1 border border-pink-400 rounded-lg px-2 py-1 text-lg font-semibold"
                      />
                      <button onClick={() => handleSaveName(g.id)} disabled={saving} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-bold text-lg text-slate-900 truncate">{g.name}</h3>
                      {g.status === 'active' && (
                        <button
                          onClick={() => { setEditingId(g.id); setEditName(g.name) }}
                          className="text-slate-400 hover:text-pink-600"
                          title="Rename group"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <StatusBadge status={g.status} />
                </div>
                <p className="text-sm text-slate-500 mt-0.5">Started {new Date(g.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
              </div>

              <div className="px-5 mt-4 flex items-center gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Heads in</p>
                  <p className="font-bold text-slate-900 text-base">{g.initial_head_count}</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Heads left</p>
                  <p className={`font-bold text-base ${g.current_head_count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{g.current_head_count}</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Cages</p>
                  <p className="font-bold text-base text-slate-900">{g.cages?.length || 0}</p>
                </div>
              </div>

              {g.cages?.length > 0 && (
                <div className="px-5 mt-4">
                  <div className="flex flex-wrap gap-1.5">
                    {g.cages.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 rounded-full pl-2 pr-2.5 py-1 text-xs font-medium">
                        <Users className="w-3 h-3 text-slate-400" />
                        {c.name} · {c.head_count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {g.notes && <p className="px-5 mt-3 text-sm text-slate-500 line-clamp-2">{g.notes}</p>}

              <div className="mt-5 p-4 bg-slate-50 border-t flex items-center justify-between">
                <Link
                  to={`/operations/${g.id}`}
                  className="text-pink-600 text-sm font-semibold hover:text-pink-700"
                >
                  Open ledger →
                </Link>
                {g.status === 'active' && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setConfirmAction({ type: 'close', id: g.id })}
                      title="Close & lock group"
                      className="p-2 text-amber-600 bg-white border border-slate-200 rounded-lg hover:bg-amber-50 hover:border-amber-300"
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmAction({ type: 'delete', id: g.id })}
                      title="Delete group"
                      className="p-2 text-red-600 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          const act = confirmAction
          setConfirmAction(null)
          if (act?.type === 'close') handleClose(act.id)
          else if (act?.type === 'delete') handleDelete(act.id)
        }}
        title={confirmAction?.type === 'close' ? 'Close this group?' : 'Delete this group?'}
        message={
          confirmAction?.type === 'close'
            ? 'It locks all records as read-only history.'
            : 'This group and all of its records will be permanently deleted. This cannot be undone.'
        }
        confirmLabel={confirmAction?.type === 'close' ? 'Close & Lock' : 'Delete'}
        danger
      />
    </div>
  )
}