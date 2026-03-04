import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '../services/api'
import type { Product } from '../services/api'
import { Plus, Search, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'

const CATEGORIES = ['Huse', 'Cabluri', 'Căști', 'Adaptoare', 'Încărcătoare', 'Powerbank', 'Suporturi', 'Folii']

type FormState = {
  name: string
  sku: string
  category: string
  unit_price: string
  weight_kg: string
}

const emptyForm: FormState = {
  name: '', sku: '', category: '', unit_price: '', weight_kg: ''
}

export default function Products() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  // Modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState('')

  // Delete confirm state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () => productsApi.getAll(selectedCategory || undefined),
  })

  const createMutation = useMutation({
    mutationFn: (data: Omit<Product, 'id'>) => productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      closeModal()
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Omit<Product, 'id'> }) =>
      productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      closeModal()
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setDeletingProduct(null)
      setDeleteError('')
    },
    onError: (err: Error) => setDeleteError(err.message),
  })

  const filtered = products?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const openCreate = () => {
    setForm(emptyForm)
    setFormError('')
    setModalMode('create')
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      unit_price: String(product.unit_price),
      weight_kg: String(product.weight_kg),
    })
    setFormError('')
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingProduct(null)
    setForm(emptyForm)
    setFormError('')
  }

  const handleSubmit = () => {
    setFormError('')
    if (!form.name || !form.sku || !form.category || !form.unit_price) {
      setFormError('Completează toate câmpurile obligatorii')
      return
    }

    const payload = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      unit_price: parseFloat(form.unit_price),
      weight_kg: parseFloat(form.weight_kg) || 0,
    }

    if (modalMode === 'create') {
      createMutation.mutate(payload)
    } else if (modalMode === 'edit' && editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: payload })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-5">
      {/* Filtre + buton adaugă */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Caută după nume sau SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Toate categoriile</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Produs nou
        </button>
      </div>

      {/* Tabel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produs</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categorie</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Preț achiziție</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Greutate</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">Se încarcă...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">Nu există produse</td>
                </tr>
              ) : filtered.map(product => (
                <tr key={product.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-200">{product.name}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{product.sku}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-300">
                    {product.unit_price.toFixed(2)} RON
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-500">
                    {product.weight_kg} kg
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(product)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                        title="Editează"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => { setDeletingProduct(product); setDeleteError('') }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Șterge"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
            {filtered.length} produse
          </div>
        )}
      </div>

      {/* Modal creare / editare */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-slate-100">
                {modalMode === 'create' ? 'Produs nou' : 'Editează produs'}
              </h3>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Nume produs *', key: 'name', placeholder: 'ex: Husă Silicon iPhone 15' },
                { label: 'SKU *', key: 'sku', placeholder: 'ex: HSA-IPH15-SIL' },
                { label: 'Preț achiziție (RON) *', key: 'unit_price', placeholder: '0.00', type: 'number' },
                { label: 'Greutate (kg)', key: 'weight_kg', placeholder: '0.000', type: 'number' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{field.label}</label>
                  <input
                    type={field.type ?? 'text'}
                    value={form[field.key as keyof FormState]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Categorie *</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Selectează categoria</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {formError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 border border-slate-700 text-slate-400 hover:text-slate-200 text-sm rounded-lg transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isPending ? 'Se salvează...' : modalMode === 'create' ? 'Salvează' : 'Actualizează'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmare ștergere */}
      {deletingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">Confirmare ștergere</h3>
            </div>

            <p className="text-sm text-slate-400 mb-2">
              Ești sigur că vrei să ștergi produsul:
            </p>
            <p className="text-sm font-semibold text-slate-200 mb-5">
              {deletingProduct.name}
            </p>

            {deleteError && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setDeletingProduct(null); setDeleteError('') }}
                className="flex-1 py-2.5 border border-slate-700 text-slate-400 hover:text-slate-200 text-sm rounded-lg transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingProduct.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {deleteMutation.isPending ? 'Se șterge...' : 'Șterge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}