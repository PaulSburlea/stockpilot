import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suggestionsApi } from '../services/api'
import {
  Play, CheckCircle, XCircle, AlertTriangle, Package, Warehouse,
  Zap, TrendingDown, X, ArrowRight, MapPin, Clock,
  ChevronDown, ChevronUp, Repeat2, RotateCcw, ShoppingCart,
  BadgeAlert, TrendingUp, Banknote, PackageX, Cpu, SlidersHorizontal,
  CircleDot,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Tipuri și parsare reason
// ─────────────────────────────────────────────────────────────────────────────

type ReasonType =
  | 'deficit'
  | 'stale_redistribution'
  | 'stale_source'
  | 'surplus'
  | 'warehouse'
  | 'supplier'
  | 'no_traction'

interface ParsedReason {
  type: ReasonType
  raw: Record<string, any>
}

function parseReason(reason: string): ParsedReason | null {
  if (!reason) return null
  try {
    const obj = JSON.parse(reason)
    if (obj.type) return { type: obj.type, raw: obj }
  } catch { /* backward compat */ }
  if (reason.includes('[STOC-MORT]'))     return { type: 'stale_redistribution', raw: { legacy: reason } }
  if (reason.includes('[CRITIC]'))        return { type: 'deficit', raw: { urgencyTag: '[CRITIC]', legacy: reason } }
  if (reason.includes('[URGENT]'))        return { type: 'deficit', raw: { urgencyTag: '[URGENT]', legacy: reason } }
  if (reason.includes('[NORMAL]'))        return { type: 'deficit', raw: { urgencyTag: '[NORMAL]', legacy: reason } }
  if (reason.includes('[REDISTRIBUIRE]')) return { type: 'stale_redistribution', raw: { legacy: reason } }
  return { type: 'deficit', raw: { legacy: reason } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Configurații vizuale
// ─────────────────────────────────────────────────────────────────────────────

const typeConfig: Record<ReasonType, {
  label: string
  accentColor: string      // left border accent
  badgeBg: string
  badgeText: string
  icon: React.ReactNode
  dotColor: string         // pentru filter chip
}> = {
  deficit: {
    label: 'Reaprovizionare',
    accentColor: 'border-l-slate-600',
    badgeBg: 'bg-slate-800',
    badgeText: 'text-slate-300',
    icon: <TrendingDown size={11} />,
    dotColor: 'bg-slate-500',
  },
  stale_redistribution: {
    label: 'Redistribuire stoc mort',
    accentColor: 'border-l-amber-500',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    icon: <Repeat2 size={11} />,
    dotColor: 'bg-amber-500',
  },
  stale_source: {
    label: 'Transfer stoc mort',
    accentColor: 'border-l-amber-500',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    icon: <Repeat2 size={11} />,
    dotColor: 'bg-amber-500',
  },
  surplus: {
    label: 'Transfer surplus',
    accentColor: 'border-l-violet-500',
    badgeBg: 'bg-violet-500/10',
    badgeText: 'text-violet-400',
    icon: <RotateCcw size={11} />,
    dotColor: 'bg-violet-500',
  },
  warehouse: {
    label: 'Din depozit',
    accentColor: 'border-l-blue-500',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-400',
    icon: <Warehouse size={11} />,
    dotColor: 'bg-blue-500',
  },
  supplier: {
    label: 'Comandă furnizor',
    accentColor: 'border-l-orange-500',
    badgeBg: 'bg-orange-500/10',
    badgeText: 'text-orange-400',
    icon: <ShoppingCart size={11} />,
    dotColor: 'bg-orange-500',
  },
  no_traction: {
    label: 'Fără tracțiune',
    accentColor: 'border-l-slate-600',
    badgeBg: 'bg-slate-800',
    badgeText: 'text-slate-400',
    icon: <PackageX size={11} />,
    dotColor: 'bg-slate-600',
  },
}

const urgencyConfig: Record<string, {
  label: string
  bg: string
  text: string
  accentColor: string
  dotColor: string
}> = {
  '[CRITIC]': {
    label: 'Critic',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    accentColor: 'border-l-red-500',
    dotColor: 'bg-red-500',
  },
  '[URGENT]': {
    label: 'Urgent',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    accentColor: 'border-l-orange-500',
    dotColor: 'bg-orange-500',
  },
  '[NORMAL]': {
    label: 'Normal',
    bg: 'bg-slate-800',
    text: 'text-slate-400',
    accentColor: 'border-l-slate-600',
    dotColor: 'bg-slate-600',
  },
}

type SuggestionFilter = 'all' | 'critic' | 'urgent' | 'normal' | 'stale' | 'supplier' | 'no_traction'
type SourceFilter     = 'all' | 'warehouse' | 'stand' | 'supplier'

// ─────────────────────────────────────────────────────────────────────────────
// SuggestionCard
// ─────────────────────────────────────────────────────────────────────────────

function SuggestionCard({ s, isPending, onApprove, onReject }: {
  s: any; isPending: boolean; onApprove: () => void; onReject: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const parsed     = parseReason(s.reason)
  const raw        = parsed?.raw ?? {}
  const urgencyTag = raw.urgencyTag as string | undefined
  const urgency    = urgencyTag ? urgencyConfig[urgencyTag] : null
  const typeC      = typeConfig[parsed?.type ?? 'deficit']
  const isStale    = parsed?.type === 'stale_redistribution' || parsed?.type === 'stale_source'
  const isSupplier = parsed?.type === 'supplier'
  const isNoTraction = parsed?.type === 'no_traction'
  const isCritic   = urgencyTag === '[CRITIC]'
  const isUrgent   = urgencyTag === '[URGENT]'

  const accentColor = isCritic
    ? urgencyConfig['[CRITIC]'].accentColor
    : isUrgent
    ? urgencyConfig['[URGENT]'].accentColor
    : typeC.accentColor

  const sourceName = s.from?.name ?? (isSupplier ? 'Furnizor extern' : '—')
  const destName   = s.to?.name ?? '—'
  const destCity   = s.to?.city

  return (
    <div className={`relative bg-slate-900 border border-slate-800 border-l-2 rounded-lg overflow-hidden
      ${accentColor} ${isPending ? 'opacity-40 pointer-events-none' : ''}`}
    >
      <div className="p-4">

        {/* ── Linia 1: Produs + badges + timp ── */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">

            {/* Badge urgență — doar CRITIC / URGENT */}
            {urgency && urgencyTag !== '[NORMAL]' && (
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold
                px-2 py-0.5 rounded uppercase tracking-wide shrink-0
                ${urgency.bg} ${urgency.text}`}
              >
                {isCritic
                  ? <BadgeAlert size={10} />
                  : <AlertTriangle size={10} />
                }
                {urgency.label}
              </span>
            )}

            {/* Badge tip */}
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium
              px-2 py-0.5 rounded shrink-0 ${typeC.badgeBg} ${typeC.badgeText}`}
            >
              {typeC.icon}
              {typeC.label}
            </span>

            {/* Nume produs */}
            <h3 className="text-sm font-semibold text-slate-100 truncate">{s.products?.name}</h3>
            {s.products?.sku && (
              <span className="text-xs text-slate-600 font-mono shrink-0">{s.products.sku}</span>
            )}
          </div>

          {/* Timp rămas / stagnat */}
          <div className="shrink-0 text-right">
            {raw.daysRemaining != null && (
              <span className={`text-xs font-semibold flex items-center gap-1 justify-end
                ${raw.daysRemaining === 0
                  ? 'text-red-400'
                  : raw.daysRemaining < 2
                  ? 'text-red-400'
                  : raw.daysRemaining < 5
                  ? 'text-orange-400'
                  : 'text-slate-500'}`}
              >
                <Clock size={11} />
                {raw.daysRemaining === 0 ? 'Epuizat' : `${raw.daysRemaining} zile`}
              </span>
            )}
            {isStale && raw.staleDays != null && (
              <span className="text-xs font-semibold flex items-center gap-1 justify-end text-amber-500">
                <Clock size={11} />
                {raw.staleDays} zile stagnat
              </span>
            )}
          </div>
        </div>

        {/* ── Linia 2: Ruta ── */}
        <div className="flex items-stretch gap-0 mb-3 rounded-md overflow-hidden border border-slate-800 text-xs">
          {/* Sursă */}
          <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-slate-800/40">
            <div className="shrink-0 text-slate-500">
              {isSupplier || s.from == null
                ? <ShoppingCart size={12} className="text-orange-400/70" />
                : isStale
                ? <Repeat2 size={12} className="text-amber-400/70" />
                : raw.chosenType === 'warehouse' || sourceName.toLowerCase().includes('depozit')
                ? <Warehouse size={12} className="text-blue-400/70" />
                : <MapPin size={12} className="text-violet-400/70" />
              }
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-200 truncate">{sourceName}</p>
              {raw.sourceCity && <p className="text-slate-500 truncate">{raw.sourceCity}</p>}
              {raw.sourceQty != null && (
                <p className="text-slate-500">{raw.sourceQty} buc disponibile</p>
              )}
              {isStale && raw.staleDays != null && (
                <p className="text-amber-500/70">stagnat {raw.staleDays} zile</p>
              )}
            </div>
          </div>

          {/* Săgeată */}
          <div className="flex items-center px-2 bg-slate-800/20 border-x border-slate-800">
            <ArrowRight size={13} className="text-slate-600" />
          </div>

          {/* Destinație */}
          <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-slate-800/40">
            <MapPin size={12} className="shrink-0 text-slate-600" />
            <div className="min-w-0">
              <p className="font-medium text-slate-200 truncate">{destName}</p>
              {destCity && <p className="text-slate-500 truncate">{destCity}</p>}
              {isStale && raw.destVelocity != null && (
                <p className="text-emerald-500/70">{raw.destVelocity.toFixed(2)} buc/zi</p>
              )}
              {isStale && raw.destDaysLeft != null && (
                <p className="text-slate-500">{raw.destDaysLeft} zile stoc</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Linia 3: Context ── */}
        <div className="space-y-1 mb-3">
          {raw.dailySales != null && raw.dailySales > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <TrendingUp size={11} className="shrink-0 text-slate-600" />
              <span>
                <span className="text-slate-300 font-medium">{raw.dailySales.toFixed(2)} buc/zi</span>
                {raw.soldLast30Days > 0 && (
                  <span className="text-slate-600"> · {raw.soldLast30Days} buc în 30 zile</span>
                )}
              </span>
            </div>
          )}

          {raw.currentQty != null && raw.safetyStock != null && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Package size={11} className="shrink-0 text-slate-600" />
              <span>
                Stoc:{' '}
                <span className={`font-medium ${raw.currentQty <= raw.safetyStock ? 'text-red-400' : 'text-slate-300'}`}>
                  {raw.currentQty} buc
                </span>
                <span className="text-slate-600"> / prag siguranță {raw.safetyStock} buc</span>
              </span>
            </div>
          )}

          {raw.savings != null && raw.savings > 0.5 && (
            <div className="flex items-center gap-2 text-xs text-emerald-500">
              <Banknote size={11} className="shrink-0" />
              <span>
                Economie față de depozit:{' '}
                <span className="font-semibold">{raw.savings.toFixed(2)} RON</span>
                {raw.warehouseRefCost != null && (
                  <span className="text-emerald-500/50"> (depozit: {raw.warehouseRefCost.toFixed(2)} RON)</span>
                )}
              </span>
            </div>
          )}

          {raw.transportCostRatio != null && (
            <div className={`flex items-center gap-2 text-xs
              ${raw.transportCostRatio > 20
                ? 'text-amber-500/80'
                : 'text-slate-500'}`}
            >
              <TrendingUp size={11} className="shrink-0 text-slate-600" />
              <span>
                Cost transport:{' '}
                <span className="font-medium">{raw.transportCostRatio}% din valoarea mărfii</span>
                {raw.transportCostRatio > 20 && (
                  <span className="text-amber-500/60"> · cost ridicat</span>
                )}
              </span>
            </div>
          )}

          {isStale && raw.otherCandidates > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CircleDot size={11} className="shrink-0 text-slate-600" />
              <span>Cel mai bun dintre {raw.otherCandidates + 1} standuri candidate</span>
            </div>
          )}

          {isStale && raw.staleThreshold != null && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock size={11} className="shrink-0 text-slate-600" />
              <span>Prag stoc mort configurat: {raw.staleThreshold} zile</span>
            </div>
          )}

          {raw.surplus_days != null && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <RotateCcw size={11} className="shrink-0 text-slate-600" />
              <span>
                Sursa are stoc pentru încă{' '}
                <span className="text-slate-300 font-medium">{raw.surplus_days} zile</span>
              </span>
            </div>
          )}

          {isNoTraction && (
            <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded border mt-1
              ${raw.soldElsewhere
                ? 'bg-blue-500/5 border-blue-500/15 text-blue-300/80'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-500'}`}
            >
              <PackageX size={11} className="shrink-0 mt-0.5" />
              <span>
                {raw.soldElsewhere
                  ? 'Produsul se vinde la alte standuri — poate fi redistribuit din depozit acolo unde există cerere.'
                  : 'Produsul nu a înregistrat vânzări în nicio locație — recomandăm evaluarea catalogului.'}
              </span>
            </div>
          )}

          {raw.capNote && (
            <div className="flex items-center gap-2 text-xs text-amber-500/80">
              <AlertTriangle size={11} className="shrink-0" />
              <span>{raw.capNote}</span>
            </div>
          )}
        </div>

        {/* ── Linia 4: Metrici + Butoane ── */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
          {/* Metrici cantitate / cost */}
          <div className="flex items-center gap-5">
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Cantitate</p>
              <p className="text-sm font-bold text-slate-100">{s.suggested_qty}<span className="text-xs font-normal text-slate-500 ml-1">buc</span></p>
            </div>
            {s.estimated_cost != null && !isSupplier && (
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Cost transport</p>
                <p className="text-sm font-bold text-slate-100">
                  {Number(s.estimated_cost).toFixed(2)}
                  <span className="text-xs font-normal text-slate-500 ml-1">RON</span>
                </p>
              </div>
            )}
            {isSupplier && (
              <div>
                <p className="text-[10px] text-orange-400/60 uppercase tracking-wider mb-0.5">Sursă</p>
                <p className="text-xs font-semibold text-orange-400">Comandă externă</p>
              </div>
            )}
          </div>

          {/* Butoane acțiune */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors"
              title="Detalii raw"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            <button
              onClick={onReject}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
                bg-transparent hover:bg-red-500/8 text-slate-500 hover:text-red-400
                border border-slate-700 hover:border-red-500/20 transition-colors"
            >
              <XCircle size={12} />
              Respinge
            </button>

            <button
              onClick={onApprove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold
                bg-emerald-500/8 hover:bg-emerald-500/20 text-emerald-400
                border border-emerald-500/15 hover:border-emerald-500/30 transition-colors"
            >
              <CheckCircle size={12} />
              Aprobă
            </button>
          </div>
        </div>

        {/* ── Detalii expandate ── */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">
              Payload algoritm
            </p>
            <pre className="text-[11px] text-slate-400 bg-black/30 rounded p-3
              whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-48">
              {JSON.stringify(raw, null, 2)}
            </pre>
            <p className="text-[11px] text-slate-700 mt-2 font-mono">
              #{s.id} · {new Date(s.created_at).toLocaleString('ro-RO')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterChip — buton de filtru cu dot colorat
// ─────────────────────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  dotColor,
  icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  dotColor?: string
  icon?: React.ReactNode
  label: string
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium
        border transition-colors whitespace-nowrap
        ${active
          ? 'bg-slate-100 text-slate-900 border-transparent'
          : 'bg-transparent text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
        }`}
    >
      {dotColor && !active && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      )}
      {icon && active && (
        <span className="shrink-0">{icon}</span>
      )}
      {label}
      {count != null && count > 0 && (
        <span className={`ml-0.5 text-[10px] font-bold ${active ? 'text-slate-600' : 'text-slate-600'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  suffix,
  icon,
  accent,
  onClick,
  active,
}: {
  label: string
  value: number | string
  suffix?: string
  icon: React.ReactNode
  accent?: string
  onClick?: () => void
  active?: boolean
}) {
  const base = 'bg-slate-900 border rounded-lg px-4 py-3 transition-colors'
  const activeClass = active
    ? 'border-slate-400 bg-slate-800'
    : `border-slate-800 ${onClick ? 'hover:border-slate-700 cursor-pointer' : ''}`

  return (
    <div className={`${base} ${activeClass}`} onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">{label}</p>
        <span className={accent ?? 'text-slate-700'}>{icon}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums ${accent ? accent.replace('text-', 'text-') : 'text-slate-100'}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-slate-500 ml-1">{suffix}</span>}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function Suggestions() {
  const queryClient = useQueryClient()
  const [approving, setApproving]                 = useState<Set<number>>(new Set())
  const [typeFilter, setTypeFilter]               = useState<SuggestionFilter>('all')
  const [sourceFilter, setSourceFilter]           = useState<SourceFilter>('all')
  const [destinationFilter, setDestinationFilter] = useState<string>('all')

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: suggestionsApi.getAll,
  })

  const destinations = useMemo(() => {
    const names = new Set<string>()
    suggestions?.forEach(s => { if (s.to?.name) names.add(s.to.name) })
    return Array.from(names).sort()
  }, [suggestions])

  const filtered = useMemo(() => {
    return [...(suggestions ?? [])]
      .filter(s => {
        const parsed       = parseReason(s.reason)
        const urgencyTag   = parsed?.raw?.urgencyTag as string | undefined
        const isStale      = parsed?.type === 'stale_redistribution' || parsed?.type === 'stale_source'
        const isSupplierT  = parsed?.type === 'supplier'
        const isNoTraction = parsed?.type === 'no_traction'

        if (typeFilter === 'critic'      && urgencyTag !== '[CRITIC]') return false
        if (typeFilter === 'urgent'      && urgencyTag !== '[URGENT]') return false
        if (typeFilter === 'normal'      && urgencyTag !== '[NORMAL]') return false
        if (typeFilter === 'stale'       && !isStale) return false
        if (typeFilter === 'supplier'    && !isSupplierT) return false
        if (typeFilter === 'no_traction' && !isNoTraction) return false

        if (sourceFilter === 'warehouse' && !s.from?.name?.toLowerCase().includes('depozit')) return false
        if (sourceFilter === 'stand' && (s.from == null || s.from?.name?.toLowerCase().includes('depozit'))) return false
        if (sourceFilter === 'supplier' && s.from != null) return false

        if (destinationFilter !== 'all' && s.to?.name !== destinationFilter) return false
        return true
      })
      .sort((a, b) => {
        const pa = parseReason(a.reason)?.raw
        const pb = parseReason(b.reason)?.raw
        const order: Record<string, number> = { '[CRITIC]': 0, '[URGENT]': 1, '[NORMAL]': 2 }
        const aO = order[pa?.urgencyTag as string] ?? 3
        const bO = order[pb?.urgencyTag as string] ?? 3
        if (aO !== bO) return aO - bO
        return (pa?.daysRemaining ?? 999) - (pb?.daysRemaining ?? 999)
      })
  }, [suggestions, typeFilter, sourceFilter, destinationFilter])

  const hasActiveFilters = typeFilter !== 'all' || sourceFilter !== 'all' || destinationFilter !== 'all'
  const clearFilters = () => { setTypeFilter('all'); setSourceFilter('all'); setDestinationFilter('all') }

  const runMutation = useMutation({
    mutationFn: suggestionsApi.run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suggestions'] }),
  })
  const handleRun = () => {
    const n = suggestions?.length ?? 0
    if (n > 0) {
      const ok = window.confirm(`Există ${n} sugestii neprocesate.\n\nAlgoritmul va genera sugestii noi doar dacă situația s-a schimbat.\n\nContinui?`)
      if (!ok) return
    }
    runMutation.mutate()
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      suggestionsApi.updateStatus(id, status),
    onMutate: ({ id }) => setApproving(prev => new Set(prev).add(id)),
    onSettled: (_, __, { id }) => {
      setApproving(prev => { const n = new Set(prev); n.delete(id); return n })
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
    },
  })

  // KPI counters
  const criticCount     = suggestions?.filter(s => parseReason(s.reason)?.raw?.urgencyTag === '[CRITIC]').length ?? 0
  const urgentCount     = suggestions?.filter(s => parseReason(s.reason)?.raw?.urgencyTag === '[URGENT]').length ?? 0
  const staleCount      = suggestions?.filter(s => {
    const t = parseReason(s.reason)?.type
    return t === 'stale_redistribution' || t === 'stale_source'
  }).length ?? 0
  const noTractionCount = suggestions?.filter(s => parseReason(s.reason)?.type === 'no_traction').length ?? 0
  const totalCost       = suggestions?.reduce((acc, s) => acc + (s.estimated_cost ?? 0), 0) ?? 0

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">
            {suggestions?.length ?? 0} sugestii în așteptare
          </p>
          {(criticCount > 0 || urgentCount > 0) && (
            <p className="text-xs text-slate-600 mt-0.5">
              {criticCount > 0 && <span className="text-red-400">{criticCount} critice</span>}
              {criticCount > 0 && urgentCount > 0 && <span className="mx-1.5">·</span>}
              {urgentCount > 0 && <span className="text-orange-400">{urgentCount} urgente</span>}
            </p>
          )}
        </div>
        <button
          onClick={handleRun}
          disabled={runMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-white
            disabled:opacity-40 text-slate-900 text-sm font-semibold rounded-lg
            transition-colors"
        >
          <Cpu size={14} className={runMutation.isPending ? 'animate-pulse' : ''} />
          {runMutation.isPending ? 'Se analizează...' : 'Rulează algoritmul'}
        </button>
      </div>

      {/* ── Feedback ── */}
      {runMutation.isSuccess && (
        <div className="flex items-center gap-3 bg-emerald-500/8 border border-emerald-500/15
          rounded-lg px-4 py-3 text-xs text-emerald-400 font-medium">
          <CheckCircle size={14} className="shrink-0" />
          {runMutation.data.generated === 0
            ? 'Nicio schimbare față de ultima analiză.'
            : `${runMutation.data.generated} sugestii noi generate.`}
        </div>
      )}
      {runMutation.isError && (
        <div className="flex items-center gap-3 bg-red-500/8 border border-red-500/15
          rounded-lg px-4 py-3 text-xs text-red-400 font-medium">
          <XCircle size={14} className="shrink-0" />
          Eroare la rularea algoritmului. Încearcă din nou.
        </div>
      )}

      {/* ── KPI bar ── */}
      {(suggestions?.length ?? 0) > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <KpiCard
            label="Total"
            value={suggestions?.length ?? 0}
            icon={<Cpu size={13} />}
          />
          <KpiCard
            label="Critice"
            value={criticCount}
            icon={<BadgeAlert size={13} />}
            accent={criticCount > 0 ? 'text-red-400' : undefined}
            onClick={() => setTypeFilter(typeFilter === 'critic' ? 'all' : 'critic')}
            active={typeFilter === 'critic'}
          />
          <KpiCard
            label="Urgente"
            value={urgentCount}
            icon={<Zap size={13} />}
            accent={urgentCount > 0 ? 'text-orange-400' : undefined}
            onClick={() => setTypeFilter(typeFilter === 'urgent' ? 'all' : 'urgent')}
            active={typeFilter === 'urgent'}
          />
          <KpiCard
            label="Stoc mort"
            value={staleCount}
            icon={<Repeat2 size={13} />}
            accent={staleCount > 0 ? 'text-amber-400' : undefined}
            onClick={() => setTypeFilter(typeFilter === 'stale' ? 'all' : 'stale')}
            active={typeFilter === 'stale'}
          />
          <KpiCard
            label="Fără tracțiune"
            value={noTractionCount}
            icon={<PackageX size={13} />}
            onClick={() => setTypeFilter(typeFilter === 'no_traction' ? 'all' : 'no_traction')}
            active={typeFilter === 'no_traction'}
          />
          <KpiCard
            label="Cost estimat"
            value={totalCost.toFixed(0)}
            suffix="RON"
            icon={<Banknote size={13} />}
          />
        </div>
      )}

      {/* ── Filtre ── */}
      {(suggestions?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2">

          {/* Label */}
          <span className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium uppercase tracking-wider mr-1">
            <SlidersHorizontal size={11} />
            Filtre
          </span>

          {/* Tip / urgență */}
          <div className="flex flex-wrap gap-1">
            <FilterChip
              active={typeFilter === 'all'}
              onClick={() => setTypeFilter('all')}
              label="Toate"
            />
            <FilterChip
              active={typeFilter === 'critic'}
              onClick={() => setTypeFilter(typeFilter === 'critic' ? 'all' : 'critic')}
              dotColor="bg-red-500"
              icon={<BadgeAlert size={10} />}
              label="Critice"
              count={criticCount}
            />
            <FilterChip
              active={typeFilter === 'urgent'}
              onClick={() => setTypeFilter(typeFilter === 'urgent' ? 'all' : 'urgent')}
              dotColor="bg-orange-500"
              icon={<AlertTriangle size={10} />}
              label="Urgente"
              count={urgentCount}
            />
            <FilterChip
              active={typeFilter === 'normal'}
              onClick={() => setTypeFilter(typeFilter === 'normal' ? 'all' : 'normal')}
              dotColor="bg-slate-600"
              icon={<TrendingDown size={10} />}
              label="Normale"
            />
            <FilterChip
              active={typeFilter === 'stale'}
              onClick={() => setTypeFilter(typeFilter === 'stale' ? 'all' : 'stale')}
              dotColor="bg-amber-500"
              icon={<Repeat2 size={10} />}
              label="Stoc mort"
              count={staleCount}
            />
            <FilterChip
              active={typeFilter === 'supplier'}
              onClick={() => setTypeFilter(typeFilter === 'supplier' ? 'all' : 'supplier')}
              dotColor="bg-orange-500"
              icon={<ShoppingCart size={10} />}
              label="Furnizor"
            />
            <FilterChip
              active={typeFilter === 'no_traction'}
              onClick={() => setTypeFilter(typeFilter === 'no_traction' ? 'all' : 'no_traction')}
              dotColor="bg-slate-600"
              icon={<PackageX size={10} />}
              label="Fără tracțiune"
              count={noTractionCount}
            />
          </div>

          {/* Separator vizual */}
          <span className="w-px h-4 bg-slate-800" />

          {/* Sursă */}
          <div className="flex flex-wrap gap-1">
            <FilterChip
              active={sourceFilter === 'all'}
              onClick={() => setSourceFilter('all')}
              label="Orice sursă"
            />
            <FilterChip
              active={sourceFilter === 'warehouse'}
              onClick={() => setSourceFilter(sourceFilter === 'warehouse' ? 'all' : 'warehouse')}
              dotColor="bg-blue-500"
              icon={<Warehouse size={10} />}
              label="Depozit"
            />
            <FilterChip
              active={sourceFilter === 'stand'}
              onClick={() => setSourceFilter(sourceFilter === 'stand' ? 'all' : 'stand')}
              dotColor="bg-violet-500"
              icon={<MapPin size={10} />}
              label="Stand"
            />
            <FilterChip
              active={sourceFilter === 'supplier'}
              onClick={() => setSourceFilter(sourceFilter === 'supplier' ? 'all' : 'supplier')}
              dotColor="bg-orange-500"
              icon={<ShoppingCart size={10} />}
              label="Extern"
            />
          </div>

          {/* Destinație */}
          {destinations.length > 1 && (
            <>
              <span className="w-px h-4 bg-slate-800" />
              <select
                value={destinationFilter}
                onChange={e => setDestinationFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-transparent border border-slate-800
                  rounded text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-600
                  cursor-pointer hover:border-slate-700 transition-colors"
              >
                <option value="all">Orice destinație</option>
                {destinations.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </>
          )}

          {/* Reset + count */}
          {hasActiveFilters && (
            <>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400
                  px-2 py-1.5 rounded hover:bg-slate-800 transition-colors"
              >
                <X size={11} />
                Resetează
              </button>
              <span className="text-xs text-slate-700 tabular-nums">
                {filtered.length} / {suggestions?.length}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Lista ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-900 border border-slate-800 border-l-2 border-l-slate-700
              rounded-lg p-4 animate-pulse">
              <div className="flex gap-2 mb-3">
                <div className="h-5 bg-slate-800 rounded w-16" />
                <div className="h-5 bg-slate-800 rounded w-24" />
                <div className="h-5 bg-slate-800 rounded w-1/3" />
              </div>
              <div className="h-14 bg-slate-800/50 rounded mb-3" />
              <div className="space-y-1.5 mb-3">
                <div className="h-3 bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-800">
                <div className="flex gap-4">
                  <div className="h-8 bg-slate-800 rounded w-16" />
                  <div className="h-8 bg-slate-800 rounded w-20" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 bg-slate-800 rounded w-20" />
                  <div className="h-8 bg-slate-800 rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Cpu size={18} className="text-slate-600" />
          </div>
          {hasActiveFilters ? (
            <>
              <p className="text-slate-500 text-sm">Nicio sugestie pentru filtrele active</p>
              <button
                onClick={clearFilters}
                className="mt-3 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
              >
                Resetează filtrele
              </button>
            </>
          ) : (
            <>
              <p className="text-slate-400 text-sm font-semibold mb-1">Nu există sugestii în așteptare</p>
              <p className="text-slate-600 text-xs mb-5">Rulează algoritmul pentru a genera recomandări</p>
              <button
                onClick={handleRun}
                disabled={runMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-white
                  text-slate-900 text-sm font-semibold rounded-lg transition-colors"
              >
                <Play size={13} />
                Rulează acum
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {filtered.map(s => (
              <SuggestionCard
                key={s.id}
                s={s}
                isPending={approving.has(s.id)}
                onApprove={() => updateMutation.mutate({ id: s.id, status: 'approved' })}
                onReject={() => updateMutation.mutate({ id: s.id, status: 'rejected' })}
              />
            ))}
          </div>

          {/* Aprobă toate — doar dacă nu există critice/urgente */}
          {!hasActiveFilters && criticCount === 0 && urgentCount === 0 && (suggestions?.length ?? 0) >= 3 && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => {
                  const ok = window.confirm(`Aprobi toate cele ${suggestions?.length} sugestii?`)
                  if (!ok) return
                  suggestions?.forEach(s => updateMutation.mutate({ id: s.id, status: 'approved' }))
                }}
                className="text-xs text-slate-600 hover:text-slate-300 transition-colors
                  underline underline-offset-2"
              >
                Aprobă toate ({suggestions?.length})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}