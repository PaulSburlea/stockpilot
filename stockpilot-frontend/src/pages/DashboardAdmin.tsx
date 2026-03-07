import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockApi, salesApi, suggestionsApi } from '../services/api'
import { AlertTriangle, TrendingUp, Package, Lightbulb, PackageX } from 'lucide-react'
import SalesChart from '../components/charts/SalesChart'
import StockChart from '../components/charts/StockChart'

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
      ${alert ? 'border-amber-500/30' : 'border-slate-800'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${alert ? 'text-amber-400' : 'text-slate-100'}`}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  )
}

export default function DashboardAdmin() {
  const [showAllCritical, setShowAllCritical] = useState(false)
  const [showAllStale, setShowAllStale]       = useState(false)

  const { data: criticalStock } = useQuery({
    queryKey: ['stock', 'critical'],
    queryFn: () => stockApi.getCritical(),
  })

  const { data: allStock } = useQuery({
    queryKey: ['stock', 'all'],
    queryFn: () => stockApi.getAll(),
  })

  const { data: analytics30 } = useQuery({
    queryKey: ['sales', 'analytics', 30],
    queryFn: () => salesApi.getAnalytics(30),
  })

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions'],
    queryFn: suggestionsApi.getAll,
  })

  const { data: staleStock } = useQuery({
    queryKey: ['stock', 'stale-network'],
    queryFn: () => stockApi.getStaleNetwork(),
  })

  const totalStock    = allStock?.reduce((s, i) => s + Number(i.quantity), 0) ?? 0
  const totalSales30  = analytics30?.reduce((s, i) => s + Number(i.total_quantity), 0) ?? 0
  const visibleCritical = showAllCritical ? criticalStock : criticalStock?.slice(0, 5)
  const visibleStale    = showAllStale    ? staleStock    : staleStock?.slice(0, 5)

  // Unități totale blocate în rețea
  const totalStaleUnits = staleStock?.reduce((s, i) => s + Number(i.quantity), 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Stoc total rețea"
          value={totalStock.toLocaleString()}
          icon={<Package size={18} className="text-blue-400" />}
          color="bg-blue-500/10"
          subtitle="unități în toate locațiile"
        />
        <StatCard
          title="Stocuri critice"
          value={criticalStock?.length ?? 0}
          icon={<AlertTriangle size={18} className="text-red-400" />}
          color="bg-red-500/10"
          subtitle="necesită atenție"
        />
        <StatCard
          title="Vânzări 30 zile"
          value={totalSales30.toLocaleString()}
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          color="bg-emerald-500/10"
          subtitle="unități vândute în rețea"
        />
        <StatCard
          title="Stoc blocat rețea"
          value={staleStock?.length ?? 0}
          icon={<PackageX size={18} className="text-amber-400" />}
          color="bg-amber-500/10"
          subtitle={totalStaleUnits > 0 ? `${totalStaleUnits} buc imobilizate` : 'produse fără vânzări'}
          alert={(staleStock?.length ?? 0) > 0}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Vânzări pe locații (30 zile)
          </h3>
          <SalesChart data={analytics30 ?? []} />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Distribuție stoc per locație
          </h3>
          <StockChart data={allStock ?? []} />
        </div>
      </div>

      {/* Stocuri critice */}
      {criticalStock && criticalStock.length > 0 && (
        <div className="bg-slate-900 border border-red-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-400" />
            <h3 className="text-sm font-semibold text-red-400">Stocuri critice</h3>
          </div>
          <div className="space-y-2">
            {visibleCritical?.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-200">{item.products?.name}</p>
                  <p className="text-xs text-slate-500">{item.locations?.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-red-400">{item.quantity} buc</span>
                  <p className="text-xs text-slate-500">min: {item.safety_stock}</p>
                </div>
              </div>
            ))}
          </div>
          {criticalStock.length > 5 && (
            <button
              onClick={() => setShowAllCritical(s => !s)}
              className="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-300 border-t border-slate-800 transition-colors"
            >
              {showAllCritical ? '↑ Arată mai puțin' : `↓ Vezi toate (${criticalStock.length - 5} mai multe)`}
            </button>
          )}
        </div>
      )}

      {/* Stoc blocat în rețea */}
      {staleStock && staleStock.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <PackageX size={16} className="text-amber-400" />
              <div>
                <h3 className="text-sm font-semibold text-amber-400">Stoc blocat în rețea</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Produse fără vânzări peste pragul configurat per locație
                </p>
              </div>
            </div>
            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium shrink-0">
              {totalStaleUnits} buc imobilizate
            </span>
          </div>

          <div className="space-y-2">
            {visibleStale?.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-200">{item.products?.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.locations?.name} · {item.locations?.city}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {item.last_sale_at
                      ? `Ultima vânzare: ${new Date(item.last_sale_at).toLocaleDateString('ro-RO')}`
                      : 'Niciodată vândut la acest stand'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-amber-400">{item.quantity} buc</span>
                  <p className="text-xs text-slate-500">
                    {item.days_since_last_sale === 9999 ? '∞' : item.days_since_last_sale} zile blocate
                  </p>
                </div>
              </div>
            ))}
          </div>

          {staleStock.length > 5 && (
            <button
              onClick={() => setShowAllStale(s => !s)}
              className="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-300 border-t border-slate-800 transition-colors"
            >
              {showAllStale ? '↑ Arată mai puțin' : `↓ Vezi toate (${staleStock.length - 5} mai multe)`}
            </button>
          )}

          <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-800 italic">
            Algoritmul de sugestii redistribuie automat acest stoc către standuri unde produsele se vând.
          </p>
        </div>
      )}

      {/* Sugestii */}
      {suggestions && suggestions.length > 0 && (
        <div className="bg-slate-900 border border-violet-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={16} className="text-violet-400" />
            <h3 className="text-sm font-semibold text-violet-400">
              {suggestions.length} sugestii în așteptare
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Vezi pagina Sugestii pentru a aproba sau respinge recomandările algoritmului.
          </p>
        </div>
      )}
    </div>
  )
}