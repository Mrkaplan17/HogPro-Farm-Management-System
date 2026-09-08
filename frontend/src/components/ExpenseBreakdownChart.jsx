import { Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const CATEGORY_COLORS = {
  feed: '#f97316',
  medicine: '#ef4444',
  veterinary: '#a855f7',
  utilities: '#3b82f6',
  labor: '#14b8a6',
  maintenance: '#eab308',
  misc: '#94a3b8',
}

export default function ExpenseBreakdownChart({ data }) {
  const entries = Object.entries(data || {})

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-10">No expense data</p>
  }

  const chartData = {
    labels: entries.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)),
    datasets: [
      {
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map(([k]) => CATEGORY_COLORS[k] || '#94a3b8'),
        borderWidth: 1,
      },
    ],
  }

  return <Pie data={chartData} />
}
