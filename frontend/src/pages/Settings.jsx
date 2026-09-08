import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Save, KeyRound, Mail, Lock } from 'lucide-react'
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
    'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500'

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

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-pink-600 rounded-xl p-2">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
          <p className="text-sm text-slate-500">Manage your profile and password.</p>
        </div>
      </div>

      {msg && (
        <div className="mb-4 bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-2.5 text-sm">{msg}</div>
      )}
      {err && (
        <div className="mb-4 bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2.5 text-sm">{err}</div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={saveProfile} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-900">Profile</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email (read-only)</label>
            <div className="relative">
              <input value={user?.email || ''} disabled className={`${inputClass} pr-10 bg-slate-100 text-slate-400`} />
              <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <p className="mt-1 text-xs text-slate-400">Your email is your sign-in identity and cannot be changed.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              className={inputClass}
              placeholder="e.g. Juan Dela Cruz"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Farm Name</label>
            <input
              value={profile.farm_name}
              onChange={(e) => setProfile({ ...profile, farm_name: e.target.value })}
              className={inputClass}
              placeholder="e.g. Alcayaga Piggery"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Farm Location / Place</label>
            <input
              value={profile.farm_location}
              onChange={(e) => setProfile({ ...profile, farm_location: e.target.value })}
              className={inputClass}
              placeholder="e.g. Barangay San Isidro, Tagum City"
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg"
          >
            <Save className="w-4 h-4" />
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        <form onSubmit={savePassword} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-pink-600" /> Change Password
          </h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
            <input
              required type="password"
              value={pwd.current_password}
              onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
              className={inputClass}
              placeholder="Enter your current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input
              required type="password" minLength="6"
              value={pwd.new_password}
              onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
              className={inputClass}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
            <input
              required type="password" minLength="6"
              value={pwd.confirm_password}
              onChange={(e) => setPwd({ ...pwd, confirm_password: e.target.value })}
              className={inputClass}
              placeholder="Re-enter the new password"
            />
          </div>
          <button
            type="submit"
            disabled={savingPwd}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg"
          >
            <Lock className="w-4 h-4" />
            {savingPwd ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}