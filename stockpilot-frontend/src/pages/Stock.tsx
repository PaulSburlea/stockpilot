import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockApi, locationsApi, type CriticalStandItem, suggestionsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Search, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Stock() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [criticalItems, setCriticalItems] = useState<CriticalStandItem[]>([])
  const [requestQuantities, setRequestQuantities] = useState<Record<number, number>>({})
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)

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

  const openRequestModal = async () => {
    if (!user?.location_id) return
    setIsLoadingRequests(true)
    try {
      const data = await stockApi.getCriticalForStand(user.location_id)
      setCriticalItems(data)
      const initial: Record<number, number> = {}
      data.forEach(item => {
        initial[item.product_id] = item.min_request_qty
      })
      setRequestQuantities(initial)
      setIsRequestModalOpen(true)
    } catch (err) {
      console.error(err)
      alert('Nu s-au putut încărca produsele în stoc critic pentru acest stand.')
    } finally {
      setIsLoadingRequests(false)
    }
  }

  const handleQuantityChange = (productId: number, minQty: number, value: string) => {
    const numeric = Number(value)
    const valid = Number.isFinite(numeric) && numeric >= minQty ? numeric : minQty
    setRequestQuantities(prev => ({ ...prev, [productId]: valid }))
  }

  const sendRequest = async () => {
    if (!user?.location_id || criticalItems.length === 0) {
      setIsRequestModalOpen(false)
      return
    }

    const items = criticalItems.map(item => ({
      product_id: item.product_id,
      quantity: requestQuantities[item.product_id] ?? item.min_request_qty,
    }))

    try {
      await suggestionsApi.createFromStand({
        location_id: user.location_id,
        items,
      })
      setIsRequestModalOpen(false)
      alert('Cererea a fost trimisă către depozit.')
    } catch (err) {
      console.error(err)
      alert('A apărut o eroare la trimiterea cererii.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header + acțiuni */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Stocuri</h1>
          <p className="text-xs text-slate-500">
            Vizualizează stocurile pe produse și locații.
          </p>
        </div>
        {user?.role === 'stand_manager' && (
          <button
            disabled={isLoadingRequests}
            onClick={openRequestModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoadingRequests ? 'Se încarcă...' : 'SOLICITĂ PRODUSE'}
          </button>
        )}
      </div>

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

      {/* Modal solicitare produse */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Solicită produse</h2>
                <p className="text-xs text-slate-500">
                  Produsele afișate sunt în stoc critic în acest stand. Cantitatea minimă cerută este mai mare decât numărul de produse vândute în ultima lună + 10.
                </p>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {criticalItems.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nu există produse în stoc critic pentru acest stand.
              </p>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden mb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60">
                        <th className="px-4 py-2 text-left text-slate-500 uppercase tracking-wider">Produs</th>
                        <th className="px-4 py-2 text-right text-slate-500 uppercase tracking-wider">Stoc curent</th>
                        <th className="px-4 py-2 text-right text-slate-500 uppercase tracking-wider">Vândut 30 zile</th>
                        <th className="px-4 py-2 text-right text-slate-500 uppercase tracking-wider">Cantitate minimă cerere</th>
                        <th className="px-4 py-2 text-right text-slate-500 uppercase tracking-wider">Cantitate cerută</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {criticalItems.map(item => (
                        <tr key={item.id} className="bg-slate-900/40">
                          <td className="px-4 py-2 text-slate-200">
                            <div className="font-medium">{item.products?.name}</div>
                            <div className="text-[11px] text-slate-500">{item.products?.sku}</div>
                          </td>
                          <td className="px-4 py-2 text-right text-slate-100">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-100">
                            {item.sold_last_30_days}
                          </td>
                          <td className="px-4 py-2 text-right text-emerald-400 font-semibold">
                            {item.min_request_qty}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              min={item.min_request_qty}
                              value={requestQuantities[item.product_id] ?? item.min_request_qty}
                              onChange={e =>
                                handleQuantityChange(item.product_id, item.min_request_qty, e.target.value)
                              }
                              className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded-md text-right text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100"
              >
                Anulează
              </button>
              <button
                onClick={sendRequest}
                disabled={criticalItems.length === 0}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Trimite cererea către depozit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}