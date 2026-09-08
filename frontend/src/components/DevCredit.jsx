import { Globe } from 'lucide-react'

const PORTFOLIO_URL = 'https://balcayaga.netlify.app/'

export default function DevCredit({ dark = false, centered = true, className = '' }) {
  const align = centered ? 'text-center' : 'text-left'
  return (
    <div className={`text-[11px] leading-relaxed ${dark ? 'text-slate-500' : 'text-slate-500'} ${align} ${className}`}>
      <p className="font-medium tracking-wide text-slate-500">Developed by Billy Alcayaga</p>
      <a
        href={PORTFOLIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-1 inline-flex items-center gap-1.5 font-medium tracking-tight hover:underline ${
          centered ? 'justify-center' : ''
        } ${dark ? 'text-pink-400 hover:text-pink-300' : 'text-pink-600 hover:text-pink-700'}`}
      >
        <Globe className="w-3.5 h-3.5 shrink-0" />
        {PORTFOLIO_URL}
      </a>
    </div>
  )
}
