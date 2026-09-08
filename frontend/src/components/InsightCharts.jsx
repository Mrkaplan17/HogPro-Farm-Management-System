import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend)

export const MONEY = (v) => {
  const n = Number(v)
  if (v == null || v === '' || Number.isNaN(n)) return '₱0'
  return `₱${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function GroupedBarChart({ labels, series, money = false, height = 280 }) {
  const datasets = series.map((s, i) => ({
    label: s.label,
    data: s.data,
    backgroundColor: s.color || ['rgba(236, 72, 153, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(34, 197, 94, 0.8)', 'rgba(245, 158, 11, 0.8)'][i % 4],
    borderRadius: 6,
    borderSkipped: false,
  }))

  return (
    <div style={{ height }}>
      <Bar
        data={{ labels, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true, ticks: { callback: (v) => (money ? MONEY(v) : v) } } },
        }}
      />
    </div>
  )
}

export function MultiLineChart({ labels, datasets, money = false, height = 280 }) {
  const mapped = datasets.map((s, i) => ({
    label: s.label,
    data: s.data,
    borderColor: s.color || ['#ec4899', '#3b82f6', '#22c55e', '#f59e0b'][i % 4],
    backgroundColor: 'rgba(255,255,255,0)',
    tension: 0.35,
    pointRadius: 3,
  }))

  return (
    <div style={{ height }}>
      <Line
        data={{ labels, datasets: mapped }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true, ticks: { callback: (v) => (money ? MONEY(v) : v) } } },
        }}
      />
    </div>
  )
}