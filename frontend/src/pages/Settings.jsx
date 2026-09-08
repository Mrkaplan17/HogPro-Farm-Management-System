import { useEffect, useState } from 'react'
import { Save, KeyRound, Mail, Lock, User, MapPin, Building2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api'

export default function Settings() {
  const { user, updateUser } = useAuth()
  const [profile, setProfile] = useState({ full_name: '', farm_name: '', farm_location: '' })
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)

  useEffect(() => {
    if (user) {
      setProfile({
        full_name: user.full_name || '',
        farm_name: user.farm_name || '',
        farm_location: user.farm_location || '',
      })
    }
  }, [user])

  async function saveProfile(e) {
    e.preventDefault()
    setMsg('')
    setErr('')
    setSavingProfile(true)
    try {
      const updated = await api.updateProfile(profile)
      updateUser(updated)
      setMsg('Profile updated.')
    } catch (error) {
      setErr(error.message)
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    setMsg('')
    setErr('')
    if (pwd.new_password !== pwd.confirm_password) {
      setErr('New passwords do not match.')
      return
    }
    setSavingPwd(true)
    try {
      const res = await api.changePassword(pwd)
      setMsg(res.message)
      setPwd({ current_password: '', new_password: '', confirm_password: '' })
    } catch (error) {
      setErr(error.message)
    } finally {
      setSavingPwd(false)
    }
  }

  const baseInput =
    'w-full border border-slate-200 rounded-lg py-2.5 pr-10 pl-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition'

  const passwordInput = (key, value, onChange) => (
    <div className="relative">
      <input
        type={showPwd[key] ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className={baseInput}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShowPwd((s) => ({ ...s, [key]: !s[key] }))}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {showPwd[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )

  const label = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5'
  const initials = (user?.full_name || user?.username || 'U')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your profile and account security.</p>
      </header>

      {msg && (
        <div className="mb-5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-4 py-3 text-sm">{msg}</div>
      )}
      {err && (
        <div className="mb-5 bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm">{err}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-pink-700 text-white flex items-center justify-center text-lg font-bold shrink-0">
          {initials || 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 truncate">{user?.full_name || 'Farm Administrator'}</p>
          <p className="text-sm text-slate-500 truncate">{user?.email}</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" /> Administrator
        </span>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Profile</h2>
        </div>
        <form onSubmit={saveProfile} className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className={label}>Full Name</label>
              <input
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                className={baseInput}
                placeholder="e.g. Juan Dela Cruz"
              />
            </div>
            <div>
              <label className={label}>Farm Name</label>
              <input
                value={profile.farm_name}
                onChange={(e) => setProfile({ ...profile, farm_name: e.target.value })}
                className={baseInput}
                placeholder="e.g. Alcayaga Piggery"
              />
            </div>
          </div>
          <div>
            <label className={label}>Farm Location / Place</label>
            <input
              value={profile.farm_location}
              onChange={(e) => setProfile({ ...profile, farm_location: e.target.value })}
              className={baseInput}
              placeholder="e.g. Barangay San Isidro, Tagum City"
            />
          </div>
          <div>
            <label className={label}>Email</label>
            <div className="relative">
              <input
                value={user?.email || ''}
                readOnly
                tabIndex={-1}
                className={baseInput + ' bg-slate-50 text-slate-400 pr-10 cursor-not-allowed'}
              />
              <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
            </div>
            <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Read-only — this is your sign-in identity.
            </p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">Changes apply to your account immediately.</span>
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Change Password</h2>
        </div>
        <form onSubmit={savePassword} className="p-6 space-y-5">
          <div>
            <label className={label}>Current Password</label>
            {passwordInput('current', pwd.current_password, (e) => setPwd({ ...pwd, current_password: e.target.value }))}
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className={label}>New Password</label>
              {passwordInput('new', pwd.new_password, (e) => setPwd({ ...pwd, new_password: e.target.value }))}
            </div>
            <div>
              <label className={label}>Confirm New Password</label>
              {passwordInput('confirm', pwd.confirm_password, (e) => setPwd({ ...pwd, confirm_password: e.target.value }))}
            </div>
          </div>
          <p className="text-xs text-slate-400">Use at least 6 characters. Choose something you haven't used elsewhere.</p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">You'll be asked for it again on your next login.</span>
            <button
              type="submit"
              disabled={savingPwd}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              {savingPwd ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}