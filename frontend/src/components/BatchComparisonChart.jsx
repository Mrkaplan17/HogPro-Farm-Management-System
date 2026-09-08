import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function BatchComparisonChart({ summaries }) {
  const labels = summaries.map((s) => s.batch.name)
  const expenses = summaries.map((s) => s.total_expenses)
  const revenue = summaries.map((s) => s.total_revenue)
  const profit = summaries.map((s) => s.net_profit)

  const data = {
    labels,
    datasets: [
      {
        label: 'Expenses',
        data: expenses,
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
      {
        label: 'Revenue',
        data: revenue,
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'Profit',
        data: profit,
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v) => `₱${v.toLocaleString()}`,
        },
      },
    },
  }

  return <Bar data={data} options={options} />
}
