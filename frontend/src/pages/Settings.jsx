import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Save, KeyRound, Mail, Lock, User, MapPin, Building2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api'

export default function Settings() {
  const { user, updateUser } = useAuth()
  const [profile, setProfile] = useState({ full_name: '', farm_name: '', farm_location: '' })
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' })
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

  const inputClass =
    'w-full border border-slate-300 rounded-lg pl-10 py-2.5 pr-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500'

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

  const field = (label, value, onChange, icon, placeholder, opts = {}) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icon}</span>
        <input value={value} onChange={onChange} placeholder={placeholder} className={inputClass} {...opts} />
      </div>
    </div>
  )

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <div className="bg-pink-600 rounded-xl p-2.5 shadow-sm shadow-pink-900/20">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
          <p className="text-sm text-slate-500">Manage your profile and password.</p>
        </div>
      </header>

      {msg && (
        <div className="mb-5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-5 bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm">{err}</div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <form onSubmit={saveProfile} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5 bg-gradient-to-r from-slate-50 to-white">
            <User className="w-4 h-4 text-pink-600" />
            <div>
              <h2 className="font-bold text-slate-900 leading-tight">Profile</h2>
              <p className="text-xs text-slate-400 leading-tight">Your farm and personal details</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email (read-only)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Mail className="w-4 h-4" /></span>
                <input value={user?.email || ''} readOnly className={inputClass + ' bg-slate-50 text-slate-500'} />
              </div>
              <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Your email is your sign-in identity and cannot be changed.
              </p>
            </div>

            {field('Full Name', profile.full_name, (e) => setProfile({ ...profile, full_name: e.target.value }), <User className="w-4 h-4" />, 'e.g. Juan Dela Cruz')}
            {field('Farm Name', profile.farm_name, (e) => setProfile({ ...profile, farm_name: e.target.value }), <Building2 className="w-4 h-4" />, 'e.g. Alcayaga Piggery')}
            {field('Farm Location / Place', profile.farm_location, (e) => setProfile({ ...profile, farm_location: e.target.value }), <MapPin className="w-4 h-4" />, 'e.g. Barangay San Isidro, Tagum City')}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm shadow-pink-900/20 transition-colors"
              >
                <Save className="w-4 h-4" />
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        </form>

        <form onSubmit={savePassword} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5 bg-gradient-to-r from-slate-50 to-white">
            <KeyRound className="w-4 h-4 text-pink-600" />
            <div>
              <h2 className="font-bold text-slate-900 leading-tight">Change Password</h2>
              <p className="text-xs text-slate-400 leading-tight">Keep your account secure</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {field('Current Password', pwd.current_password, (e) => setPwd({ ...pwd, current_password: e.target.value }), <Lock className="w-4 h-4" />, 'Enter your current password', { type: 'password', required: true })}
            {field('New Password', pwd.new_password, (e) => setPwd({ ...pwd, new_password: e.target.value }), <Lock className="w-4 h-4" />, 'At least 6 characters', { type: 'password', required: true, minLength: 6 })}
            {field('Confirm New Password', pwd.confirm_password, (e) => setPwd({ ...pwd, confirm_password: e.target.value }), <Lock className="w-4 h-4" />, 'Re-enter the new password', { type: 'password', required: true, minLength: 6 })}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingPwd}
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                {savingPwd ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}