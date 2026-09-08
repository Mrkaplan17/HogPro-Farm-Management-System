import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PiggyBank, ShieldCheck, LogIn, UserPlus, Mail, Eye, EyeOff, Facebook } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api'
import DevCredit from '../components/DevCredit'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || ''

const EMPTY_FORM = { full_name: '', email: '', password: '' }

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [signin, setSignin] = useState({ email: '', password: '' })
  const [signup, setSignup] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSigninPassword, setShowSigninPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [fbReady, setFbReady] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    window.handleHogProsGoogle = (response) => { handleGoogle(response?.credential) }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    document.body.appendChild(s)
    return () => document.body.removeChild(s)
  }, [GOOGLE_CLIENT_ID])

  useEffect(() => {
    if (!FB_APP_ID) return
    window.fbAsyncInit = () => {
      window.FB.init({ appId: FB_APP_ID, version: 'v18.0', cookie: false, xfbml: false })
      setFbReady(true)
    }
    const s = document.createElement('script')
    s.src = 'https://connect.facebook.net/en_US/sdk.js'
    s.async = true
    s.defer = true
    document.body.appendChild(s)
    return () => document.body.removeChild(s)
  }, [FB_APP_ID])

  async function handleGoogle(credential) {
    setError('')
    setLoading(true)
    try {
      const res = await api.googleLogin(credential, 'id_token')
      localStorage.setItem('piggery_token', res.access_token)
      localStorage.setItem('piggery_user', JSON.stringify(res.user))
      navigate(res.user.is_onboarded ? '/' : '/onboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleFacebook() {
    setError('')
    setLoading(true)
    try {
      if (!window.FB) throw new Error('Facebook is still loading. Try again in a moment.')
      const authResponse = await new Promise((resolve, reject) => {
        window.FB.login(
          (r) => (r.authResponse ? resolve(r.authResponse) : reject(new Error('Facebook login was cancelled.'))),
          { scope: 'public_profile,email' },
        )
      })
      const profile = await new Promise((resolve, reject) => {
        window.FB.api('/me?fields=id,name,email', { access_token: authResponse.accessToken }, (p) =>
          p && !p.error ? resolve(p) : reject(new Error('Could not load your Facebook profile.')),
        )
      })
      const res = await api.facebookLogin(authResponse.accessToken, profile.id)
      localStorage.setItem('piggery_token', res.access_token)
      localStorage.setItem('piggery_user', JSON.stringify(res.user))
      navigate(res.user.is_onboarded ? '/' : '/onboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitSignin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(signin.email, signin.password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitSignup(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      await api.register(signup)
      setNotice('Account created. You can now sign in.')
      setSignin({ email: signup.email, password: '' })
      setSignup(EMPTY_FORM)
      setMode('signin')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const tabClass = (active) =>
    `flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
      active ? 'bg-pink-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'
    }`

  return (
    <div className="min-h-screen flex bg-slate-950">
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-950 to-pink-950 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-pink-600 rounded-xl p-2.5">
            <PiggyBank className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">HogPros</h1>
            <p className="text-xs text-slate-400">Farm Management &amp; Profitability</p>
          </div>
        </div>
        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-bold leading-tight">
            Run your piggery like a business — not a notebook.
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Create your account with your email, then track batches, cages, inventory &amp; vitamins.
            Turn daily expense and sales logs into clean profit &amp; loss statements you can print and share.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-xs text-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-pink-400" /> Every account has full financial access
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} HogPros Systems</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="bg-pink-600 rounded-xl p-2"><PiggyBank className="w-6 h-6 text-white" /></div>
            <h1 className="font-bold text-xl text-white">HogPros</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="bg-slate-100 rounded-xl p-1 flex mb-6">
              <button type="button" onClick={() => { setMode('signin'); setError(''); setNotice('') }} className={tabClass(mode === 'signin')}>
                Sign In
              </button>
              <button type="button" onClick={() => { setMode('signup'); setError(''); setNotice('') }} className={tabClass(mode === 'signup')}>
                Sign Up
              </button>
            </div>

            {notice && (
              <div className="mb-4 bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-2.5 text-sm">{notice}</div>
            )}
            {error && (
              <div className="mb-4 bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2.5 text-sm">{error}</div>
            )}

            {mode === 'signin' ? (
              <>
                <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
                <p className="text-sm text-slate-500 mt-1">Sign in with the email you registered.</p>

                <form onSubmit={submitSignin} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      autoFocus required type="email"
                      value={signin.email}
                      onChange={(e) => setSignin({ ...signin, email: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      placeholder="you@farm.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        required type={showSigninPassword ? 'text' : 'password'}
                        value={signin.password}
                        onChange={(e) => setSignin({ ...signin, password: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSigninPassword((s) => !s)}
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        aria-label={showSigninPassword ? 'Hide password' : 'Show password'}
                      >
                        {showSigninPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-xs font-medium text-pink-600 hover:text-pink-700">
                      Forgot your password?
                    </Link>
                  </div>
                  <button
                    type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg"
                  >
                    <LogIn className="w-4 h-4" />
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>

                {(GOOGLE_CLIENT_ID || FB_APP_ID) && (
                  <>
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400">or</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                    {GOOGLE_CLIENT_ID && (
                      <>
                        <div
                          id="g_id_onload"
                          data-client_id={GOOGLE_CLIENT_ID}
                          data-callback="handleHogProsGoogle"
                          data-auto_prompt="false"
                          className="hidden"
                        />
                        <div
                          className="g_id_signin w-full flex justify-center"
                          data-type="standard"
                          data-shape="rectangular"
                          data-theme="outline"
                          data-text="continue_with"
                          data-size="large"
                          data-width="320"
                          data-logo_alignment="left"
                        />
                      </>
                    )}
                    {FB_APP_ID && (
                      <button
                        type="button"
                        onClick={handleFacebook}
                        disabled={loading || !fbReady}
                        className="w-full flex items-center justify-center gap-2 border border-slate-300 rounded-lg py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Facebook className="w-4 h-4 text-[#1877F2]" />
                        Continue with Facebook
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-slate-900">Create your account</h2>
                <p className="text-sm text-slate-500 mt-1">First time here? Sign up with your email.</p>

                <form onSubmit={submitSignup} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      value={signup.full_name}
                      onChange={(e) => setSignup({ ...signup, full_name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      placeholder="e.g. Juan Dela Cruz"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      autoFocus required type="email"
                      value={signup.email}
                      onChange={(e) => setSignup({ ...signup, email: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      placeholder="you@farm.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        required type={showSignupPassword ? 'text' : 'password'} minLength="6"
                        value={signup.password}
                        onChange={(e) => setSignup({ ...signup, password: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                        placeholder="At least 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword((s) => !s)}
                        tabIndex={-1}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                      >
                        {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg"
                  >
                    <UserPlus className="w-4 h-4" />
                    {loading ? 'Creating account…' : 'Create account'}
                  </button>
                </form>
              </>
            )}

            {mode === 'signup' && (
              <div className="mt-6 bg-slate-50 rounded-lg border border-slate-200 p-3 text-xs text-slate-500">
                <p className="font-semibold text-slate-600 mb-1">No roles to choose</p>
                <p>Every account you create here is an administrator with full access to records and finances.</p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link to="/contact" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
              <Mail className="w-3.5 h-3.5" /> Need help? Contact Farm Support
            </Link>
          </div>

          <div className="mt-4">
            <DevCredit />
          </div>
        </div>
      </div>
    </div>
  )
}