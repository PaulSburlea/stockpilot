import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import type { SalesAnalytics } from '../../services/api'

interface Props {
  data: SalesAnalytics[]
}

export default function SalesChart({ data }: Props) {
  // Agregăm vânzările per oraș
  const chartData = data.reduce((acc, item) => {
    const city = item.location?.city ?? 'Necunoscut'
    const existing = acc.find(a => a.city === city)
    if (existing) {
      existing.total += item.total_quantity
    } else {
      acc.push({ city, total: item.total_quantity })
    }
    return acc
  }, [] as { city: string; total: number }[])

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
        Nu există date de vânzări
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="city" tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          labelStyle={{ color: '#e2e8f0' }}
          itemStyle={{ color: '#a78bfa' }}
        />
        <Bar dataKey="total" name="Unități vândute" fill="#7c3aed" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}