export default function StatCard({ label, value, sublabel, icon: Icon, color = 'bg-primary-600' }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
      </div>
      {Icon && (
        <div className={`${color} text-white rounded-lg p-3`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  )
}
