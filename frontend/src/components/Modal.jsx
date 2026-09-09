import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * App-wide modal standard: centered floating card over a dark blurred backdrop.
 * Closes on Escape, backdrop click, or the X button.
 */
export default function Modal({ open, onClose, title, subtitle, icon, maxWidth = 'max-w-xl', footer, children }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-8 overflow-y-auto modal-backdrop"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} my-auto modal-card`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <span className="text-pink-600 shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 leading-tight">{title}</h2>
              {subtitle && <p className="text-xs text-slate-400 leading-tight">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="px-6 py-4 rounded-b-2xl border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Consistent confirmation dialog built on the app modal standard.
 * `danger` colors the confirm button red for destructive actions.
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <p className="text-sm text-slate-500">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
            danger ? 'bg-red-500 hover:bg-red-600' : 'bg-pink-600 hover:bg-pink-700'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}