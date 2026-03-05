import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockApi, salesApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { AlertTriangle, TrendingUp, Package, MapPin, TrendingDown, Clock } from 'lucide-react'

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
            ${value === p ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
        >
          {p}z
        </button>
      ))}
    </div>
  )
}

function ChartCard({ title, icon, subtitle, children }: {
  title: string
  icon: React.ReactNode
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-slate-600 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  )
}

const EmptyState = ({ text }: { text: string }) => (
  <div className="h-48 flex items-center justify-center text-slate-600 text-sm">{text}</div>
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

  const worstSelling = [...(analytics ?? [])]
    .filter(i => i.total_quantity > 0)
    .sort((a, b) => a.total_quantity - b.total_quantity)
    .slice(0, 8)

  const stockCoverage = (allStock ?? [])
    .map(item => {
      const salesData = analytics?.find(a => a.product.id === item.product_id)
      const avgDaily = salesData?.avg_daily ?? 0
      const daysLeft = avgDaily > 0 ? Math.floor(item.quantity / avgDaily) : null
      return {
        name: item.products?.name ?? '',
        zile: daysLeft,
        stoc: item.quantity,
        noSales: avgDaily === 0,
        isCritical: item.quantity <= item.safety_stock,
        avgDaily,
      }
    })
    .sort((a, b) => (a.zile ?? 9999) - (b.zile ?? 9999))
    .slice(0, 10)

  // Afișăm graficul doar dacă cel puțin 2 produse au date de vânzări
  const validCoverageItems = stockCoverage.filter(i => !i.noSales)
  const showCoverageChart = validCoverageItems.length >= 2

  const productsAtRisk = validCoverageItems.filter(i => i.zile! < 7).length
  const maxCoverage = Math.max(...validCoverageItems.map(i => i.zile ?? 0), 1)

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
            <div className="space-y-3">
              {topSelling.map((item, i) => {
                const max = topSelling[0].total_quantity
                const pct = Math.round((item.total_quantity / max) * 100)
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300 truncate flex-1 mr-3">{item.product.name}</span>
                      <span className="font-bold text-slate-100 shrink-0">{item.total_quantity} buc</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600 shrink-0 w-16 text-right">
                        ~{item.avg_daily.toFixed(1)}/zi
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
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
            <div className="space-y-3">
              {worstSelling.map((item, i) => {
                const max = worstSelling[worstSelling.length - 1].total_quantity
                const pct = Math.max(Math.round((item.total_quantity / max) * 100), 4)
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300 truncate flex-1 mr-3">{item.product.name}</span>
                      <span className="font-bold text-slate-100 shrink-0">{item.total_quantity} buc</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                        <div
                          className="bg-orange-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600 shrink-0 w-16 text-right">
                        ~{item.avg_daily.toFixed(1)}/zi
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Acoperire stoc — afișat doar dacă există date suficiente */}
      {showCoverageChart && (
        <ChartCard
          title="Zile până la epuizare stoc"
          icon={<Clock size={14} className="text-violet-400" />}
          subtitle={`Calculat pe baza mediei zilnice din ultimele ${period} zile`}
        >
          <div className="space-y-3">
            {validCoverageItems.map((item, i) => {
              const pct = Math.max(Math.round((item.zile! / maxCoverage) * 100), 4)
              const barColor =
                item.zile! < 7 ? 'bg-red-500' :
                item.zile! < 14 ? 'bg-orange-500' : 'bg-violet-500'
              const textColor =
                item.zile! < 7 ? 'text-red-400' :
                item.zile! < 14 ? 'text-orange-400' : 'text-slate-100'

              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300 truncate flex-1 mr-3">{item.name}</span>
                    <span className={`font-bold shrink-0 ${textColor}`}>
                      {item.zile} zile
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                      <div
                        className={`${barColor} h-1.5 rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-600 shrink-0 w-16 text-right">
                      {item.stoc} buc
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-5 mt-4 pt-3 border-t border-slate-800 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500" /> sub 7 zile
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> 7–14 zile
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> peste 14 zile
            </div>
          </div>
        </ChartCard>
      )}

      {/* Medie zilnică */}
      <ChartCard
        title="Medie zilnică vânzări per produs"
        icon={<TrendingUp size={14} className="text-blue-400" />}
        subtitle="Unități/zi — util pentru estimarea comenzilor"
      >
        {topSelling.length === 0 ? (
          <EmptyState text="Nicio vânzare în perioada selectată" />
        ) : (
          <div className="space-y-3">
            {topSelling.map((item, i) => {
              const max = Math.max(...topSelling.map(s => s.avg_daily), 0.1)
              const pct = Math.max(Math.round((item.avg_daily / max) * 100), 4)
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300 truncate flex-1 mr-3">{item.product.name}</span>
                    <span className="font-bold text-slate-100 shrink-0">
                      {item.avg_daily.toFixed(2)} buc/zi
                    </span>
                  </div>
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
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