import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Syringe, PackageMinus, Check, CalendarClock, ChevronRight } from 'lucide-react'
import { api } from '../api'

function dayLabel(daysLeft) {
  if (daysLeft < 0) return Math.abs(daysLeft) === 1 ? '1 day overdue' : `${Math.abs(daysLeft)} days overdue`
  if (daysLeft === 0) return 'Due today'
  if (daysLeft === 1) return 'Due tomorrow'
  return `Due in ${daysLeft} days`
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notif, setNotif] = useState(null)
  const wrapRef = useRef(null)

  async function load() {
    try {
      setNotif(await api.getNotifications())
    } catch {
      /* bell stays silent if the API is unavailable */
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function onClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  async function markDone(id) {
    try {
      await api.completeReminder(id)
      load()
    } catch {
      /* ignore */
    }
  }

  const total = notif?.total || 0
  const overdue = notif?.overdue_doses || []
  const dueSoon = notif?.due_doses || []
  const lowStock = notif?.low_stock || []
  const empty = total === 0

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Notifications</h3>
            <span className="text-xs text-slate-400">
              {overdue.length > 0 ? `${overdue.length} overdue` : 'All caught up'}
            </span>
          </div>

          {empty ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              <CalendarClock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Nothing needs your attention right now.
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-50">
              {overdue.length > 0 && (
                <div className="px-5 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-500 mb-2">Overdue doses</p>
                  <ul className="space-y-1">
                    {overdue.map((d) => (
                      <li key={`o-${d.id}`} className="group flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-red-50 transition-colors">
                        <Syringe className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate('/vitamins')}>
                          <p className="text-sm font-medium text-slate-900 truncate">{d.title}</p>
                          <p className="text-xs text-red-600 font-semibold">{dayLabel(d.days_left)}</p>
                          {d.batch_name && <p className="text-xs text-slate-400 truncate">{d.batch_name}</p>}
                        </div>
                        <button
                          onClick={() => markDone(d.id)}
                          title="Mark as done"
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-opacity"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {dueSoon.length > 0 && (
                <div className="px-5 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-2">Due soon</p>
                  <ul className="space-y-1">
                    {dueSoon.map((d) => (
                      <li key={`s-${d.id}`} className="group flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-amber-50 transition-colors">
                        <Syringe className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate('/vitamins')}>
                          <p className="text-sm font-medium text-slate-900 truncate">{d.title}</p>
                          <p className="text-xs text-amber-600 font-semibold">{dayLabel(d.days_left)}</p>
                          {d.batch_name && <p className="text-xs text-slate-400 truncate">{d.batch_name}</p>}
                        </div>
                        <button
                          onClick={() => markDone(d.id)}
                          title="Mark as done"
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-opacity"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lowStock.length > 0 && (
                <div className="px-5 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-2">
                    Reorder alerts {lowStock.some((i) => i.status === 'critical') ? '· critical' : ''}
                  </p>
                  <ul className="space-y-1">
                    {lowStock.map((i) => (
                      <li key={`l-${i.item_id}`} className="group flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-blue-50 transition-colors">
                        <PackageMinus className={`w-4 h-4 mt-0.5 shrink-0 ${i.status === 'critical' ? 'text-red-500' : 'text-blue-500'}`} />
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate('/inventory')}>
                          <p className="text-sm font-medium text-slate-900 truncate">{i.name}</p>
                          <p className={`text-xs font-semibold ${i.status === 'critical' ? 'text-red-600' : 'text-blue-600'}`}>
                            {i.status === 'critical' ? 'Out of stock' : `${Number(i.stock_qty).toLocaleString()} ${i.unit} left`}
                          </p>
                          {i.threshold_qty > 0 && <p className="text-xs text-slate-400">Reorder at {Number(i.threshold_qty).toLocaleString()} {i.unit}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 mt-1 text-slate-300 shrink-0" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="px-5 py-3 border-t border-slate-100 flex justify-between text-xs">
            <button onClick={() => { navigate('/vitamins'); setOpen(false) }} className="text-slate-500 hover:text-slate-900 font-medium">
              Dose schedule
            </button>
            <button onClick={() => { navigate('/inventory'); setOpen(false) }} className="text-slate-500 hover:text-slate-900 font-medium">
              Inventory
            </button>
          </div>
        </div>
      )}
    </div>
  )
}