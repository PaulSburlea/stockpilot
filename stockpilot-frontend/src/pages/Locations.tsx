import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { locationsApi, stockApi } from '../services/api'
import { Warehouse, Store, MapPin, ChevronRight, AlertTriangle } from 'lucide-react'

export default function Locations() {
  const navigate = useNavigate()

  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
  })

  const { data: allStock } = useQuery({
    queryKey: ['stock', 'all'],
    queryFn: () => stockApi.getAll(),
  })

  const { data: criticalStock } = useQuery({
    queryKey: ['stock', 'critical'],
    queryFn: stockApi.getCritical,
  })

  const getLocationStats = (locationId: number) => {
    const stock = allStock?.filter(s => s.location_id === locationId) ?? []
    const critical = criticalStock?.filter(s => s.location_id === locationId) ?? []
    const totalQty = stock.reduce((s, i) => s + i.quantity, 0)
    return { totalQty, criticalCount: critical.length, productCount: stock.length }
  }

  const warehouse = locations?.find(l => l.type === 'warehouse')
  const stands    = locations?.filter(l => l.type === 'stand') ?? []

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Se încarcă...</div>
      ) : (
        <>
          {/* Depozit central */}
          {warehouse && (() => {
            const stats = getLocationStats(warehouse.id)
            return (
              <div>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Depozit central
                </h2>
                <div
                  onClick={() => navigate(`/locations/${warehouse.id}`)}
                  className="bg-slate-900 border border-blue-500/20 rounded-xl p-5 cursor-pointer hover:border-blue-500/40 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-blue-500/10">
                        <Warehouse size={22} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-100">{warehouse.name}</p>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                          <MapPin size={11} />
                          {warehouse.city}
                          {warehouse.address && ` — ${warehouse.address}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-100">{stats.totalQty.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">unități stoc</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-100">{stats.productCount}</p>
                        <p className="text-xs text-slate-500">produse</p>
                      </div>
                      <ChevronRight size={18} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Standuri */}
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Standuri ({stands.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {stands.map(stand => {
                const stats = getLocationStats(stand.id)
                return (
                  <div
                    key={stand.id}
                    onClick={() => navigate(`/locations/${stand.id}`)}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 cursor-pointer hover:border-violet-500/30 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10">
                          <Store size={18} className="text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100 text-sm">{stand.name}</p>
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                            <MapPin size={10} />
                            {stand.city}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors mt-0.5" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-800 rounded-lg py-2">
                        <p className="text-sm font-bold text-slate-100">{stats.totalQty.toLocaleString()}</p>
                        <p className="text-xs text-slate-600">stoc</p>
                      </div>
                      <div className="bg-slate-800 rounded-lg py-2">
                        <p className="text-sm font-bold text-slate-100">{stats.productCount}</p>
                        <p className="text-xs text-slate-600">produse</p>
                      </div>
                      <div className={`rounded-lg py-2 ${stats.criticalCount > 0 ? 'bg-red-500/10' : 'bg-slate-800'}`}>
                        <p className={`text-sm font-bold ${stats.criticalCount > 0 ? 'text-red-400' : 'text-slate-100'}`}>
                          {stats.criticalCount}
                        </p>
                        <p className="text-xs text-slate-600 flex items-center justify-center gap-0.5">
                          {stats.criticalCount > 0 && <AlertTriangle size={9} className="text-red-500" />}
                          critic
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}