import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { salesApi, stockApi, locationsApi, productsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { ShoppingCart, TrendingUp, Package } from 'lucide-react'

export default function Sales() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  // Dacă vine din shortcut-ul din Stocuri, produsul e pre-selectat
  const preselectedProduct = searchParams.get('product_id')
  const preselectedLocation = searchParams.get('location_id')

  const [form, setForm] = useState({
    location_id: preselectedLocation ?? (user?.role === 'stand_manager' ? String(user.location_id) : ''),
    product_id: preselectedProduct ?? '',
    quantity: '1',
  })
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
  })

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll(),
  })

  // Stocul curent pentru produsul + locația selectată
  const { data: currentStock } = useQuery({
    queryKey: ['stock', form.location_id, form.product_id],
    queryFn: () => stockApi.getAll({
      location_id: Number(form.location_id),
      product_id: Number(form.product_id),
    }),
    enabled: !!form.location_id && !!form.product_id,
  })

  // Ultimele vânzări înregistrate pentru contextul utilizatorului
  const { data: analytics } = useQuery({
    queryKey: ['sales', 'analytics', 30, form.location_id],
    queryFn: () => salesApi.getAnalytics(30, Number(form.location_id)),
    enabled: !!form.location_id,
  })

  const saleMutation = useMutation({
    mutationFn: salesApi.create,
    onSuccess: (data) => {
      setSuccessMsg(`✓ Vânzare înregistrată! Stoc rămas: ${data.new_stock} buc`)
      setErrorMsg('')
      setForm(f => ({ ...f, quantity: '1' }))
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      setTimeout(() => setSuccessMsg(''), 4000)
    },
    onError: (err: Error) => {
      setErrorMsg(err.message)
      setSuccessMsg('')
    },
  })

  const handleSubmit = () => {
    setErrorMsg('')
    if (!form.location_id || !form.product_id || !form.quantity) {
      setErrorMsg('Completează toate câmpurile')
      return
    }
    if (parseInt(form.quantity) <= 0) {
      setErrorMsg('Cantitatea trebuie să fie mai mare ca 0')
      return
    }
    saleMutation.mutate({
      location_id: Number(form.location_id),
      product_id: Number(form.product_id),
      quantity: parseInt(form.quantity),
    })
  }

  const stockInfo = currentStock?.[0]
  const stands = locations?.filter(l => l.type === 'stand') ?? []

  // Top produse vândute azi în locația selectată
  const topProducts = analytics
    ?.sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, 5) ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Formular înregistrare */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart size={18} className="text-violet-400" />
            <h2 className="text-base font-semibold text-slate-100">Înregistrează vânzare</h2>
          </div>

          {/* Locație */}
          {user?.role !== 'stand_manager' ? (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Locație *
              </label>
              <select
                value={form.location_id}
                onChange={e => setForm(f => ({ ...f, location_id: e.target.value, product_id: '' }))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Selectează locația</option>
                {stands.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name} — {loc.city}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Locație</label>
              <div className="px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
                {locations?.find(l => l.id === user.location_id)?.name ?? 'Stand local'}
              </div>
            </div>
          )}

          {/* Produs */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Produs *
            </label>
            <select
              value={form.product_id}
              onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Selectează produsul</option>
              {products?.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>
              ))}
            </select>
          </div>

          {/* Info stoc curent */}
          {stockInfo && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm
              ${stockInfo.quantity <= stockInfo.safety_stock
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-slate-800 border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 text-slate-400">
                <Package size={14} />
                <span>Stoc disponibil</span>
              </div>
              <span className={`font-bold ${stockInfo.quantity <= stockInfo.safety_stock ? 'text-red-400' : 'text-slate-100'}`}>
                {stockInfo.quantity} buc
                {stockInfo.quantity <= stockInfo.safety_stock && (
                  <span className="ml-2 text-xs font-normal text-red-400">— stoc critic!</span>
                )}
              </span>
            </div>
          )}

          {/* Cantitate */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Cantitate vândută *
            </label>
            <div className="flex gap-2">
              {/* Butoane rapide */}
              {[1, 2, 5, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setForm(f => ({ ...f, quantity: String(n) }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${form.quantity === String(n)
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center"
              />
            </div>
          </div>

          {/* Feedback */}
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-sm text-emerald-400">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saleMutation.isPending || !form.location_id || !form.product_id}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {saleMutation.isPending ? 'Se înregistrează...' : 'Înregistrează vânzare'}
          </button>
        </div>

        {/* Top produse vândute */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Top vânzări — ultimele 30 zile
            </h2>
          </div>

          {!form.location_id ? (
            <div className="text-center py-10 text-slate-600 text-sm">
              Selectează o locație pentru a vedea statisticile
            </div>
          ) : topProducts.length === 0 ? (
            <div className="text-center py-10 text-slate-600 text-sm">
              Nu există date de vânzări pentru această locație
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((item, index) => {
                const maxQty = topProducts[0].total_quantity
                const pct = Math.round((item.total_quantity / maxQty) * 100)
                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 truncate flex-1 mr-3">
                        {item.product.name}
                      </span>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-100">{item.total_quantity}</span>
                        <span className="text-slate-500 text-xs ml-1">buc</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div
                        className="bg-violet-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-600">
                      ~{item.avg_daily} buc/zi medie
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}