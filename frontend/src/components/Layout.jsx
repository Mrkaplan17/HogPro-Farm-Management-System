import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Grid2x2, Boxes, Syringe, Receipt, PiggyBank, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import DevCredit from './DevCredit'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
  ]

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-pink-600 rounded-xl p-2">
            <PiggyBank className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">HogPros</h1>
            <p className="text-xs text-slate-400">Farm Management System</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <p className="px-4 pb-2 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Menu</p>
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
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
            <button onClick={handleLogout} title="Sign out" className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 ml-64">
        <Outlet />
      </div>
    </div>
  )
}