import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { movementsApi } from '../services/api'
import { CheckCircle, Clock, XCircle, Truck } from 'lucide-react'

const statusConfig = {
  pending:    { label: 'În așteptare', icon: <Clock size={13} />,        color: 'text-orange-400 bg-orange-500/10' },
  in_transit: { label: 'În tranzit',   icon: <Truck size={13} />,        color: 'text-blue-400 bg-blue-500/10' },
  completed:  { label: 'Finalizat',    icon: <CheckCircle size={13} />,  color: 'text-emerald-400 bg-emerald-500/10' },
  cancelled:  { label: 'Anulat',       icon: <XCircle size={13} />,      color: 'text-red-400 bg-red-500/10' },
}

const typeLabels = {
  transfer:       'Transfer intern',
  supplier_order: 'Comandă furnizor',
  adjustment:     'Ajustare',
}

export default function Movements() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')

  const { data: movements, isLoading } = useQuery({
    queryKey: ['movements', statusFilter],
    queryFn: () => movementsApi.getAll(statusFilter || undefined),
  })

  const completeMutation = useMutation({
    mutationFn: (id: number) => movementsApi.complete(id),
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
              ) : movements?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">Nu există mișcări</td>
                </tr>
              ) : movements?.map(m => {
                const status = statusConfig[m.status]
                return (
                  <tr key={m.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-200">{m.products?.name}</td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {m.from?.name ?? <span className="text-slate-600 italic">Furnizor</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">{m.to?.name}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-slate-500">
                        {typeLabels[m.movement_type]}
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
                    <td className="px-5 py-3.5 text-right">
                      {m.status === 'pending' && (
                        <button
                          onClick={() => completeMutation.mutate(m.id)}
                          disabled={completeMutation.isPending}
                          className="text-xs px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Finalizează
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}