import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { suggestionsApi, locationsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  CheckCircle, XCircle, History, ArrowRight, Package,
  BadgeAlert, AlertTriangle, Repeat2, ShoppingCart,
  TrendingDown, Warehouse, MapPin, PackageX,
  SlidersHorizontal, X,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Parsare reason — identică cu Suggestions.tsx
// ─────────────────────────────────────────────────────────────────────────────

type ReasonType =
  | 'deficit' | 'stale_redistribution' | 'stale_source'
  | 'surplus' | 'warehouse' | 'supplier' | 'no_traction'

function parseReason(reason: string): { type: ReasonType; raw: Record<string, any> } | null {
  if (!reason) return null
  try {
    const obj = JSON.parse(reason)
    if (obj.type) return { type: obj.type, raw: obj }
  } catch { /* legacy */ }
  if (reason.includes('[CRITIC]'))  return { type: 'deficit', raw: { urgencyTag: '[CRITIC]', legacy: reason } }
  if (reason.includes('[URGENT]'))  return { type: 'deficit', raw: { urgencyTag: '[URGENT]', legacy: reason } }
  if (reason.includes('[NORMAL]'))  return { type: 'deficit', raw: { urgencyTag: '[NORMAL]', legacy: reason } }
  if (reason.includes('[STOC-MORT]') || reason.includes('[REDISTRIBUIRE]'))
    return { type: 'stale_redistribution', raw: { legacy: reason } }
  return { type: 'deficit', raw: { legacy: reason } }
}

const typeConfig: Record<ReasonType, { label: string; icon: React.ReactNode; dotColor: string }> = {
  deficit:             { label: 'Reaprovizionare',        icon: <TrendingDown size={11} />,   dotColor: 'bg-slate-500' },
  stale_redistribution:{ label: 'Redistribuire stoc mort', icon: <Repeat2 size={11} />,        dotColor: 'bg-amber-500' },
  stale_source:        { label: 'Transfer stoc mort',      icon: <Repeat2 size={11} />,        dotColor: 'bg-amber-500' },
  surplus:             { label: 'Transfer surplus',         icon: <ArrowRight size={11} />,     dotColor: 'bg-violet-500' },
  warehouse:           { label: 'Din depozit',              icon: <Warehouse size={11} />,      dotColor: 'bg-blue-500' },
  supplier:            { label: 'Comandă furnizor',         icon: <ShoppingCart size={11} />,   dotColor: 'bg-orange-500' },
  no_traction:         { label: 'Fără tracțiune',           icon: <PackageX size={11} />,       dotColor: 'bg-slate-600' },
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI row
// ─────────────────────────────────────────────────────────────────────────────

function HistoryStats({ suggestions }: { suggestions: any[] }) {
  const approved     = suggestions.filter(s => s.status === 'approved')
  const approvalRate = suggestions.length > 0
    ? Math.round((approved.length / suggestions.length) * 100)
    : 0
  const totalQty  = approved.reduce((s, i) => s + (i.suggested_qty ?? 0), 0)
  const totalCost = approved.reduce((s, i) => s + (i.estimated_cost ?? 0), 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[
        {
          label: 'Total decizii',
          value: suggestions.length,
          suffix: undefined,
          color: 'text-slate-100',
        },
        {
          label: 'Rată aprobare',
          value: `${approvalRate}%`,
          suffix: undefined,
          color: approvalRate >= 70 ? 'text-emerald-400' : approvalRate >= 40 ? 'text-orange-400' : 'text-red-400',
        },
        {
          label: 'Unități aprobate',
          value: totalQty.toLocaleString(),
          suffix: 'buc',
          color: 'text-slate-100',
        },
        {
          label: 'Cost total aprobat',
          value: totalCost.toFixed(0),
          suffix: 'RON',
          color: 'text-slate-100',
        },
      ].map(card => (
        <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">{card.label}</p>
          <p className={`text-xl font-bold tabular-nums ${card.color}`}>
            {card.value}
            {card.suffix && <span className="text-sm font-normal text-slate-500 ml-1">{card.suffix}</span>}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// History card
// ─────────────────────────────────────────────────────────────────────────────

function HistoryCard({ s }: { s: any }) {
  const approved   = s.status === 'approved'
  const parsed     = parseReason(s.reason)
  const raw        = parsed?.raw ?? {}
  const urgencyTag = raw.urgencyTag as string | undefined
  const typeC      = typeConfig[parsed?.type ?? 'deficit']

  const isCritic = urgencyTag === '[CRITIC]'
  const isUrgent = urgencyTag === '[URGENT]'

  const accentColor = approved
    ? isCritic ? 'border-l-red-500' : isUrgent ? 'border-l-orange-500' : 'border-l-emerald-600'
    : 'border-l-slate-700'

  const sourceName = s.from?.name ?? 'Furnizor extern'

  return (
    <div className={`bg-slate-900 border border-slate-800 border-l-2 ${accentColor} rounded-lg p-4`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">

        {/* Stânga */}
        <div className="space-y-2 flex-1 min-w-0">

          {/* Badge-uri */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Status */}
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold
              px-2 py-0.5 rounded uppercase tracking-wide
              ${approved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}
            >
              {approved ? <CheckCircle size={10} /> : <XCircle size={10} />}
              {approved ? 'Aprobat' : 'Respins'}
            </span>

            {/* Urgență */}
            {(isCritic || isUrgent) && (
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold
                px-2 py-0.5 rounded uppercase tracking-wide
                ${isCritic ? 'bg-red-500/10 text-red-400' : 'bg-orange-500/10 text-orange-400'}`}
              >
                {isCritic ? <BadgeAlert size={10} /> : <AlertTriangle size={10} />}
                {isCritic ? 'Critic' : 'Urgent'}
              </span>
            )}

            {/* Tip */}
            {parsed?.type && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className={`w-1.5 h-1.5 rounded-full ${typeC.dotColor}`} />
                {typeC.label}
              </span>
            )}

            <span className="text-[11px] text-slate-700 font-mono">#{s.id}</span>
          </div>

          {/* Produs */}
          <div className="flex items-center gap-2">
            <Package size={13} className="text-slate-600 shrink-0" />
            <span className="text-sm font-semibold text-slate-100">{s.products?.name}</span>
            {s.products?.sku && (
              <span className="text-xs text-slate-600 font-mono">{s.products.sku}</span>
            )}
          </div>

          {/* Rută */}
          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-300">
              {s.from == null
                ? <ShoppingCart size={11} className="text-orange-400/70" />
                : sourceName.toLowerCase().includes('depozit')
                ? <Warehouse size={11} className="text-blue-400/70" />
                : <MapPin size={11} className="text-violet-400/70" />
              }
              <span>{s.from?.city ?? 'Furnizor'}</span>
            </div>
            <ArrowRight size={11} className="text-slate-700 shrink-0" />
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-300">
              <MapPin size={11} className="text-slate-500" />
              <span>{s.to?.city ?? '—'}</span>
            </div>
          </div>

          {/* Context extras din reason */}
          {raw.daysRemaining != null && (
            <p className="text-xs text-slate-600">
              La momentul deciziei: {raw.daysRemaining === 0 ? 'stoc epuizat' : `${raw.daysRemaining} zile stoc rămase`}
              {raw.dailySales > 0 && ` · ${raw.dailySales.toFixed(2)} buc/zi`}
            </p>
          )}
          {(parsed?.type === 'stale_redistribution' || parsed?.type === 'stale_source') && raw.staleDays != null && (
            <p className="text-xs text-slate-600">
              Stoc stagnat {raw.staleDays} zile la momentul deciziei
            </p>
          )}
          {raw.legacy && (
            <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
              {raw.legacy.replace('[URGENT] ', '').replace('[NORMAL] ', '').replace('[CRITIC] ', '')}
            </p>
          )}
        </div>

        {/* Dreapta — cifre + data */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-1">Cantitate</p>
            <p className="text-lg font-bold text-slate-100 tabular-nums">
              {s.suggested_qty}
              <span className="text-xs font-normal text-slate-500 ml-1">buc</span>
            </p>
            {s.estimated_cost != null && (
              <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                {s.estimated_cost.toFixed(2)} RON transport
              </p>
            )}
          </div>

          {s.updated_at && (
            <div className="text-right">
              <p className="text-[11px] text-slate-600 font-mono">
                {new Date(s.updated_at).toLocaleDateString('ro-RO', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </p>
              <p className="text-[11px] text-slate-700 font-mono">
                {new Date(s.updated_at).toLocaleTimeString('ro-RO', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function SuggestionsHistory() {
  const { user } = useAuth()
  const [filterStatus, setFilterStatus]     = useState<'approved' | 'rejected' | ''>('')
  const [filterLocation, setFilterLocation] = useState(
    user?.role === 'stand_manager' ? String(user.location_id) : ''
  )

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
  })

  const { data: history, isLoading } = useQuery({
    queryKey: ['suggestions', 'history', filterStatus, filterLocation],
    queryFn: () => suggestionsApi.getHistory({
      status:      filterStatus   || undefined,
      location_id: filterLocation ? Number(filterLocation) : undefined,
    }),
  })

  const stands      = locations?.filter(l => l.type === 'stand') ?? []
  const suggestions = history ?? []

  const approvedCount = suggestions.filter(s => s.status === 'approved').length
  const rejectedCount = suggestions.filter(s => s.status === 'rejected').length
  const hasFilters    = filterStatus !== '' || filterLocation !== ''

  const clearFilters = () => {
    setFilterStatus('')
    setFilterLocation(user?.role === 'stand_manager' ? String(user.location_id) : '')
  }

  return (
    <div className="space-y-5">

      {/* ── Filtre ── */}
      <div className="flex flex-wrap items-center gap-2">

        <span className="flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold uppercase tracking-wider mr-1">
          <SlidersHorizontal size={11} />
          Filtre
        </span>

        {/* Status */}
        <div className="flex gap-1">
          {([
            { value: '',         label: 'Toate',    count: suggestions.length },
            { value: 'approved', label: 'Aprobate', count: approvedCount },
            { value: 'rejected', label: 'Respinse', count: rejectedCount },
          ] as { value: typeof filterStatus; label: string; count: number }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium
                border transition-colors
                ${filterStatus === opt.value
                  ? 'bg-slate-100 text-slate-900 border-transparent'
                  : 'bg-transparent text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
            >
              {opt.value === 'approved' && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${filterStatus === 'approved' ? 'hidden' : 'bg-emerald-500'}`} />
              )}
              {opt.value === 'rejected' && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${filterStatus === 'rejected' ? 'hidden' : 'bg-slate-600'}`} />
              )}
              {opt.label}
              {opt.count > 0 && (
                <span className="text-[10px] font-bold text-slate-600">{opt.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Locație — doar admin / warehouse */}
        {user?.role !== 'stand_manager' && stands.length > 0 && (
          <>
            <span className="w-px h-4 bg-slate-800" />
            <select
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-transparent border border-slate-800 rounded
                text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-600
                cursor-pointer hover:border-slate-700 transition-colors"
            >
              <option value="">Toate locațiile</option>
              {stands.map(l => (
                <option key={l.id} value={l.id}>{l.name} — {l.city}</option>
              ))}
            </select>
          </>
        )}

        {/* Reset */}
        {hasFilters && filterStatus !== '' && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400
              px-2 py-1.5 rounded hover:bg-slate-800 transition-colors"
          >
            <X size={11} />
            Resetează
          </button>
        )}
      </div>

      {/* ── KPI ── */}
      {suggestions.length > 0 && <HistoryStats suggestions={suggestions} />}

      {/* ── Lista ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-900 border border-slate-800 border-l-2 border-l-slate-700
              rounded-lg p-4 animate-pulse">
              <div className="flex justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex gap-2">
                    <div className="h-5 bg-slate-800 rounded w-16" />
                    <div className="h-5 bg-slate-800 rounded w-20" />
                  </div>
                  <div className="h-4 bg-slate-800 rounded w-40" />
                  <div className="h-4 bg-slate-800 rounded w-32" />
                </div>
                <div className="space-y-2 items-end flex flex-col">
                  <div className="h-6 bg-slate-800 rounded w-16" />
                  <div className="h-3 bg-slate-800 rounded w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <History size={18} className="text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm font-semibold mb-1">Nicio înregistrare în istoric</p>
          <p className="text-slate-600 text-xs">Aprobă sau respinge sugestii din pagina Sugestii</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {suggestions.map(s => (
              <HistoryCard key={s.id} s={s} />
            ))}
          </div>
          <p className="text-center text-xs text-slate-700 font-mono py-2">
            {suggestions.length} înregistrări
          </p>
        </>
      )}
    </div>
  )
}