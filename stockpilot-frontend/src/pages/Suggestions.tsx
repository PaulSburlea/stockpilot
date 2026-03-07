import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suggestionsApi } from '../services/api'
import {
  Lightbulb, Play, CheckCircle, XCircle,
  AlertTriangle, Package, Warehouse,
  Zap, TrendingDown, Filter, X,
  ArrowRight, MapPin, Clock,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const isUrgent = (reason: string) => reason?.includes('[URGENT]')

const extractDaysRemaining = (reason: string): number | null => {
  const match = reason?.match(/în ~(\d+) zile/)
  return match ? Number(match[1]) : null
}

const getSourceType = (
  from?: { name: string } | null
): 'warehouse' | 'stand' | 'supplier' => {
  if (!from) return 'supplier'
  const n = from.name.toLowerCase()
  if (n.includes('depozit') || n.includes('warehouse') || n.includes('central'))
    return 'warehouse'
  return 'stand'
}

// Extrage un mesaj scurt și uman din reason-ul generat de algoritm
const parseReason = (reason: string) => {
  const days    = extractDaysRemaining(reason)
  const urgent  = isUrgent(reason)

  // Încearcă să extragă stocul disponibil la sursă
  const stockMatch = reason.match(/(\d+) buc disponibile/)
  const stockAtSource = stockMatch ? Number(stockMatch[1]) : null

  if (urgent || (days !== null && days < 2)) {
    return { short: 'Stoc pe cale să se epuizeze', stockAtSource }
  }
  if (days !== null && days < 7) {
    return { short: `Stoc insuficient — se epuizează în ${days} zile`, stockAtSource }
  }
  if (days !== null) {
    return { short: `Reaprovizionare recomandată — ${days} zile stoc rămase`, stockAtSource }
  }
  return { short: 'Reaprovizionare recomandată', stockAtSource }
}

type PriorityFilter = 'all' | 'urgent' | 'normal'
type SourceFilter   = 'all' | 'warehouse' | 'stand' | 'supplier'

// ─────────────────────────────────────────────────────────────────────────────
// SuggestionCard
// ─────────────────────────────────────────────────────────────────────────────

function SuggestionCard({
  s,
  isPending,
  onApprove,
  onReject,
}: {
  s: any
  isPending: boolean
  onApprove: () => void
  onReject:  () => void
}) {
  const urgent     = isUrgent(s.reason)
  const days       = extractDaysRemaining(s.reason)
  const sourceType = getSourceType(s.from)
  const { short, stockAtSource } = parseReason(s.reason)

  const daysColor =
    days === null      ? 'text-slate-500' :
    days < 2           ? 'text-red-400' :
    days < 7           ? 'text-orange-400' :
                         'text-slate-400'

  const sourceIcon =
    sourceType === 'warehouse' ? <Warehouse size={13} className="shrink-0 text-blue-400" /> :
    sourceType === 'stand'     ? <MapPin    size={13} className="shrink-0 text-violet-400" /> :
                                 <Package   size={13} className="shrink-0 text-amber-400" />

  const sourceName = s.from?.name ?? 'Furnizor extern'
  const destName   = s.to?.name   ?? '—'
  const destCity   = s.to?.city

  return (
    <div className={`bg-slate-900 border rounded-xl overflow-hidden transition-all
      ${urgent ? 'border-red-500/25' : 'border-slate-800'}
      ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Bara colorată sus pentru urgente */}
      {urgent && (
        <div className="h-0.5 bg-linear-to-r from-red-500 to-orange-500" />
      )}

      <div className="p-5">
        {/* ── Rând 1: Produs + badge urgent + zile ── */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {urgent && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 shrink-0">
                <AlertTriangle size={10} /> URGENT
              </span>
            )}
            <h3 className="font-semibold text-slate-100 text-sm truncate">
              {s.products?.name}
            </h3>
            {s.products?.sku && (
              <span className="text-xs text-slate-600 shrink-0">{s.products.sku}</span>
            )}
          </div>

          {days !== null && (
            <span className={`text-xs font-semibold shrink-0 flex items-center gap-1 ${daysColor}`}>
              <Clock size={11} />
              {days === 0 ? 'Epuizat' : `${days}z rămase`}
            </span>
          )}
        </div>

        {/* ── Rând 2: Ruta — DE LA → CĂTRE ── */}
        <div className="flex items-center gap-2 mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-800">
          {/* Sursă */}
          <div className="flex items-center gap-1.5 min-w-0">
            {sourceIcon}
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{sourceName}</p>
              {stockAtSource !== null && (
                <p className="text-[11px] text-slate-500">{stockAtSource} buc disponibile</p>
              )}
            </div>
          </div>

          <ArrowRight size={14} className="shrink-0 text-slate-600" />

          {/* Destinație */}
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin size={13} className="shrink-0 text-slate-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{destName}</p>
              {destCity && (
                <p className="text-[11px] text-slate-500">{destCity}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Rând 3: Motivul scurt ── */}
        <p className="text-xs text-slate-400 mb-4">
          {short}
        </p>

        {/* ── Rând 4: Metrici + Butoane ── */}
        <div className="flex items-center justify-between gap-3">
          {/* Metrici */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[11px] text-slate-500 mb-0.5">Cantitate</p>
              <p className="text-sm font-bold text-slate-100">{s.suggested_qty} buc</p>
            </div>
            {s.estimated_cost != null && (
              <div>
                <p className="text-[11px] text-slate-500 mb-0.5">Cost transport</p>
                <p className="text-sm font-bold text-slate-100">
                  {Number(s.estimated_cost).toFixed(2)}
                  <span className="text-xs font-normal text-slate-500 ml-1">RON</span>
                </p>
              </div>
            )}
          </div>

          {/* Butoane */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onReject}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/20 transition-colors"
            >
              <XCircle size={13} /> Respinge
            </button>
            <button
              onClick={onApprove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 transition-colors"
            >
              <CheckCircle size={13} /> Aprobă
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function Suggestions() {
  const queryClient = useQueryClient()
  const [approving, setApproving]                 = useState<Set<number>>(new Set())
  const [priorityFilter, setPriorityFilter]       = useState<PriorityFilter>('all')
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
        if (priorityFilter === 'urgent' && !isUrgent(s.reason)) return false
        if (priorityFilter === 'normal' && isUrgent(s.reason))  return false
        if (sourceFilter !== 'all' && getSourceType(s.from) !== sourceFilter) return false
        if (destinationFilter !== 'all' && s.to?.name !== destinationFilter) return false
        return true
      })
      .sort((a, b) => {
        const aU = isUrgent(a.reason) ? 0 : 1
        const bU = isUrgent(b.reason) ? 0 : 1
        if (aU !== bU) return aU - bU
        const aDays = extractDaysRemaining(a.reason) ?? 999
        const bDays = extractDaysRemaining(b.reason) ?? 999
        return aDays - bDays
      })
  }, [suggestions, priorityFilter, sourceFilter, destinationFilter])

  const hasActiveFilters =
    priorityFilter !== 'all' || sourceFilter !== 'all' || destinationFilter !== 'all'

  const clearFilters = () => {
    setPriorityFilter('all')
    setSourceFilter('all')
    setDestinationFilter('all')
  }

  const runMutation = useMutation({
    mutationFn: suggestionsApi.run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suggestions'] }),
  })

  const handleRun = () => {
    const pendingCount = suggestions?.length ?? 0
    if (pendingCount > 0) {
      const ok = window.confirm(
        `Există ${pendingCount} sugestii neprocesate.\n\n` +
        `Algoritmul va genera sugestii noi doar dacă situația s-a schimbat.\n` +
        `Sugestiile existente vor fi marcate ca depășite.\n\nContinui?`
      )
      if (!ok) return
    }
    runMutation.mutate()
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      suggestionsApi.updateStatus(id, status),
    onMutate: ({ id }) => {
      setApproving(prev => new Set(prev).add(id))
    },
    onSettled: (_, __, { id }) => {
      setApproving(prev => { const n = new Set(prev); n.delete(id); return n })
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
    },
  })

  const urgentCount = suggestions?.filter(s => isUrgent(s.reason)).length ?? 0
  const totalCost   = suggestions?.reduce((acc, s) => acc + (s.estimated_cost ?? 0), 0) ?? 0
  const totalUnits  = suggestions?.reduce((acc, s) => acc + s.suggested_qty, 0) ?? 0

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {suggestions?.length ?? 0} sugestii în așteptare
          {urgentCount > 0 && (
            <span className="ml-2 text-red-400 font-medium">· {urgentCount} urgente</span>
          )}
        </p>
        <button
          onClick={handleRun}
          disabled={runMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Play size={14} className={runMutation.isPending ? 'animate-pulse' : ''} />
          {runMutation.isPending ? 'Se analizează...' : 'Rulează algoritmul'}
        </button>
      </div>

      {/* Feedback */}
      {runMutation.isSuccess && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-3 text-sm text-emerald-400">
          <CheckCircle size={15} className="shrink-0" />
          {runMutation.data.generated === 0
            ? 'Nicio schimbare față de ultima analiză.'
            : `${runMutation.data.generated} sugestii noi generate.`}
        </div>
      )}
      {runMutation.isError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3 text-sm text-red-400">
          <XCircle size={15} className="shrink-0" />
          Eroare la rularea algoritmului. Încearcă din nou.
        </div>
      )}

      {/* KPI bar */}
      {(suggestions?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Lightbulb size={11} /> Total
            </p>
            <p className="text-xl font-bold text-slate-100">{suggestions?.length}</p>
          </div>
          <div className={`bg-slate-900 border rounded-xl px-4 py-3 ${urgentCount > 0 ? 'border-red-500/20' : 'border-slate-800'}`}>
            <p className="text-xs mb-1 flex items-center gap-1 text-red-400/70">
              <Zap size={11} /> Urgente
            </p>
            <p className={`text-xl font-bold ${urgentCount > 0 ? 'text-red-400' : 'text-slate-100'}`}>
              {urgentCount}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <TrendingDown size={11} /> Unități necesare
            </p>
            <p className="text-xl font-bold text-slate-100">{totalUnits}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">Cost estimat (RON)</p>
            <p className="text-xl font-bold text-slate-100">{totalCost.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Filtre */}
      {(suggestions?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-1 mr-1">
            <Filter size={11} /> Filtrează:
          </span>

          <div className="flex rounded-lg overflow-hidden border border-slate-800 text-xs font-medium">
            {([
              { value: 'all',    label: 'Toate' },
              { value: 'urgent', label: '⚡ Urgente' },
              { value: 'normal', label: 'Normale' },
            ] as { value: PriorityFilter; label: string }[]).map(opt => (
              <button key={opt.value} onClick={() => setPriorityFilter(opt.value)}
                className={`px-3 py-1.5 transition-colors
                  ${priorityFilter === opt.value ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}`}>
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg overflow-hidden border border-slate-800 text-xs font-medium">
            {([
              { value: 'all',       label: 'Toate sursele' },
              { value: 'warehouse', label: '🏭 Depozit' },
              { value: 'stand',     label: '🏪 Stand' },
              { value: 'supplier',  label: '📦 Furnizor' },
            ] as { value: SourceFilter; label: string }[]).map(opt => (
              <button key={opt.value} onClick={() => setSourceFilter(opt.value)}
                className={`px-3 py-1.5 transition-colors
                  ${sourceFilter === opt.value ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}`}>
                {opt.label}
              </button>
            ))}
          </div>

          {destinations.length > 1 && (
            <select value={destinationFilter} onChange={e => setDestinationFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer">
              <option value="all">Toate standurile</option>
              {destinations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          {hasActiveFilters && (
            <>
              <button onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <X size={11} /> Resetează
              </button>
              <span className="text-xs text-slate-600">
                {filtered.length} din {suggestions?.length}
              </span>
            </>
          )}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
              <div className="flex gap-2 mb-3">
                <div className="h-4 bg-slate-800 rounded w-1/3" />
              </div>
              <div className="h-10 bg-slate-800/60 rounded-lg mb-3" />
              <div className="h-3 bg-slate-800 rounded w-2/3 mb-4" />
              <div className="flex justify-between">
                <div className="h-8 bg-slate-800 rounded w-24" />
                <div className="h-8 bg-slate-800 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl py-14 text-center">
          <Lightbulb size={28} className="text-slate-700 mx-auto mb-3" />
          {hasActiveFilters ? (
            <>
              <p className="text-slate-500 text-sm">Nicio sugestie pentru filtrele selectate</p>
              <button onClick={clearFilters} className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Resetează filtrele
              </button>
            </>
          ) : (
            <>
              <p className="text-slate-400 text-sm font-medium mb-1">Nu există sugestii în așteptare</p>
              <p className="text-slate-600 text-xs mb-5">Rulează algoritmul pentru a genera recomandări</p>
              <button onClick={handleRun} disabled={runMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
                <Play size={13} /> Rulează acum
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {filtered.map(s => (
              <SuggestionCard
                key={s.id}
                s={s}
                isPending={approving.has(s.id)}
                onApprove={() => updateMutation.mutate({ id: s.id, status: 'approved' })}
                onReject={()  => updateMutation.mutate({ id: s.id, status: 'rejected' })}
              />
            ))}
          </div>

          {!hasActiveFilters && urgentCount === 0 && (suggestions?.length ?? 0) >= 3 && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => {
                  const ok = window.confirm(`Aprobi toate cele ${suggestions?.length} sugestii?`)
                  if (!ok) return
                  suggestions?.forEach(s => updateMutation.mutate({ id: s.id, status: 'approved' }))
                }}
                className="text-xs text-slate-500 hover:text-emerald-400 transition-colors underline underline-offset-2"
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