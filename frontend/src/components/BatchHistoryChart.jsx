import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const PALETTE = [
  'rgba(236, 72, 153, 1)',
  'rgba(59, 130, 246, 1)',
  'rgba(34, 197, 94, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(168, 85, 247, 1)',
  'rgba(14, 165, 233, 1)',
]

// series: [{ label, data: [{month, expenses, revenue, profit}] }]
export default function BatchHistoryChart({ series }) {
  const active = series.filter((s) => s.data.length > 0)

  if (active.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-10">No history data for the selected batches</p>
  }

  // Union of all months, sorted
  const monthSet = new Set()
  active.forEach((s) => s.data.forEach((d) => monthSet.add(d.month)))
  const labels = [...monthSet].sort()

  // For a single series, chart revenue/expenses/profit lines. For multiple,
  // chart one "profit" line per batch to keep it readable.
  const single = active.length === 1
  const datasets = []

  if (single) {
    const s = active[0]
    const byMonth = {}
    s.data.forEach((d) => (byMonth[d.month] = d))
    const get = (k) => labels.map((m) => byMonth[m]?.[k] ?? 0)
    datasets.push(
      { label: `${s.label} · Revenue`, data: get('revenue'), borderColor: 'rgba(34, 197, 94, 1)', backgroundColor: 'rgba(34, 197, 94, 0.08)', fill: true, tension: 0.3 },
      { label: `${s.label} · Expenses`, data: get('expenses'), borderColor: 'rgba(239, 68, 68, 1)', backgroundColor: 'rgba(239, 68, 68, 0.08)', fill: true, tension: 0.3 },
      { label: `${s.label} · Profit`, data: get('profit'), borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.08)', fill: true, tension: 0.3 },
    )
  } else {
    active.forEach((s, i) => {
      const byMonth = {}
      s.data.forEach((d) => (byMonth[d.month] = d))
      datasets.push({
        label: `${s.label} · Profit`,
        data: labels.map((m) => byMonth[m]?.profit ?? 0),
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: `${PALETTE[i % PALETTE.length].replace('1)', '0.08)')}`,
        fill: true,
        tension: 0.3,
      })
    })
  }

  return (
    <Line
      data={{ labels, datasets }}
      options={{
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => `₱${v.toLocaleString()}` },
          },
        },
      }}
    />
  )
}