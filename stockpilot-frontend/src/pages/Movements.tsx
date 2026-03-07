import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { movementsApi, productsApi, locationsApi } from '../services/api'
import type { Movement, Product, Location } from '../services/api'
import { CheckCircle, Clock, XCircle, Truck, Package, Lightbulb, Plus, X, ArrowLeftRight, ShoppingCart } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// Toast system
// ─────────────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; type: ToastType }

let toastId = 0

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium
            pointer-events-auto max-w-sm animate-in slide-in-from-right-4
            ${t.type === 'success' ? 'bg-emerald-950 border-emerald-500/30 text-emerald-300' :
              t.type === 'error'   ? 'bg-red-950 border-red-500/30 text-red-300' :
                                     'bg-slate-800 border-slate-700 text-slate-200'}`}
        >
          {t.type === 'success' && <CheckCircle size={15} className="shrink-0 text-emerald-400" />}
          {t.type === 'error'   && <XCircle     size={15} className="shrink-0 text-red-400" />}
          {t.type === 'info'    && <Lightbulb   size={15} className="shrink-0 text-blue-400" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, type: ToastType = 'success', duration = 4000) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, show, dismiss }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status / type config
// ─────────────────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: {
    label: 'În așteptare',
    icon: <Clock size={13} />,
    color: 'text-orange-400 bg-orange-500/10 border border-orange-500/20',
  },
  awaiting_pickup: {
    label: 'De expediat',
    icon: <Package size={13} />,
    color: 'text-violet-400 bg-violet-500/10 border border-violet-500/20',
  },
  in_transit: {
    label: 'În tranzit',
    icon: <Truck size={13} />,
    color: 'text-blue-400 bg-blue-500/10 border border-blue-500/20',
  },
  completed: {
    label: 'Finalizat',
    icon: <CheckCircle size={13} />,
    color: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
  },
  cancelled: {
    label: 'Anulat',
    icon: <XCircle size={13} />,
    color: 'text-red-400 bg-red-500/10 border border-red-500/20',
  },
}

const typeLabels: Record<string, string> = {
  transfer:       'Transfer intern',
  supplier_order: 'Comandă furnizor',
  adjustment:     'Ajustare',
}

const ACTIVE_STATUSES = new Set(['pending', 'awaiting_pickup', 'in_transit'])

const STATUS_FILTERS = [
  { value: 'active',          label: 'Active' },
  { value: '',                label: 'Toate' },
  { value: 'pending',         label: 'În așteptare' },
  { value: 'awaiting_pickup', label: 'De expediat' },
  { value: 'in_transit',      label: 'În tranzit' },
  { value: 'completed',       label: 'Finalizate' },
  { value: 'cancelled',       label: 'Anulate' },
]

// ─────────────────────────────────────────────────────────────────────────────
// New Movement Modal
// ─────────────────────────────────────────────────────────────────────────────

interface NewMovementForm {
  product_id:       string
  from_location_id: string
  to_location_id:   string
  quantity:         string
  movement_type:    'transfer' | 'supplier_order'
  notes:            string
}

function NewMovementModal({
  initialType = 'transfer',
  onClose,
  onSuccess,
}: {
  initialType?: 'transfer' | 'supplier_order'
  onClose:      () => void
  onSuccess:    (msg: string) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<NewMovementForm>({
    product_id: '', from_location_id: '', to_location_id: '',
    quantity: '', movement_type: initialType, notes: '',
  })
  const [error, setError] = useState<string | null>(null)

  const { data: products }  = useQuery<Product[]>({ queryKey: ['products'],  queryFn: () => productsApi.getAll() })
  const { data: locations } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: () => locationsApi.getAll() })

  const createMutation = useMutation({
    mutationFn: () => movementsApi.create({
      product_id:       Number(form.product_id),
      from_location_id: form.from_location_id ? Number(form.from_location_id) : undefined,
      to_location_id:   Number(form.to_location_id),
      quantity:         Number(form.quantity),
      movement_type:    form.movement_type,
      notes:            form.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      const prod = products?.find(p => p.id === Number(form.product_id))
      const dest = locations?.find(l => l.id === Number(form.to_location_id))
      onSuccess(`Mișcare creată: ${form.quantity} × ${prod?.name ?? 'produs'} → ${dest?.name ?? 'destinație'}`)
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const set = (key: keyof NewMovementForm, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const isSupplierOrder = form.movement_type === 'supplier_order'

  const valid =
    form.product_id &&
    form.to_location_id &&
    Number(form.quantity) > 0 &&
    (isSupplierOrder || form.from_location_id) &&
    form.from_location_id !== form.to_location_id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Mișcare nouă</h2>
            <p className="text-xs text-slate-500 mt-0.5">Crează manual un transfer sau o comandă furnizor</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Tip mișcare */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Tip mișcare</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => set('movement_type', 'transfer')}
                className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-all
                  ${form.movement_type === 'transfer'
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'}`}
              >
                <div className={`p-1.5 rounded-lg ${form.movement_type === 'transfer' ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-700 text-slate-400'}`}>
                  <ArrowLeftRight size={14} />
                </div>
                <div>
                  <div className={`text-xs font-semibold ${form.movement_type === 'transfer' ? 'text-slate-100' : 'text-slate-300'}`}>
                    Transfer intern
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">Redistribuie stoc între locații</div>
                </div>
              </button>
              <button
                onClick={() => { set('movement_type', 'supplier_order'); set('from_location_id', '') }}
                className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-all
                  ${form.movement_type === 'supplier_order'
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'}`}
              >
                <div className={`p-1.5 rounded-lg ${form.movement_type === 'supplier_order' ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-700 text-slate-400'}`}>
                  <ShoppingCart size={14} />
                </div>
                <div>
                  <div className={`text-xs font-semibold ${form.movement_type === 'supplier_order' ? 'text-slate-100' : 'text-slate-300'}`}>
                    Comandă furnizor
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">Achiziție externă direct la locație</div>
                </div>
              </button>
            </div>
          </div>

          {/* Produs */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Produs *</label>
            <select
              value={form.product_id}
              onChange={e => set('product_id', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="">— Selectează produs —</option>
              {products?.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>

          {/* De la / Către */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                {isSupplierOrder ? 'Sursă' : 'De la *'}
              </label>
              {isSupplierOrder ? (
                <div className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-500 italic">
                  Furnizor extern
                </div>
              ) : (
                <select
                  value={form.from_location_id}
                  onChange={e => set('from_location_id', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="">— Selectează —</option>
                  {locations?.map(l => (
                    <option key={l.id} value={l.id} disabled={l.id === Number(form.to_location_id)}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Către *</label>
              <select
                value={form.to_location_id}
                onChange={e => set('to_location_id', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="">— Selectează —</option>
                {locations?.map(l => (
                  <option key={l.id} value={l.id} disabled={!isSupplierOrder && l.id === Number(form.from_location_id)}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cantitate */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Cantitate *</label>
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={e => set('quantity', e.target.value)}
              placeholder="ex: 25"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Note (opțional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="ex: Reaprovizionare urgentă înainte de weekend"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {/* Eroare */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <XCircle size={13} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Anulează
          </button>
          <button
            onClick={() => { setError(null); createMutation.mutate() }}
            disabled={!valid || createMutation.isPending}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMutation.isPending ? 'Se creează...' : 'Creează mișcarea'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Movements() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState('active')
  const [showNewModal, setShowNewModal] = useState<'transfer' | 'supplier_order' | null>(null)
  const { toasts, show: showToast, dismiss } = useToast()

  const isWarehouse = user?.role === 'warehouse_manager' || user?.role === 'admin'

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: movements, isLoading } = useQuery({
    queryKey: ['movements', statusFilter, user?.location_id],
    queryFn: () => movementsApi.getAll({
      status: (statusFilter && statusFilter !== 'active') ? statusFilter : undefined,
      location_id: user?.role === 'stand_manager' && user.location_id ? user.location_id : undefined,
    }),
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: ({ id, source_location_id }: { id: number; source_location_id?: number }) =>
      movementsApi.accept(id, source_location_id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      const msg = data.status === 'in_transit'
        ? `Expediat din depozit → ${data.to_location?.name}`
        : `Stand ${data.from_location?.name} notificat să expedieze`
      showToast(msg, 'success')
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

  const pickupMutation = useMutation({
    mutationFn: (id: number) => movementsApi.pickup(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      showToast(`Expediere confirmată → ${data.to_location?.name}`, 'success')
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

  const receiveMutation = useMutation({
    mutationFn: (id: number) => movementsApi.receive(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      showToast(`${data.products?.name} — ${data.quantity} buc adăugate în stoc`, 'success')
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      movementsApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      showToast('Mișcare anulată', 'info')
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

  const orderFromSupplierMutation = useMutation({
    mutationFn: (id: number) => movementsApi.orderFromSupplier(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      showToast(`Comandă furnizor creată → ${data.to_location?.name}`, 'success')
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

  // ── Actions per row ────────────────────────────────────────────────────────

  const renderActions = (m: Movement) => {
    const isSourceStand =
      user?.role === 'stand_manager' &&
      Number(user.location_id) === Number(m.from_location_id)

    const isDestinationStand =
      user?.role === 'stand_manager' &&
      Number(user.location_id) === Number(m.to_location_id)

    if (m.status === 'pending') {
      if (isWarehouse) {
        const isTransferWithSource = m.movement_type === 'transfer' && !!m.from_location_id
        const isTransferNoSource   = m.movement_type === 'transfer' && !m.from_location_id
        const isSupplierOrder      = m.movement_type === 'supplier_order'
        return (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isTransferWithSource && (
              <button
                onClick={() => acceptMutation.mutate({ id: m.id })}
                disabled={acceptMutation.isPending}
                className="text-xs px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
              >
                Acceptă & Expediază
              </button>
            )}
            {isTransferNoSource && (
              <button
                onClick={() => orderFromSupplierMutation.mutate(m.id)}
                disabled={orderFromSupplierMutation.isPending}
                className="text-xs px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded-lg transition-colors disabled:opacity-50"
              >
                Comandă furnizor
              </button>
            )}
            {isSupplierOrder && (
              <button
                onClick={() => acceptMutation.mutate({ id: m.id })}
                disabled={acceptMutation.isPending}
                className="text-xs px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded-lg transition-colors disabled:opacity-50"
              >
                Confirmă comanda
              </button>
            )}
            <button
              onClick={() => cancelMutation.mutate({ id: m.id, reason: 'Respins de warehouse manager' })}
              disabled={cancelMutation.isPending}
              className="text-xs px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors disabled:opacity-50"
            >
              Respinge
            </button>
          </div>
        )
      }
      if (isDestinationStand) {
        return (
          <button
            onClick={() => cancelMutation.mutate({ id: m.id, reason: 'Anulat de stand' })}
            disabled={cancelMutation.isPending}
            className="text-xs px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors disabled:opacity-50"
          >
            Anulează cererea
          </button>
        )
      }
    }

    if (m.status === 'awaiting_pickup') {
      if (isSourceStand) {
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => pickupMutation.mutate(m.id)}
              disabled={pickupMutation.isPending}
              className="text-xs px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 rounded-lg transition-colors disabled:opacity-50"
            >
              Confirmă expediere
            </button>
            <button
              onClick={() => cancelMutation.mutate({ id: m.id, reason: 'Stand sursă nu poate expedia' })}
              disabled={cancelMutation.isPending}
              className="text-xs px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors disabled:opacity-50"
            >
              Nu pot expedia
            </button>
          </div>
        )
      }
      if (isWarehouse) {
        return (
          <button
            onClick={() => cancelMutation.mutate({ id: m.id, reason: 'Anulat de warehouse manager' })}
            disabled={cancelMutation.isPending}
            className="text-xs px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors disabled:opacity-50"
          >
            Anulează
          </button>
        )
      }
    }

    if (m.status === 'in_transit') {
      if (isDestinationStand || isWarehouse) {
        return (
          <button
            onClick={() => receiveMutation.mutate(m.id)}
            disabled={receiveMutation.isPending}
            className="text-xs px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg transition-colors disabled:opacity-50"
          >
            {isWarehouse ? 'Marchează primit' : 'Confirmă primirea'}
          </button>
        )
      }
    }

    return null
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${statusFilter === opt.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Butoane acțiuni rapide — doar warehouse/admin */}
        {isWarehouse && (
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={() => setShowNewModal('transfer')}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
            >
              <Truck size={13} /> Transfer intern
            </button>
            <button
              onClick={() => setShowNewModal('supplier_order')}
              className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus size={13} /> Comandă furnizor
            </button>
          </div>
        )}
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
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">Se încarcă...</td></tr>
              ) : (statusFilter === 'active' ? (movements ?? []).filter(m => ACTIVE_STATUSES.has(m.status)) : (movements ?? [])).length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">Nu există mișcări</td></tr>
              ) : (statusFilter === 'active' ? (movements ?? []).filter(m => ACTIVE_STATUSES.has(m.status)) : (movements ?? [])).map(m => {
                const statusCfg = statusConfig[m.status] ?? statusConfig.pending
                const showRecommendation =
                  m.recommendation_reason &&
                  (m.status === 'pending' || m.status === 'awaiting_pickup')

                return (
                  <tr key={m.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-200">{m.products?.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">SKU: {m.products?.sku}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {m.from_location ? (
                        <div>
                          <div>{m.from_location.name}</div>
                          <div className="text-xs text-slate-500">{m.from_location.city}</div>
                        </div>
                      ) : <span className="text-slate-600 italic">Furnizor</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {m.to_location ? (
                        <div>
                          <div>{m.to_location.name}</div>
                          <div className="text-xs text-slate-500">{m.to_location.city}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-slate-500">{typeLabels[m.movement_type] ?? m.movement_type}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-100">{m.quantity}</td>
                    <td className="px-5 py-3.5 text-right text-slate-400">
                      {m.transport_cost != null ? `${Number(m.transport_cost).toFixed(2)} RON` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.color}`}>
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                        {showRecommendation && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-violet-400/80 max-w-45 text-center leading-tight">
                            <Lightbulb size={10} className="shrink-0 mt-0.5" />
                            {m.recommendation_reason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">{renderActions(m)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legendă */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 pt-1">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" />Cerere nouă — așteaptă aprobare depozit</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400" />De expediat — standul sursă confirmă trimiterea</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" />În tranzit — standul destinație confirmă primirea</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Finalizat</span>
      </div>

      {/* Modal mișcare nouă */}
      {showNewModal && (
        <NewMovementModal
          initialType={showNewModal}
          onClose={() => setShowNewModal(null)}
          onSuccess={msg => showToast(msg, 'success')}
        />
      )}

      {/* Toast-uri */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}