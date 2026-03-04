import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import type { StockItem } from '../../services/api'

interface Props {
  data: StockItem[]
}

const COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2']

export default function StockChart({ data }: Props) {
  // Agregăm stocul per locație
  const chartData = data.reduce((acc, item) => {
    const name = item.locations?.city ?? `Locație ${item.location_id}`
    const existing = acc.find(a => a.name === name)
    if (existing) {
      existing.value += item.quantity
    } else {
      acc.push({ name, value: item.quantity })
    }
    return acc
  }, [] as { name: string; value: number }[])

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
        Nu există date de stoc
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Legend
          formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}