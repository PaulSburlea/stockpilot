import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockApi, salesApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { AlertTriangle, TrendingUp, Package, MapPin, TrendingDown, Clock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid,
} from 'recharts'

type Period = 30 | 60 | 90

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  subtitle?: string
  alert?: boolean
}

function StatCard({ title, value, icon, color, subtitle, alert }: StatCardProps) {
  return (
    <div className={`bg-slate-900 border rounded-xl p-5 transition-colors
      ${alert ? 'border-red-500/30' : 'border-slate-800'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${alert ? 'text-red-400' : 'text-slate-100'}`}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  )
}

function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1 bg-slate-800/60 p-1 rounded-lg">
      {([30, 60, 90] as Period[]).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
            ${value === p
              ? 'bg-violet-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
            }`}
        >
          {p}z
        </button>
      ))}
    </div>
  )
}

function ChartCard({ title, icon, children, subtitle }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  subtitle?: string
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-slate-600 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs shadow-xl">
      <p className="text-slate-300 font-semibold mb-1.5 max-w-44 truncate">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold text-slate-100">
            {p.value === 999 ? '∞' : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex items-center justify-center h-48 text-slate-600 text-xs">{text}</div>
)

export default function DashboardStand() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<Period>(30)
  const [showAllCritical, setShowAllCritical] = useState(false)

  const locationFilter = { location_id: user!.location_id }

  const { data: criticalStock } = useQuery({
    queryKey: ['stock', 'critical-for-stand', user?.location_id],
    queryFn: () => stockApi.getCriticalForStand(user!.location_id!),
  })

  const { data: allStock } = useQuery({
    queryKey: ['stock', 'all', locationFilter],
    queryFn: () => stockApi.getAll(locationFilter),
  })

  const { data: analytics } = useQuery({
    queryKey: ['sales', 'analytics', period, user?.location_id],
    queryFn: () => salesApi.getAnalytics(period, user!.location_id),
  })

  const totalStock = allStock?.reduce((s, i) => s + i.quantity, 0) ?? 0
  const totalSales = analytics?.reduce((s, i) => s + i.total_quantity, 0) ?? 0
  const visibleCritical = showAllCritical ? criticalStock : criticalStock?.slice(0, 5)

  const topSelling = [...(analytics ?? [])]
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, 8)
    .map(i => ({
      name: i.product.name.length > 20 ? i.product.name.slice(0, 20) + '…' : i.product.name,
      vândut: i.total_quantity,
      medie: Number(i.avg_daily.toFixed(1)),
    }))

  const worstSelling = [...(analytics ?? [])]
    .filter(i => i.total_quantity > 0)
    .sort((a, b) => a.total_quantity - b.total_quantity)
    .slice(0, 8)
    .map(i => ({
      name: i.product.name.length > 20 ? i.product.name.slice(0, 20) + '…' : i.product.name,
      vândut: i.total_quantity,
    }))

  const stockCoverage = (allStock ?? [])
    .map(item => {
      const salesData = analytics?.find(a => a.product.id === item.product_id)
      const avgDaily = salesData?.avg_daily ?? 0
      const daysLeft = avgDaily > 0 ? Math.floor(item.quantity / avgDaily) : 999
      return {
        name: (item.products?.name ?? '').length > 18
          ? (item.products?.name ?? '').slice(0, 18) + '…'
          : item.products?.name ?? '',
        zile: daysLeft,
        stoc: item.quantity,
        noSales: avgDaily === 0,
        isCritical: item.quantity <= item.safety_stock,
      }
    })
    .sort((a, b) => a.zile - b.zile)
    .slice(0, 10)

  const productsAtRisk = stockCoverage.filter(i => i.zile < 7 && !i.noSales).length

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <MapPin size={14} className="text-violet-400" />
        <span>Vizualizezi datele pentru standul tău local</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Stoc total stand"
          value={totalStock.toLocaleString()}
          icon={<Package size={18} className="text-blue-400" />}
          color="bg-blue-500/10"
          subtitle="unități disponibile"
        />
        <StatCard
          title="Vânzări perioadă"
          value={totalSales.toLocaleString()}
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          color="bg-emerald-500/10"
          subtitle={`unități în ${period} zile`}
        />
        <StatCard
          title="Stocuri critice"
          value={criticalStock?.length ?? 0}
          icon={<AlertTriangle size={18} className="text-red-400" />}
          color="bg-red-500/10"
          subtitle="necesită reaprovizionare"
          alert={(criticalStock?.length ?? 0) > 0}
        />
        <StatCard
          title="Risc epuizare < 7z"
          value={productsAtRisk}
          icon={<Clock size={18} className="text-orange-400" />}
          color="bg-orange-500/10"
          subtitle="produse aproape de zero"
          alert={productsAtRisk > 0}
        />
      </div>

      {/* Selector perioadă */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Graficele folosesc datele din ultimele{' '}
          <span className="text-slate-300 font-medium">{period} zile</span>
        </p>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Top vândute + Prost vândute */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Top produse vândute"
          icon={<TrendingUp size={14} className="text-emerald-400" />}
          subtitle={`Cele mai vândute 8 produse în ultimele ${period} zile`}
        >
          {topSelling.length === 0 ? (
            <EmptyState text="Nicio vânzare în perioada selectată" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topSelling} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                <XAxis
                  type="number"
                  tick={{ fill: '#475569', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  width={130}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                <Bar dataKey="vândut" name="unități" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {topSelling.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? '#10b981' : '#3b82f6'}
                      fillOpacity={1 - i * 0.06}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Produse cu vânzări slabe"
          icon={<TrendingDown size={14} className="text-orange-400" />}
          subtitle={`Produse active cu cele mai puține vânzări în ${period} zile`}
        >
          {worstSelling.length === 0 ? (
            <EmptyState text="Nicio vânzare în perioada selectată" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={worstSelling} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                <XAxis
                  type="number"
                  tick={{ fill: '#475569', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  width={130}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                <Bar dataKey="vândut" name="unități" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {worstSelling.map((_, i) => (
                    <Cell key={i} fill="#f97316" fillOpacity={0.95 - i * 0.07} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Acoperire stoc */}
      <ChartCard
        title="Zile până la epuizare stoc"
        icon={<Clock size={14} className="text-violet-400" />}
        subtitle={`Calculat pe baza mediei zilnice din ultimele ${period} zile · ∞ = fără vânzări înregistrate`}
      >
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={stockCoverage} margin={{ left: 0, right: 16, top: 4, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v === 999 ? '∞' : String(v)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
            <Bar dataKey="zile" name="zile rămase" radius={[5, 5, 0, 0]} maxBarSize={36}>
              {stockCoverage.map((item, i) => (
                <Cell
                  key={i}
                  fill={
                    item.noSales ? '#334155' :
                    item.zile < 7 ? '#ef4444' :
                    item.zile < 14 ? '#f97316' : '#7c3aed'
                  }
                  fillOpacity={0.9}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-5 mt-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-500" /> sub 7 zile
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> 7–14 zile
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-violet-600" /> peste 14 zile
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-slate-600" /> fără vânzări
          </div>
        </div>
      </ChartCard>

      {/* Medie zilnică */}
      <ChartCard
        title="Medie zilnică vânzări per produs"
        icon={<TrendingUp size={14} className="text-blue-400" />}
        subtitle="Unități/zi — util pentru estimarea comenzilor"
      >
        {topSelling.length === 0 ? (
          <EmptyState text="Nicio vânzare în perioada selectată" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topSelling} margin={{ left: 0, right: 16, top: 4, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
              <Bar dataKey="medie" name="buc/zi" radius={[5, 5, 0, 0]} maxBarSize={36}>
                {topSelling.map((_, i) => (
                  <Cell key={i} fill="#3b82f6" fillOpacity={1 - i * 0.06} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Stocuri critice */}
      {criticalStock && criticalStock.length > 0 && (
        <div className="bg-slate-900 border border-red-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-400" />
            <h3 className="text-sm font-semibold text-red-400">
              Stocuri care necesită reaprovizionare
            </h3>
          </div>
          <div className="space-y-2">
            {visibleCritical?.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-200">{item.products?.name}</p>
                  <p className="text-xs text-slate-500">
                    Vândut {period}z:{' '}
                    <span className="text-slate-400">{item.sold_last_30_days} buc</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${
                    item.quantity <= item.safety_stock ? 'text-red-400' : 'text-orange-400'
                  }`}>
                    {item.quantity} buc
                  </span>
                  <p className="text-xs text-slate-500">
                    comandă min:{' '}
                    <span className="text-violet-400 font-semibold">{item.min_request_qty}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
          {criticalStock.length > 5 && (
            <button
              onClick={() => setShowAllCritical(s => !s)}
              className="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-300 border-t border-slate-800 transition-colors"
            >
              {showAllCritical
                ? '↑ Arată mai puțin'
                : `↓ Vezi toate (${criticalStock.length - 5} mai multe)`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}