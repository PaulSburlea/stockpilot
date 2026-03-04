import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { forecastApi, locationsApi } from '../services/api'
import type { ForecastItem } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend
} from 'recharts'
import {
  TrendingDown, AlertTriangle, CheckCircle,
  Clock, Filter
} from 'lucide-react'

const riskConfig = {
  critical: { label: 'Critic',    color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',    dot: 'bg-red-500' },
  warning:  { label: 'Atenție',   color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-500' },
  normal:   { label: 'Normal',    color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',  dot: 'bg-blue-500' },
  safe:     { label: 'Sigur',     color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500' },
}

// Tooltip custom pentru grafic
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-slate-100 font-bold">{p.value} buc</span>
        </div>
      ))}
    </div>
  )
}

// Card sumar pentru un produs
function ForecastCard({
  item,
  isSelected,
  onClick,
}: {
  item: ForecastItem
  isSelected: boolean
  onClick: () => void
}) {
  const risk = riskConfig[item.risk_level]

  return (
    <div
      onClick={onClick}
      className={`border rounded-xl p-4 cursor-pointer transition-all
        ${isSelected
          ? 'border-violet-500 bg-violet-500/5'
          : `${risk.bg} hover:border-opacity-60`
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{item.product_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{item.location_city}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${risk.bg} ${risk.color} shrink-0`}>
          {risk.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-base font-bold text-slate-100">{item.current_stock}</p>
          <p className="text-xs text-slate-600">acum</p>
        </div>
        <div>
          <p className={`text-base font-bold ${item.forecast_30 <= item.safety_stock ? 'text-red-400' : 'text-slate-100'}`}>
            {item.forecast_30}
          </p>
          <p className="text-xs text-slate-600">30 zile</p>
        </div>
        <div>
          <p className={`text-base font-bold ${item.forecast_60 <= item.safety_stock ? 'text-red-400' : 'text-slate-100'}`}>
            {item.forecast_60}
          </p>
          <p className="text-xs text-slate-600">60 zile</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs">
        <Clock size={11} className={risk.color} />
        <span className={risk.color}>
          {item.days_until_stockout > 90
            ? 'Stoc suficient pentru 90+ zile'
            : `Epuizare în ~${item.days_until_stockout} zile (${item.stockout_date})`
          }
        </span>
      </div>
    </div>
  )
}

// Graficul principal de proiecție
function ProjectionChart({ item }: { item: ForecastItem }) {
  // Afișăm doar din 5 în 5 zile ca să nu fie prea dens
  const data = item.projection.filter(p => p.day % 5 === 0)

  const stockoutDay = item.days_until_stockout <= 90 ? item.days_until_stockout : null

  return (
    <div className="space-y-4">
      {/* Header grafic */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{item.product_name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{item.location_name} — {item.location_city}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Rată vânzare</p>
          <p className="text-sm font-bold text-violet-400">{item.daily_rate} buc/zi</p>
        </div>
      </div>

      {/* Grafic proiecție */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#475569', fontSize: 11 }}
            tickFormatter={v => {
              const d = new Date(v)
              return `${d.getDate()}/${d.getMonth() + 1}`
            }}
          />
          <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>
            )}
          />

          {/* Linia stoc proiectat */}
          <Line
            type="monotone"
            dataKey="projected_stock"
            name="Stoc proiectat"
            stroke="#7c3aed"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#7c3aed' }}
          />

          {/* Linia safety stock */}
          <Line
            type="monotone"
            dataKey="safety_stock"
            name="Stoc minim"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
          />

          {/* Linie verticală la ziua epuizării */}
          {stockoutDay && (
            <ReferenceLine
              x={item.projection[Math.min(stockoutDay, 90)]?.date}
              stroke="#f97316"
              strokeDasharray="4 2"
              label={{
                value: 'Epuizare',
                position: 'top',
                fill: '#f97316',
                fontSize: 11,
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Tabel forecast pe milestone-uri */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Acum', value: item.current_stock, days: 0 },
          { label: '30 zile', value: item.forecast_30, days: 30 },
          { label: '60 zile', value: item.forecast_60, days: 60 },
          { label: '90 zile', value: item.forecast_90, days: 90 },
        ].map(({ label, value, days }) => {
          const isCritical = value <= item.safety_stock
          const isGone = value === 0
          return (
            <div
              key={days}
              className={`rounded-xl p-3 text-center border
                ${isGone     ? 'bg-red-500/10 border-red-500/20' :
                  isCritical ? 'bg-orange-500/10 border-orange-500/20' :
                               'bg-slate-800 border-slate-700'
                }`}
            >
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-lg font-bold
                ${isGone ? 'text-red-400' : isCritical ? 'text-orange-400' : 'text-slate-100'}`}
              >
                {value}
              </p>
              <p className="text-xs text-slate-600">buc</p>
              {isCritical && !isGone && (
                <p className="text-xs text-orange-500 mt-1">sub minim</p>
              )}
              {isGone && (
                <p className="text-xs text-red-500 mt-1">epuizat</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Detalii rată vânzare */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
          Detalii calcul rată vânzare
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Medie 30 zile', value: item.avg_daily_30 },
            { label: 'Medie 60 zile', value: item.avg_daily_60 },
            { label: 'Medie 90 zile', value: item.avg_daily_90 },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-sm font-bold text-violet-400">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-3 text-center">
          Rată finală: medie ponderată (50% × 30z + 30% × 60z + 20% × 90z) = {item.daily_rate} buc/zi
        </p>
      </div>
    </div>
  )
}

export default function Forecasting() {
  const { user } = useAuth()
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    user?.role === 'stand_manager' ? String(user.location_id) : ''
  )
  const [riskFilter, setRiskFilter] = useState<string>('')
  const [selectedItem, setSelectedItem] = useState<ForecastItem | null>(null)

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
  })

  const { data: forecasts, isLoading } = useQuery({
    queryKey: ['forecast', selectedLocationId],
    queryFn: () => forecastApi.get(
      selectedLocationId ? { location_id: Number(selectedLocationId) } : undefined
    ),
  })

  const stands = locations?.filter(l => l.type === 'stand') ?? []

  const filtered = forecasts?.filter(f =>
    !riskFilter || f.risk_level === riskFilter
  ) ?? []

  const summary = {
    critical: forecasts?.filter(f => f.risk_level === 'critical').length ?? 0,
    warning:  forecasts?.filter(f => f.risk_level === 'warning').length ?? 0,
    normal:   forecasts?.filter(f => f.risk_level === 'normal').length ?? 0,
    safe:     forecasts?.filter(f => f.risk_level === 'safe').length ?? 0,
  }

  return (
    <div className="space-y-5">
      {/* Filtre */}
      <div className="flex flex-col sm:flex-row gap-3">
        {user?.role !== 'stand_manager' && (
          <select
            value={selectedLocationId}
            onChange={e => { setSelectedLocationId(e.target.value); setSelectedItem(null) }}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Toate locațiile</option>
            {stands.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name} — {loc.city}</option>
            ))}
          </select>
        )}

        {/* Filtre risc */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: '',         label: 'Toate',   count: forecasts?.length ?? 0 },
            { value: 'critical', label: 'Critic',  count: summary.critical },
            { value: 'warning',  label: 'Atenție', count: summary.warning },
            { value: 'normal',   label: 'Normal',  count: summary.normal },
            { value: 'safe',     label: 'Sigur',   count: summary.safe },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setRiskFilter(opt.value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5
                ${riskFilter === opt.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
            >
              {opt.label}
              {opt.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs
                  ${riskFilter === opt.value ? 'bg-violet-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  {opt.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Se calculează forecast-ul...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Lista carduri — coloana stângă */}
          <div className="xl:col-span-1 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-sm">
                Nu există date pentru filtrele selectate
              </div>
            ) : filtered.map((item, i) => (
              <ForecastCard
                key={`${item.location_id}-${item.product_id}`}
                item={item}
                isSelected={
                  selectedItem?.location_id === item.location_id &&
                  selectedItem?.product_id === item.product_id
                }
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>

          {/* Grafic detaliu — coloana dreaptă */}
          <div className="xl:col-span-2">
            {selectedItem ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sticky top-0">
                <ProjectionChart item={selectedItem} />
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center h-64">
                <TrendingDown size={32} className="text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">Selectează un produs din listă</p>
                <p className="text-slate-600 text-xs mt-1">
                  pentru a vedea proiecția detaliată a stocului
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}