import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { locationsApi, salesApi, stockApi } from '../services/api'
import { ArrowLeft, MapPin, Package, TrendingUp, AlertTriangle, BoxesIcon } from 'lucide-react'
import { useState } from 'react'

const getStockStatus = (quantity: number, safety: number) => {
  if (quantity <= safety)      return { label: 'Critic',  color: 'text-red-400 bg-red-500/10' }
  if (quantity <= safety * 2)  return { label: 'Scăzut',  color: 'text-orange-400 bg-orange-500/10' }
  if (quantity >= safety * 8)  return { label: 'Surplus', color: 'text-blue-400 bg-blue-500/10' }
  return                              { label: 'Normal',  color: 'text-emerald-400 bg-emerald-500/10' }
}

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [analyticsDays, setAnalyticsDays] = useState<30 | 60 | 90>(30)

  const locationId = Number(id)

  const { data: location, isLoading: loadingLocation } = useQuery({
    queryKey: ['location', locationId],
    queryFn: () => locationsApi.getById(locationId),
    enabled: !!locationId,
  })

  const { data: stock } = useQuery({
    queryKey: ['stock', locationId],
    queryFn: () => stockApi.getAll({ location_id: locationId }),
    enabled: !!locationId,
  })

  const { data: analytics } = useQuery({
    queryKey: ['sales', 'analytics', analyticsDays, locationId],
    queryFn: () => salesApi.getAnalytics(analyticsDays, locationId),
    enabled: !!locationId,
  })

  if (loadingLocation) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm">
        Se încarcă...
      </div>
    )
  }

  if (!location) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-slate-500">Locația nu a fost găsită</p>
        <button onClick={() => navigate(-1)} className="text-violet-400 text-sm hover:underline">
          Înapoi
        </button>
      </div>
    )
  }

  // Statistici rapide
  const totalStock    = stock?.reduce((s, i) => s + i.quantity, 0) ?? 0
  const criticalItems = stock?.filter(i => i.quantity <= i.safety_stock) ?? []
  const surplusItems  = stock?.filter(i => i.quantity >= i.safety_stock * 8) ?? []
  const totalSales    = analytics?.reduce((s, i) => s + i.total_quantity, 0) ?? 0

  // Top produse vândute
  const topSales = [...(analytics ?? [])]
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-0.5 p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium
              ${location.type === 'warehouse'
                ? 'bg-blue-500/10 text-blue-400'
                : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {location.type === 'warehouse' ? 'Depozit' : 'Stand'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">{location.name}</h1>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
            <MapPin size={14} />
            <span>{location.city}{location.address ? ` — ${location.address}` : ''}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BoxesIcon size={16} className="text-blue-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Stoc total</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{totalStock.toLocaleString()}</p>
          <p className="text-xs text-slate-600 mt-1">{stock?.length ?? 0} produse distincte</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Stocuri critice</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{criticalItems.length}</p>
          <p className="text-xs text-slate-600 mt-1">necesită reaprovizionare</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-emerald-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Vânzări</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{totalSales.toLocaleString()}</p>
          <p className="text-xs text-slate-600 mt-1">ultimele {analyticsDays} zile</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package size={16} className="text-blue-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Surplus</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{surplusItems.length}</p>
          <p className="text-xs text-slate-600 mt-1">produse în exces</p>
        </div>
      </div>

      {/* Grafice */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Vânzări cu selector de perioadă */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">Top produse vândute</h3>
            <div className="flex gap-1">
              {([30, 60, 90] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setAnalyticsDays(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                    ${analyticsDays === d
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  {d}z
                </button>
              ))}
            </div>
          </div>

          {topSales.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
              Nu există date de vânzări
            </div>
          ) : (
            <div className="space-y-3">
              {topSales.map((item, i) => {
                const max = topSales[0].total_quantity
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
                          className="bg-violet-500 h-1.5 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600 shrink-0 w-16 text-right">
                        ~{item.avg_daily}/zi
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Distribuție stoc pe categorii */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Distribuție stoc pe categorii</h3>
          <StockByCategory stock={stock ?? []} />
        </div>
      </div>

      {/* Tabel stocuri complete */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">Stocuri complete</h3>
          <span className="text-xs text-slate-500">{stock?.length ?? 0} produse</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produs</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categorie</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cantitate</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stoc minim</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {stock
                ?.sort((a, b) => a.quantity - b.quantity) // critice primele
                .map(item => {
                  const status = getStockStatus(item.quantity, item.safety_stock)
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {item.quantity <= item.safety_stock && (
                            <AlertTriangle size={13} className="text-red-400 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-slate-200">{item.products?.name}</p>
                            <p className="text-xs text-slate-600 font-mono">{item.products?.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          {item.products?.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-100">
                        {item.quantity}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        {item.safety_stock}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Componentă internă — distribuție stoc pe categorii
function StockByCategory({ stock }: { stock: ReturnType<typeof Array.prototype.filter> }) {
  const byCategory = stock.reduce((acc: Record<string, number>, item: any) => {
    const cat = item.products?.category ?? 'Altele'
    acc[cat] = (acc[cat] ?? 0) + item.quantity
    return acc
  }, {})

  const total = Object.values(byCategory).reduce((s: number, v) => s + (v as number), 0)
  const sorted = Object.entries(byCategory).sort(([, a], [, b]) => (b as number) - (a as number))

  const COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-red-500', 'bg-cyan-500', 'bg-pink-500', 'bg-yellow-500']

  if (sorted.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
        Nu există date
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sorted.map(([category, qty], i) => {
        const pct = Math.round(((qty as number) / (total as number)) * 100)
        return (
          <div key={category} className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">{category}</span>
              <span className="text-slate-400">{qty as number} buc <span className="text-slate-600 text-xs">({pct}%)</span></span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div
                className={`${COLORS[i % COLORS.length]} h-1.5 rounded-full transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}