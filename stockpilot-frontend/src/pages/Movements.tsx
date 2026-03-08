import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { movementsApi, type MovementSourceCandidate } from '../services/api'
import { CheckCircle, Clock, XCircle, Truck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending:    { label: 'În așteptare', icon: <Clock size={13} />,        color: 'text-orange-400 bg-orange-500/10' },
  in_transit: { label: 'În tranzit',   icon: <Truck size={13} />,        color: 'text-blue-400 bg-blue-500/10' },
  completed:  { label: 'Finalizat',    icon: <CheckCircle size={13} />,  color: 'text-emerald-400 bg-emerald-500/10' },
  cancelled:  { label: 'Anulat',       icon: <XCircle size={13} />,      color: 'text-red-400 bg-red-500/10' },
}
const defaultStatus = statusConfig.pending

const typeLabels: Record<string, string> = {
  transfer:       'Transfer intern',
  supplier_order: 'Comandă furnizor',
  adjustment:     'Ajustare',
}

export default function Movements() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [optionsModal, setOptionsModal] = useState<{
    movementId: number | null
    productName: string
    quantity: number
    candidates: MovementSourceCandidate[]
    selectedSourceId: number | null
    quantities: Record<number, number>
  }>({
    movementId: null,
    productName: '',
    quantity: 0,
    candidates: [],
    selectedSourceId: null,
    quantities: {},
  })

  const { data: movements, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['movements', statusFilter, user?.location_id],
    queryFn: () =>
      movementsApi.getAll(
        statusFilter || undefined,
        user?.role === 'stand_manager' && user.location_id ? user.location_id : undefined
      ),
  })

  const completeMutation = useMutation({
    mutationFn: async (id: number) => {
      // Întâi verificăm dacă depozitul are stoc sau trebuie ales alt magazin
      const options = await movementsApi.getOptions(id)

      if (options.can_fulfil_from_source) {
        // Depozitul are stoc, finalizăm direct
        const result = await movementsApi.complete(id)
        await queryClient.invalidateQueries({ queryKey: ['movements'] })
        return result
      }

      if (!options.candidates.length) {
        alert('Nu există niciun magazin cu stoc suficient pentru a onora cererea.')
        return
      }

      const movement = movements?.find(m => m.id === id)
      const baseQty = movement?.quantity ?? 0
      const quantities: Record<number, number> = {}
      options.candidates.forEach(c => {
        // Valoare inițială sugerată: un sfert din stocul magazinului
        const quarter = Math.floor(c.available_qty / 4) || 1
        const initial = Math.max(1, quarter)
        quantities[c.location_id] = initial
      })

      setOptionsModal({
        movementId: id,
        productName: movement?.products?.name ?? 'Produs',
        quantity: baseQty,
        candidates: options.candidates,
        selectedSourceId: options.candidates[0]?.location_id ?? null,
        quantities,
      })
    },
  })

  const finalizeWithSourceMutation = useMutation({
    mutationFn: async () => {
      if (!optionsModal.movementId || !optionsModal.selectedSourceId) return
      const movementId = optionsModal.movementId
      const sourceId = optionsModal.selectedSourceId
      const requested = optionsModal.quantities[sourceId] ?? optionsModal.quantity
      if (!requested || requested <= 0) {
        alert('Te rog introdu o cantitate validă.')
        return
      }
      // Nu facem transfer direct, ci generăm o nouă cerere cu cantitatea aleasă
      await movementsApi.forward(movementId, sourceId, requested)
    },
    onSuccess: () => {
      setOptionsModal({
        movementId: null,
        productName: '',
        quantity: 0,
        candidates: [],
        selectedSourceId: null,
        quantities: {},
      })
      queryClient.invalidateQueries({ queryKey: ['movements'] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => movementsApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['movements'] }),
  })

  return (
    <div className="space-y-5">
      {/* Filtru status */}
      <div className="flex gap-2">
        {[
          { value: '', label: 'Toate' },
          { value: 'pending', label: 'În așteptare' },
          { value: 'in_transit', label: 'În tranzit' },
          { value: 'completed', label: 'Finalizate' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${statusFilter === opt.value
                ? 'bg-violet-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tabel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produs</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">De la</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Către</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tip</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cantitate</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost transport</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">Se încarcă...</td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <p className="text-slate-400 mb-2">Eroare la încărcarea mișcărilor.</p>
                    <p className="text-slate-500 text-sm mb-3">{error instanceof Error ? error.message : 'Eroare necunoscută'}</p>
                    <button
                      onClick={() => refetch()}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white"
                    >
                      Reîncearcă
                    </button>
                  </td>
                </tr>
              ) : movements?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">Nu există mișcări</td>
                </tr>
              ) : (movements ?? []).map(m => {
                const status = (statusConfig[m.status] ?? defaultStatus)
                const typeLabel = typeLabels[m.movement_type] ?? m.movement_type ?? '—'
                return (
                  <tr key={m.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-200">{m.products?.name}</td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {m.from?.name ?? <span className="text-slate-600 italic">Furnizor</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">{m.to?.name}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-slate-500">
                        {typeLabel}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-100">
                      {m.quantity}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-400">
                      {m.transport_cost ? `${m.transport_cost.toFixed(2)} RON` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      {m.status === 'pending' && (
                        // Doar depozitul sau magazinul sursă își poate gestiona cererea
                        (user?.role === 'warehouse_manager' ||
                         (user?.role === 'stand_manager' && user.location_id === m.from_location_id)) && (
                        <>
                          <button
                            onClick={() => completeMutation.mutate(m.id)}
                            disabled={completeMutation.isPending}
                            className="text-xs px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Finalizează
                          </button>
                          <button
                            onClick={() => cancelMutation.mutate(m.id)}
                            disabled={cancelMutation.isPending}
                            className="text-xs px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Respinge
                          </button>
                        </>
                        )
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal alegere magazin sursă */}
      {optionsModal.movementId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Alege magazin sursă</h2>
                <p className="text-xs text-slate-500">
                  Depozitul nu are stoc suficient pentru cererea de {optionsModal.quantity} buc din {optionsModal.productName}.
                  Alege magazinul și cantitatea pe care vrei să o soliciți (chiar și parțial).
                </p>
              </div>
              <button
                onClick={() =>
                  setOptionsModal({
                    movementId: null,
                    productName: '',
                    quantity: 0,
                    candidates: [],
                    selectedSourceId: null,
                  })
                }
                className="text-slate-500 hover:text-slate-300 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60">
                      <th className="px-4 py-2 text-left text-slate-500 uppercase tracking-wider">Magazin</th>
                      <th className="px-4 py-2 text-right text-slate-500 uppercase tracking-wider">Stoc disponibil</th>
                      <th className="px-4 py-2 text-right text-slate-500 uppercase tracking-wider">Vândut 30 zile</th>
                      <th className="px-4 py-2 text-right text-slate-500 uppercase tracking-wider">Marjă</th>
                      <th className="px-4 py-2 text-right text-slate-500 uppercase tracking-wider">Cantitate cerută</th>
                      <th className="px-4 py-2 text-center text-slate-500 uppercase tracking-wider">Alege</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {optionsModal.candidates.map(c => (
                      <tr key={c.location_id} className="bg-slate-900/40">
                        <td className="px-4 py-2 text-slate-200">
                          <div className="font-medium">{c.location_name}</div>
                          <div className="text-[11px] text-slate-500">{c.city}</div>
                        </td>
                        <td className="px-4 py-2 text-right text-slate-100">
                          {c.available_qty}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-100">
                          {c.sold_last_30_days}
                        </td>
                        <td className="px-4 py-2 text-right text-emerald-400 font-semibold">
                          {c.margin}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={1}
                            max={c.available_qty}
                            value={optionsModal.quantities[c.location_id] ?? ''}
                            onChange={e => {
                              const val = Number(e.target.value)
                              const safe = !Number.isFinite(val) || val <= 0
                                ? 1
                                : Math.min(val, c.available_qty)
                              setOptionsModal(prev => ({
                                ...prev,
                                quantities: { ...prev.quantities, [c.location_id]: safe },
                              }))
                            }}
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-md text-right text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="radio"
                            name="sourceLocation"
                            checked={optionsModal.selectedSourceId === c.location_id}
                            onChange={() =>
                              setOptionsModal(prev => ({
                                ...prev,
                                selectedSourceId: c.location_id,
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() =>
                  setOptionsModal({
                    movementId: null,
                    productName: '',
                    quantity: 0,
                    candidates: [],
                    selectedSourceId: null,
                  })
                }
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100"
              >
                Anulează
              </button>
              <button
                onClick={() => finalizeWithSourceMutation.mutate()}
                disabled={!optionsModal.selectedSourceId || finalizeWithSourceMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Confirmă magazinul sursă
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}