import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockApi, locationsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Search, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Stock() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
  })

  const { data: stock, isLoading } = useQuery({
    queryKey: ['stock', selectedLocation],
    queryFn: () => stockApi.getAll(
      user?.role === 'stand_manager'
        ? { location_id: user.location_id }
        : selectedLocation ? { location_id: Number(selectedLocation) } : undefined
    ),
  })

  const filtered = stock?.filter(item =>
    item.products?.name.toLowerCase().includes(search.toLowerCase()) ||
    item.products?.sku.toLowerCase().includes(search.toLowerCase()) ||
    item.locations?.city.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const getStockStatus = (quantity: number, safety: number) => {
    if (quantity <= safety) return { label: 'Critic', color: 'text-red-400 bg-red-500/10' }
    if (quantity <= safety * 2) return { label: 'Scăzut', color: 'text-orange-400 bg-orange-500/10' }
    if (quantity >= safety * 8) return { label: 'Surplus', color: 'text-blue-400 bg-blue-500/10' }
    return { label: 'Normal', color: 'text-emerald-400 bg-emerald-500/10' }
  }

  return (
    <div className="space-y-5">
      {/* Filtre */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Caută după produs, SKU sau oraș..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {user?.role !== 'stand_manager' && (
          <select
            value={selectedLocation}
            onChange={e => setSelectedLocation(e.target.value)}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Toate locațiile</option>
            {locations?.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produs</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Locație</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cantitate</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stoc minim</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Se încarcă...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Nu există rezultate
                  </td>
                </tr>
              ) : filtered.map(item => {
                const status = getStockStatus(item.quantity, item.safety_stock)
                return (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {item.quantity <= item.safety_stock && (
                          <AlertTriangle size={14} className="text-red-400 shrink-0" />
                        )}
                        <span className="font-medium text-slate-200">
                          {item.products?.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">
                      {item.products?.sku}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/locations/${item.location_id}`}
                        className="group"
                      >
                        <p className="text-slate-300 group-hover:text-violet-400 transition-colors">
                          {item.locations?.name}
                        </p>
                        <p className="text-xs text-slate-500">{item.locations?.city}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-100">
                      {item.quantity}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-500">
                      {item.safety_stock}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => navigate(`/sales?product_id=${item.product_id}&location_id=${item.location_id}`)}
                        className="text-xs px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 rounded-lg transition-colors whitespace-nowrap"
                      >
                        + Vânzare
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer tabel */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
            {filtered.length} înregistrări
          </div>
        )}
      </div>
    </div>
  )
}