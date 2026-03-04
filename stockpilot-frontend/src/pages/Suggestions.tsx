import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suggestionsApi } from '../services/api'
import { Lightbulb, Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

export default function Suggestions() {
  const queryClient = useQueryClient()

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: suggestionsApi.getAll,
  })

  const runMutation = useMutation({
    mutationFn: suggestionsApi.run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suggestions'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      suggestionsApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suggestions'] }),
  })

  const isUrgent = (reason: string) => reason.includes('[URGENT]')

  return (
    <div className="space-y-5">
      {/* Header cu buton rulare algoritm */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {suggestions?.length ?? 0} sugestii în așteptare
          </p>
        </div>
        <button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Play size={15} />
          {runMutation.isPending ? 'Se analizează...' : 'Rulează algoritmul'}
        </button>
      </div>

      {/* Rezultat rulare */}
      {runMutation.isSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-4 text-sm text-emerald-400">
          ✓ Algoritm rulat cu succes — {runMutation.data.generated} sugestii noi generate
        </div>
      )}

      {/* Lista sugestii */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-500">Se încarcă...</div>
      ) : suggestions?.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center">
          <Lightbulb size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Nu există sugestii în așteptare</p>
          <p className="text-slate-600 text-xs mt-1">Rulează algoritmul pentru a genera recomandări</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions?.map(s => (
            <div
              key={s.id}
              className={`bg-slate-900 border rounded-xl p-5 transition-colors
                ${isUrgent(s.reason)
                  ? 'border-red-500/30'
                  : 'border-slate-800'
                }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  {/* Badge urgent */}
                  {isUrgent(s.reason) && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                      <AlertTriangle size={13} />
                      URGENT
                    </div>
                  )}

                  {/* Produs + rută */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-100">
                      {s.products?.name}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-sm text-slate-400">
                      {s.from?.name ?? 'Furnizor'} → {s.to?.name}
                    </span>
                  </div>

                  {/* Motivul */}
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {s.reason.replace('[URGENT] ', '').replace('[NORMAL] ', '')}
                  </p>

                  {/* Detalii */}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>
                      Cantitate sugerată:{' '}
                      <span className="text-slate-300 font-semibold">{s.suggested_qty} buc</span>
                    </span>
                    {s.estimated_cost && (
                      <span>
                        Cost estimat:{' '}
                        <span className="text-slate-300 font-semibold">
                          {s.estimated_cost.toFixed(2)} RON
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Butoane aprobare */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => updateMutation.mutate({ id: s.id, status: 'rejected' })}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Respinge
                  </button>
                  <button
                    onClick={() => updateMutation.mutate({ id: s.id, status: 'approved' })}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle size={14} />
                    Aprobă
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}