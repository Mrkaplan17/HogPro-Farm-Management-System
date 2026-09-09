import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Grid2x2, Boxes, Syringe, Receipt, Settings as SettingsIcon, PiggyBank, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import DevCredit from './DevCredit'
import NotificationBell from './NotificationBell'
import { ConfirmDialog } from './Modal'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!sidebarOpen) return
    function onKey(e) {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/operations', label: 'Operations', icon: Grid2x2, end: false },
    { to: '/inventory', label: 'Inventory', icon: Boxes, end: false },
    { to: '/vitamins', label: 'Vitamins & Health', icon: Syringe, end: false },
    { to: '/expenses', label: 'Expenses', icon: Receipt, end: false },
    { to: '/settings', label: 'Account Settings', icon: SettingsIcon, end: false },
  ]

  return (
    <div className="min-h-screen flex bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[35] bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-pink-600 rounded-xl p-2">
            <PiggyBank className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">HogPros</h1>
            <p className="text-xs text-slate-400">Farm Management System</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 pb-2 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Menu</p>
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <DevCredit dark centered />
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-800">
            <div className="bg-slate-700 rounded-full w-9 h-9 flex items-center justify-center text-sm font-bold">
              {(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || user?.username}</p>
              <p className="text-xs text-slate-400">Admin</p>
            </div>
            <button onClick={() => setConfirmLogout(true)} title="Sign out" className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white/85 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6 print:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-1 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            title="Open menu"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-400 hidden sm:block">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
        title="Sign out?"
        message="Are you sure you want to sign out? You'll need to log back in to manage your farm."
        confirmLabel="Sign Out"
        danger
      />
    </div>
  )
}