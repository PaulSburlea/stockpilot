import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { suggestionsApi, locationsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  CheckCircle, XCircle, History,
  ArrowRight, Package
} from 'lucide-react'

function ImpactBadge({ suggestion }: { suggestion: any }) {
  // Estimăm impactul pe baza cantității și costului
  const qty  = suggestion.suggested_qty ?? 0
  const cost = suggestion.estimated_cost ?? 0

  const level =
    qty > 50 || cost > 500 ? 'high' :
    qty > 20 || cost > 200 ? 'medium' : 'low'

  const config = {
    high:   { label: 'Impact mare',   color: 'text-violet-400 bg-violet-500/10' },
    medium: { label: 'Impact mediu',  color: 'text-blue-400 bg-blue-500/10' },
    low:    { label: 'Impact mic',    color: 'text-slate-400 bg-slate-500/10' },
  }[level]

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

// Statistici aggregate
function HistoryStats({ suggestions }: { suggestions: any[] }) {
  const approved = suggestions.filter(s => s.status === 'approved')
  const approvalRate = suggestions.length > 0
    ? Math.round((approved.length / suggestions.length) * 100)
    : 0
  const totalQty  = approved.reduce((s, i) => s + (i.suggested_qty ?? 0), 0)
  const totalCost = approved.reduce((s, i) => s + (i.estimated_cost ?? 0), 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 mb-1">Total decizii</p>
        <p className="text-2xl font-bold text-slate-100">{suggestions.length}</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 mb-1">Rată aprobare</p>
        <p className={`text-2xl font-bold ${approvalRate >= 70 ? 'text-emerald-400' : approvalRate >= 40 ? 'text-orange-400' : 'text-red-400'}`}>
          {approvalRate}%
        </p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 mb-1">Unități aprobate</p>
        <p className="text-2xl font-bold text-slate-100">{totalQty.toLocaleString()}</p>
        <p className="text-xs text-slate-600 mt-0.5">buc transferate</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-500 mb-1">Cost total aprobat</p>
        <p className="text-2xl font-bold text-violet-400">
          {totalCost.toFixed(0)} RON
        </p>
      </div>
    </div>
  )
}

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

  const stands     = locations?.filter(l => l.type === 'stand') ?? []
  const suggestions = history ?? []

  const isUrgent = (reason: string) => reason?.includes('[URGENT]')

  return (
    <div className="space-y-5">

      {/* Filtre */}
      <div className="flex flex-col sm:flex-row gap-3">
        {user?.role !== 'stand_manager' && (
          <select
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Toate locațiile</option>
            {stands.map(l => (
              <option key={l.id} value={l.id}>{l.name} — {l.city}</option>
            ))}
          </select>
        )}

        <div className="flex gap-2">
          {[
            { value: '',         label: 'Toate',     count: suggestions.length },
            { value: 'approved', label: 'Aprobate',  count: suggestions.filter(s => s.status === 'approved').length },
            { value: 'rejected', label: 'Respinse',  count: suggestions.filter(s => s.status === 'rejected').length },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value as any)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5
                ${filterStatus === opt.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
            >
              {opt.label}
              {opt.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs
                  ${filterStatus === opt.value ? 'bg-violet-500' : 'bg-slate-800 text-slate-500'}`}
                >
                  {opt.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Statistici */}
      {suggestions.length > 0 && <HistoryStats suggestions={suggestions} />}

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Se încarcă...</div>
      ) : suggestions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl py-16 text-center">
          <History size={32} className="mx-auto mb-3 text-slate-700" />
          <p className="text-slate-500 text-sm">Nu există sugestii în istoric</p>
          <p className="text-slate-600 text-xs mt-1">
            Aprobă sau respinge sugestii din pagina Sugestii
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map(s => {
            const approved = s.status === 'approved'
            const urgent   = isUrgent(s.reason)

            return (
              <div
                key={s.id}
                className={`bg-slate-900 border rounded-xl p-5 transition-colors
                  ${approved ? 'border-emerald-500/20' : 'border-red-500/10'}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">

                  {/* Stânga — info sugestie */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
                        ${approved
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {approved
                          ? <CheckCircle size={12} />
                          : <XCircle size={12} />
                        }
                        {approved ? 'Aprobat' : 'Respins'}
                      </span>

                      {urgent && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-medium">
                          URGENT
                        </span>
                      )}

                      <ImpactBadge suggestion={s} />

                      <span className="text-xs text-slate-600">
                        #{s.id}
                      </span>
                    </div>

                    {/* Produs + rută */}
                    <div className="flex items-center gap-2 text-sm">
                      <Package size={14} className="text-slate-500 shrink-0" />
                      <span className="font-semibold text-slate-100">{s.products?.name}</span>
                      <span className="text-xs text-slate-600 font-mono">{s.products?.sku}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-800">
                        {s.from?.city ?? 'Furnizor'}
                      </span>
                      <ArrowRight size={12} className="text-slate-600" />
                      <span className="px-2 py-0.5 rounded bg-slate-800">
                        {s.to?.city}
                      </span>
                    </div>

                    {/* Motivul sugestiei */}
                    {s.reason && (
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                        {s.reason.replace('[URGENT] ', '').replace('[NORMAL] ', '')}
                      </p>
                    )}
                  </div>

                  {/* Dreapta — cifre */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-100">
                        {s.suggested_qty} buc
                      </p>
                      {s.estimated_cost && (
                        <p className="text-xs text-slate-500">
                          {s.estimated_cost.toFixed(2)} RON transport
                        </p>
                      )}
                    </div>

                    <div className="text-right text-xs text-slate-600">
                      <p>
                        {s.updated_at
                          ? new Date(s.updated_at).toLocaleDateString('ro-RO', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })
                          : '—'
                        }
                      </p>
                      <p className="text-slate-700">
                        {s.updated_at
                          ? new Date(s.updated_at).toLocaleTimeString('ro-RO', {
                              hour: '2-digit', minute: '2-digit'
                            })
                          : ''
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer count */}
      {suggestions.length > 0 && (
        <div className="text-center text-xs text-slate-600 py-2">
          {suggestions.length} înregistrări în istoric
        </div>
      )}
    </div>
  )
}