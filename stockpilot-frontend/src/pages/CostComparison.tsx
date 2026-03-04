import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { costComparisonApi, locationsApi, productsApi } from '../services/api'
import type { CostOption, CostComparison } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import {
  ArrowRight, CheckCircle, XCircle, Zap,
  TrendingDown, Package, Truck, Store, Clock
} from 'lucide-react'

const typeConfig = {
  transfer: { icon: <ArrowRight size={16} />, color: '#7c3aed', bg: 'bg-violet-500/10 border-violet-500/20' },
  warehouse: { icon: <Store size={16} />, color: '#2563eb', bg: 'bg-blue-500/10 border-blue-500/20' },
  supplier:  { icon: <Truck size={16} />, color: '#059669', bg: 'bg-emerald-500/10 border-emerald-500/20' },
}

function CostBreakdown({ option }: { option: CostOption }) {
  const config = typeConfig[option.type]
  const isRecommended = option.recommended
  const isCheapest = false

  return (
    <div className={`border rounded-xl p-5 space-y-4 relative
      ${isRecommended
        ? 'border-violet-500 bg-violet-500/5'
        : `${config.bg}`
      }`}
    >
      {/* Badge recomandat */}
      {isRecommended && (
        <div className="absolute -top-3 left-5">
          <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            ✓ Recomandat
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between pt-1">
        <div className="flex items-center gap-2">
          <div style={{ color: config.color }}>{config.icon}</div>
          <div>
            <p className="text-sm font-semibold text-slate-100">{option.label}</p>
            {option.from_city && (
              <p className="text-xs text-slate-500 mt-0.5">{option.from_location_name}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-100">{option.total_cost} RON</p>
          <p className="text-xs text-slate-500">{option.costs.per_unit} RON/buc</p>
        </div>
      </div>

      {/* Breakdown costuri */}
      <div className="space-y-2 bg-slate-900/60 rounded-lg p-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Detalii cost
        </p>
        {option.costs.acquisition !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Achiziție ({option.quantity} buc)</span>
            <span className="text-slate-200 font-medium">{option.costs.acquisition} RON</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Cost fix transport</span>
          <span className="text-slate-200 font-medium">{option.costs.fixed} RON</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Cost variabil (greutate)</span>
          <span className="text-slate-200 font-medium">{option.costs.variable} RON</span>
        </div>
        <div className="flex justify-between text-sm font-semibold border-t border-slate-700 pt-2 mt-1">
          <span className="text-slate-300">Total</span>
          <span style={{ color: config.color }}>{option.total_cost} RON</span>
        </div>
      </div>

      {/* Lead time */}
      <div className="flex items-center gap-2 text-sm">
        <Clock size={14} className="text-slate-500" />
        <span className="text-slate-400">
          Disponibil în{' '}
          <span className="text-slate-200 font-semibold">
            {option.lead_time_days} {option.lead_time_days === 1 ? 'zi' : 'zile'}
          </span>
        </span>
      </div>

      {/* Stoc disponibil dacă e transfer */}
      {option.available_stock !== null && (
        <div className="flex items-center gap-2 text-sm">
          <Package size={14} className="text-slate-500" />
          <span className="text-slate-400">
            Stoc disponibil:{' '}
            <span className="text-slate-200 font-semibold">{option.available_stock} buc</span>
            {option.transferable_qty !== null && (
              <span className="text-slate-600"> ({option.transferable_qty} transferabile)</span>
            )}
          </span>
        </div>
      )}

      {/* Pro / Contra */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          {option.pros.map((pro, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-emerald-400">
              <CheckCircle size={11} className="mt-0.5 shrink-0" />
              <span>{pro}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {option.cons.map((con, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-400">
              <XCircle size={11} className="mt-0.5 shrink-0" />
              <span>{con}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ComparisonChart({ options }: { options: CostOption[] }) {
  const data = options.map(o => ({
    name: o.type === 'transfer' ? `Transfer\n${o.from_city}` :
          o.type === 'warehouse' ? 'Depozit\ncentral' : 'Furnizor\nextern',
    total: o.total_cost,
    fixed: o.costs.fixed,
    variable: o.costs.variable,
    acquisition: o.costs.acquisition ?? 0,
    color: typeConfig[o.type].color,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit=" RON" />
        <Tooltip
          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={(value: number | undefined) => [`${value ?? 0} RON`]}
        />
        <Bar dataKey="total" name="Cost total" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function CostComparison() {
  const [form, setForm] = useState({
    product_id: '',
    to_location_id: '',
    quantity: '20',
  })
  const [result, setResult] = useState<CostComparison | null>(null)

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll(),
  })

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
  })

  const compareMutation = useMutation({
    mutationFn: costComparisonApi.compare,
    onSuccess: (data) => setResult(data),
  })

  const stands = locations?.filter(l => l.type === 'stand') ?? []

  const handleCompare = () => {
    if (!form.product_id || !form.to_location_id || !form.quantity) return
    compareMutation.mutate({
      product_id: Number(form.product_id),
      to_location_id: Number(form.to_location_id),
      quantity: Number(form.quantity),
    })
  }

  const savings = result
    ? result.options[result.options.length - 1].total_cost - result.options[0].total_cost
    : 0

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Formular */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">
          Configurează comparația
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Produs</label>
            <select
              value={form.product_id}
              onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Selectează produsul</option>
              {products?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Locație destinație
            </label>
            <select
              value={form.to_location_id}
              onChange={e => setForm(f => ({ ...f, to_location_id: e.target.value }))}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Selectează standul</option>
              {stands.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name} — {loc.city}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Cantitate necesară
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={handleCompare}
                disabled={compareMutation.isPending || !form.product_id || !form.to_location_id}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                {compareMutation.isPending ? 'Se calculează...' : 'Compară'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rezultate */}
      {result && (
        <div className="space-y-5">
          {/* Sumar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={16} className="text-emerald-400" />
                <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Cea mai ieftină
                </span>
              </div>
              <p className="text-lg font-bold text-emerald-400">{result.cheapest.total_cost} RON</p>
              <p className="text-xs text-slate-500 mt-1">{result.cheapest.label}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-yellow-400" />
                <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Cea mai rapidă
                </span>
              </div>
              <p className="text-lg font-bold text-yellow-400">
                {result.fastest.lead_time_days} {result.fastest.lead_time_days === 1 ? 'zi' : 'zile'}
              </p>
              <p className="text-xs text-slate-500 mt-1">{result.fastest.label}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package size={16} className="text-violet-400" />
                <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Economie maximă
                </span>
              </div>
              <p className="text-lg font-bold text-violet-400">{savings.toFixed(2)} RON</p>
              <p className="text-xs text-slate-500 mt-1">față de cea mai scumpă</p>
            </div>
          </div>

          {/* Grafic comparativ */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">
              Comparație vizuală costuri totale
            </h3>
            <ComparisonChart options={result.options} />
          </div>

          {/* Carduri detaliate */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {result.options.map((option, i) => (
              <CostBreakdown key={i} option={option} />
            ))}
          </div>

          {/* Concluzie */}
          <div className="bg-slate-900 border border-violet-500/20 rounded-xl p-5">
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">
              Concluzie
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              Pentru aprovizionarea a{' '}
              <span className="font-bold text-slate-100">{result.quantity} buc</span> din{' '}
              <span className="font-bold text-slate-100">{result.product.name}</span> la{' '}
              <span className="font-bold text-slate-100">{result.to_location.name}</span>,
              varianta optimă ca cost este{' '}
              <span className="font-bold text-violet-400">{result.cheapest.label}</span> cu{' '}
              <span className="font-bold text-violet-400">{result.cheapest.total_cost} RON</span>,
              iar cea mai rapidă este{' '}
              <span className="font-bold text-yellow-400">{result.fastest.label}</span> în{' '}
              <span className="font-bold text-yellow-400">
                {result.fastest.lead_time_days} {result.fastest.lead_time_days === 1 ? 'zi' : 'zile'}
              </span>.
            </p>
          </div>
        </div>
      )}

      {/* Placeholder */}
      {!result && !compareMutation.isPending && (
        <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl py-16 text-center">
          <BarChart className="mx-auto mb-3 text-slate-700" style={{ fontSize: '36px' }} />
          <p className="text-slate-500 text-sm">Selectează un produs și o locație</p>
          <p className="text-slate-600 text-xs mt-1">
            pentru a compara costurile de aprovizionare
          </p>
        </div>
      )}
    </div>
  )
}