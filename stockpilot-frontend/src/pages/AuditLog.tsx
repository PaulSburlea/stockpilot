import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { auditApi } from '../services/api'
import {
  Shield, ChevronLeft, ChevronRight,
  LogIn, Plus, Pencil, Trash2,
  CheckCircle, XCircle, Truck, Filter
} from 'lucide-react'

const actionConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  LOGIN:             { label: 'Login',            icon: <LogIn size={13} />,       color: 'text-blue-400 bg-blue-500/10' },
  CREATE:            { label: 'Creare',           icon: <Plus size={13} />,        color: 'text-emerald-400 bg-emerald-500/10' },
  UPDATE:            { label: 'Actualizare',      icon: <Pencil size={13} />,      color: 'text-violet-400 bg-violet-500/10' },
  DELETE:            { label: 'Ștergere',         icon: <Trash2 size={13} />,      color: 'text-red-400 bg-red-500/10' },
  APPROVE:           { label: 'Aprobare',         icon: <CheckCircle size={13} />, color: 'text-emerald-400 bg-emerald-500/10' },
  REJECT:            { label: 'Respingere',       icon: <XCircle size={13} />,     color: 'text-red-400 bg-red-500/10' },
  TRANSFER_COMPLETE: { label: 'Transfer finalizat', icon: <Truck size={13} />,    color: 'text-blue-400 bg-blue-500/10' },
}

const entityLabels: Record<string, string> = {
  product:    'Produs',
  user:       'Utilizator',
  stock:      'Stoc',
  movement:   'Mișcare',
  suggestion: 'Sugestie',
  sale:       'Vânzare',
}

function ActionBadge({ action }: { action: string }) {
  const config = actionConfig[action] ?? {
    label: action,
    icon: null,
    color: 'text-slate-400 bg-slate-500/10',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  )
}

function MetadataView({ metadata }: { metadata: Record<string, any> }) {
  const [open, setOpen] = useState(false)
  if (!metadata || Object.keys(metadata).length === 0) return null

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
      >
        {open ? '▲ ascunde detalii' : '▼ detalii'}
      </button>
      {open && (
        <pre className="mt-1.5 text-xs text-slate-500 bg-slate-800 rounded-lg px-3 py-2 overflow-x-auto">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  )
}

const ACTIONS  = ['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'TRANSFER_COMPLETE']
const ENTITIES = ['product', 'user', 'stock', 'movement', 'suggestion', 'sale']

export default function AuditLog() {
  const [page, setPage]           = useState(1)
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [fromDate, setFromDate]   = useState('')
  const [toDate, setToDate]       = useState('')

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit', page, filterAction, filterEntity, fromDate, toDate],
    queryFn: () => auditApi.getLogs({
      page,
      limit: 50,
      action:    filterAction  || undefined,
      entity:    filterEntity  || undefined,
      from_date: fromDate      || undefined,
      to_date:   toDate        || undefined,
    }),
    placeholderData: keepPreviousData, 
  })

  const { data: stats } = useQuery({
    queryKey: ['audit', 'stats'],
    queryFn: auditApi.getStats,
  })

  const resetFilters = () => {
    setFilterAction('')
    setFilterEntity('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const hasFilters = filterAction || filterEntity || fromDate || toDate

  const selectClass = "px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"

  return (
    <div className="space-y-5">

      {/* Statistici 7 zile */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:col-span-1">
            <p className="text-xs text-slate-500 mb-1">Acțiuni 7 zile</p>
            <p className="text-2xl font-bold text-slate-100">{stats.total_7days}</p>
          </div>

          {/* Top acțiuni */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-2">Top acțiuni</p>
            <div className="space-y-1">
              {Object.entries(stats.by_action)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([action, count]) => (
                  <div key={action} className="flex justify-between text-xs">
                    <span className="text-slate-400">{actionConfig[action]?.label ?? action}</span>
                    <span className="font-bold text-slate-200">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Top entități */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-2">Top entități</p>
            <div className="space-y-1">
              {Object.entries(stats.by_entity)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([entity, count]) => (
                  <div key={entity} className="flex justify-between text-xs">
                    <span className="text-slate-400">{entityLabels[entity] ?? entity}</span>
                    <span className="font-bold text-slate-200">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Top utilizatori */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-2">Top utilizatori</p>
            <div className="space-y-1">
              {stats.top_users.slice(0, 3).map(u => (
                <div key={u.name} className="flex justify-between text-xs">
                  <span className="text-slate-400 truncate flex-1 mr-2">{u.name}</span>
                  <span className="font-bold text-slate-200 shrink-0">{u.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filtre */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filtre</span>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto text-xs text-violet-400 hover:underline"
            >
              Resetează
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1) }}
            className={selectClass}
          >
            <option value="">Toate acțiunile</option>
            {ACTIONS.map(a => (
              <option key={a} value={a}>{actionConfig[a]?.label ?? a}</option>
            ))}
          </select>

          <select
            value={filterEntity}
            onChange={e => { setFilterEntity(e.target.value); setPage(1) }}
            className={selectClass}
          >
            <option value="">Toate entitățile</option>
            {ENTITIES.map(e => (
              <option key={e} value={e}>{entityLabels[e] ?? e}</option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={e => { setFromDate(e.target.value); setPage(1) }}
            className={selectClass}
          />

          <input
            type="date"
            value={toDate}
            onChange={e => { setToDate(e.target.value); setPage(1) }}
            className={selectClass}
          />
        </div>
      </div>

      {/* Tabel log-uri */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-300">Jurnal activitate</h3>
          </div>
          {logs && (
            <span className="text-xs text-slate-500">
              {logs.total.toLocaleString()} înregistrări
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Data & ora
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Utilizator
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Acțiune
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Entitate
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Descriere
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Se încarcă...
                  </td>
                </tr>
              ) : logs?.logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Nu există înregistrări
                  </td>
                </tr>
              ) : logs?.logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                    <p>{new Date(log.created_at).toLocaleDateString('ro-RO')}</p>
                    <p className="text-slate-600">
                      {new Date(log.created_at).toLocaleTimeString('ro-RO')}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-200">{log.user_name}</p>
                    {log.user_role && (
                      <p className="text-xs text-slate-600">{log.user_role}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-400">
                      {entityLabels[log.entity] ?? log.entity}
                      {log.entity_id && (
                        <span className="text-slate-600 ml-1">#{log.entity_id}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3 max-w-xs">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {log.description}
                    </p>
                    {log.metadata && <MetadataView metadata={log.metadata} />}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 font-mono">
                    {log.ip_address ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginare */}
        {logs && logs.pages > 1 && (
          <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Pagina {logs.page} din {logs.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(logs.pages, p + 1))}
                disabled={page === logs.pages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Următor
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}