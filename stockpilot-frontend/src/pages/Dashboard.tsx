import { useQuery } from '@tanstack/react-query'
import { stockApi, salesApi, suggestionsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  AlertTriangle, TrendingUp, Package, Lightbulb
} from 'lucide-react'
import SalesChart from '../components/charts/SalesChart'
import StockChart from '../components/charts/StockChart'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  subtitle?: string
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()

  const locationFilter = user?.role === 'stand_manager'
    ? { location_id: user.location_id }
    : undefined

  const { data: criticalStock } = useQuery({
    queryKey: ['stock', 'critical'],
    queryFn: stockApi.getCritical,
  })

  const { data: allStock } = useQuery({
    queryKey: ['stock', 'all'],
    queryFn: () => stockApi.getAll(locationFilter),
  })

  const { data: analytics30 } = useQuery({
    queryKey: ['sales', 'analytics', 30],
    queryFn: () => salesApi.getAnalytics(30),
  })

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions'],
    queryFn: suggestionsApi.getAll,
    enabled: user?.role !== 'stand_manager',
  })

  const totalStock = allStock?.reduce((sum, s) => sum + s.quantity, 0) ?? 0
  const totalSales30 = analytics30?.reduce((sum, s) => sum + s.total_quantity, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Stoc total"
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
          subtitle="unități vândute"
        />
        {user?.role !== 'stand_manager' && (
          <StatCard
            title="Sugestii active"
            value={suggestions?.length ?? 0}
            icon={<Lightbulb size={18} className="text-violet-400" />}
            color="bg-violet-500/10"
            subtitle="recomandări în așteptare"
          />
        )}
      </div>

      {/* Grafice */}
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
            {criticalStock.slice(0, 5).map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {item.products?.name}
                  </p>
                  <p className="text-xs text-slate-500">{item.locations?.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-red-400">{item.quantity} buc</span>
                  <p className="text-xs text-slate-500">min: {item.safety_stock}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}