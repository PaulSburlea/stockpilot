import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, locationsApi } from '../services/api'
import type { User } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Plus, Pencil, Trash2, X, AlertTriangle, Shield, Warehouse, Store } from 'lucide-react'

type FormState = {
  name: string
  email: string
  password: string
  role: string
  location_id: string
}

type NewLocationForm = {
  name: string
  city: string
  address: string
  lat: string
  lng: string
}

const emptyForm: FormState = {
  name: '', email: '', password: '', role: '', location_id: ''
}

const emptyLocationForm: NewLocationForm = {
  name: '', city: '', address: '', lat: '', lng: ''
}

const roleConfig = {
  admin: {
    label: 'Administrator',
    color: 'text-violet-400 bg-violet-500/10',
    icon: <Shield size={13} />,
  },
  warehouse_manager: {
    label: 'Manager Depozit',
    color: 'text-blue-400 bg-blue-500/10',
    icon: <Warehouse size={13} />,
  },
  stand_manager: {
    label: 'Manager Stand',
    color: 'text-emerald-400 bg-emerald-500/10',
    icon: <Store size={13} />,
  },
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState('')
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const [showNewLocation, setShowNewLocation] = useState(false)
  const [newLocationForm, setNewLocationForm] = useState<NewLocationForm>(emptyLocationForm)

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  })

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
  })

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> & { password?: string } }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeletingUser(null)
      setDeleteError('')
    },
    onError: (err: Error) => setDeleteError(err.message),
  })

  const createLocationMutation = useMutation({
    mutationFn: (data: {
      name: string
      type: string
      city: string
      address?: string
      lat?: number
      lng?: number
    }) => locationsApi.create(data),
    onSuccess: (newLoc) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setForm(f => ({ ...f, location_id: String(newLoc.id) }))
      setShowNewLocation(false)
      setNewLocationForm(emptyLocationForm)
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const openCreate = () => {
    setForm(emptyForm)
    setFormError('')
    setShowNewLocation(false)
    setNewLocationForm(emptyLocationForm)
    setModalMode('create')
  }

  const openEdit = (user: User) => {
    setEditingUser(user)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      location_id: user.location_id ? String(user.location_id) : '',
    })
    setFormError('')
    setShowNewLocation(false)
    setNewLocationForm(emptyLocationForm)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingUser(null)
    setForm(emptyForm)
    setFormError('')
    setShowNewLocation(false)
    setNewLocationForm(emptyLocationForm)
  }

  const handleSubmit = () => {
    setFormError('')

    if (!form.name || !form.email || !form.role) {
      setFormError('Completează toate câmpurile obligatorii')
      return
    }
    if (modalMode === 'create' && !form.password) {
      setFormError('Parola este obligatorie pentru un utilizator nou')
      return
    }
    if (form.role !== 'admin' && !form.location_id) {
      setFormError('Selectează o locație pentru acest rol')
      return
    }

    const payload = {
      name: form.name,
      email: form.email,
      role: form.role as User['role'],
      location_id: form.location_id ? Number(form.location_id) : undefined,
      ...(form.password ? { password: form.password } : {}),
    }

    if (modalMode === 'create') {
      createMutation.mutate({ ...payload, password: form.password })
    } else if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: payload })
    }
  }

  const handleCreateLocation = () => {
    if (!newLocationForm.name || !newLocationForm.city) {
      setFormError('Completează numele și orașul locației')
      return
    }
    setFormError('')
    createLocationMutation.mutate({
      name: newLocationForm.name,
      city: newLocationForm.city,
      address: newLocationForm.address || undefined,
      type: form.role === 'warehouse_manager' ? 'warehouse' : 'stand',
      lat: newLocationForm.lat ? Number(newLocationForm.lat) : undefined,
      lng: newLocationForm.lng ? Number(newLocationForm.lng) : undefined,
    })
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const stands = locations?.filter(l => l.type === 'stand') ?? []
  const allLocations = locations ?? []
  const roleNeedsLocation = form.role && form.role !== 'admin'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{users?.length ?? 0} utilizatori înregistrați</p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Utilizator nou
        </button>
      </div>

      {/* Carduri utilizatori */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-500">Se încarcă...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users?.map(user => {
            const role = roleConfig[user.role]
            const isCurrentUser = user.id === currentUser?.id
            return (
              <div
                key={user.id}
                className={`bg-slate-900 border rounded-xl p-5 space-y-4
                  ${isCurrentUser ? 'border-violet-500/40' : 'border-slate-800'}`}
              >
                {/* Avatar + nume */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-base font-bold text-white shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-100">{user.name}</p>
                        {isCurrentUser && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">
                            Tu
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                    </div>
                  </div>

                  {/* Acțiuni */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(user)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    {!isCurrentUser && (
                      <button
                        onClick={() => { setDeletingUser(user); setDeleteError('') }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Rol */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${role.color}`}>
                    {role.icon}
                    {role.label}
                  </span>
                  {user.locations && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Store size={11} />
                      {user.locations.city}
                    </span>
                  )}
                </div>

                {/* Data creare */}
                <p className="text-xs text-slate-600">
                  Înregistrat: {new Date(user.created_at).toLocaleDateString('ro-RO')}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal creare / editare */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-slate-100">
                {modalMode === 'create' ? 'Utilizator nou' : 'Editează utilizator'}
              </h3>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nume */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nume complet *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex: Ion Popescu"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="ion@stockpilot.ro"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Parolă */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Parolă{' '}
                  {modalMode === 'edit'
                    ? <span className="text-slate-600">(lasă gol pentru a păstra parola actuală)</span>
                    : '*'
                  }
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={modalMode === 'edit' ? '••••••••' : 'Minim 8 caractere'}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Rol */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Rol *</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value, location_id: '' }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Selectează rolul</option>
                  <option value="admin">Administrator</option>
                  <option value="warehouse_manager">Manager Depozit</option>
                  <option value="stand_manager">Manager Stand</option>
                </select>
              </div>

              {/* Locație */}
              {roleNeedsLocation && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-400">Locație *</label>
                    {!showNewLocation && (
                      <button
                        onClick={() => setShowNewLocation(true)}
                        className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                      >
                        <Plus size={11} />
                        {form.role === 'warehouse_manager' ? 'Depozit nou' : 'Stand nou'}
                      </button>
                    )}
                  </div>

                  {!showNewLocation ? (
                    <select
                      value={form.location_id}
                      onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">Selectează locația</option>
                      {(form.role === 'warehouse_manager'
                        ? allLocations.filter(l => l.type === 'warehouse')
                        : stands
                      ).map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} — {loc.city}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2 p-3 bg-slate-800/60 border border-slate-700 rounded-lg">
                      <p className="text-xs text-slate-400 font-medium">
                        {form.role === 'warehouse_manager' ? 'Depozit nou' : 'Stand nou'}
                      </p>

                      <input
                        type="text"
                        value={newLocationForm.name}
                        onChange={e => setNewLocationForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nume (ex: Stand Unirii)"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />

                      <input
                        type="text"
                        value={newLocationForm.city}
                        onChange={e => setNewLocationForm(f => ({ ...f, city: e.target.value }))}
                        placeholder="Oraș (ex: Cluj-Napoca)"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />

                      <input
                        type="text"
                        value={newLocationForm.address}
                        onChange={e => setNewLocationForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="Adresă (opțional)"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />

                      {/* Coordonate GPS */}
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.000001"
                          value={newLocationForm.lat}
                          onChange={e => setNewLocationForm(f => ({ ...f, lat: e.target.value }))}
                          placeholder="Latitudine (ex: 46.7712)"
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        <input
                          type="number"
                          step="0.000001"
                          value={newLocationForm.lng}
                          onChange={e => setNewLocationForm(f => ({ ...f, lng: e.target.value }))}
                          placeholder="Longitudine (ex: 23.6236)"
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>
                      <p className="text-xs text-slate-600">
                        Coordonatele sunt necesare pentru afișarea pe hartă.{' '}
                        <a
                          href="https://www.latlong.net/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 hover:underline"
                        >
                          Găsește coordonate →
                        </a>
                      </p>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            setShowNewLocation(false)
                            setNewLocationForm(emptyLocationForm)
                          }}
                          className="flex-1 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors"
                        >
                          Anulează
                        </button>
                        <button
                          onClick={handleCreateLocation}
                          disabled={createLocationMutation.isPending}
                          className="flex-1 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {createLocationMutation.isPending ? 'Se creează...' : 'Creează locația'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  {isPending ? 'Se salvează...' : modalMode === 'create' ? 'Creează' : 'Actualizează'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmare ștergere */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">Confirmare ștergere</h3>
            </div>

            <p className="text-sm text-slate-400 mb-1">Ești sigur că vrei să ștergi utilizatorul:</p>
            <p className="text-sm font-semibold text-slate-200 mb-1">{deletingUser.name}</p>
            <p className="text-xs text-slate-500 mb-5">{deletingUser.email}</p>

            {deleteError && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setDeletingUser(null); setDeleteError('') }}
                className="flex-1 py-2.5 border border-slate-700 text-slate-400 hover:text-slate-200 text-sm rounded-lg transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingUser.id)}
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