import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '../services/api'
import type { AuditLog } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  Activity, Search, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Truck, Lightbulb,
  Settings, Users, ShoppingCart, FileText,
  RefreshCw, Package, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  CREATE:         { label: 'Creat',             color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  APPROVE:        { label: 'Aprobat',           color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  RECEIVE:        { label: 'Primit',            color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  PICKUP:         { label: 'Expediat',          color: 'text-blue-400   bg-blue-500/10   border-blue-500/20' },
  ACCEPT:         { label: 'Acceptat',          color: 'text-blue-400   bg-blue-500/10   border-blue-500/20' },
  UPDATE:         { label: 'Actualizat',        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  REJECT:         { label: 'Respins',           color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  CANCEL:         { label: 'Anulat',            color: 'text-red-400    bg-red-500/10    border-red-500/20' },
  DELETE:         { label: 'Șters',             color: 'text-red-400    bg-red-500/10    border-red-500/20' },
  SUPPLIER_ORDER: { label: 'Comandă furnizor',  color: 'text-amber-400  bg-amber-500/10  border-amber-500/20' },
}

const ENTITY_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  movement:   { label: 'Mișcare',     icon: <Truck         size={13} /> },
  suggestion: { label: 'Sugestie',    icon: <Lightbulb     size={13} /> },
  stock:      { label: 'Stoc',        icon: <Package       size={13} /> },
  sale:       { label: 'Vânzare',     icon: <ShoppingCart  size={13} /> },
  user:       { label: 'Utilizator',  icon: <Users         size={13} /> },
  settings:   { label: 'Setări',      icon: <Settings      size={13} /> },
  product:    { label: 'Produs',      icon: <FileText      size={13} /> },
}

const ROLE_LABELS: Record<string, string> = {
  admin:             'Admin',
  warehouse_manager: 'Depozit',
  stand_manager:     'Stand',
}

// Acțiuni și entități relevante per rol
const STAND_ACTIONS     = ['CREATE', 'CANCEL', 'PICKUP', 'RECEIVE']
const WAREHOUSE_ACTIONS = ['CREATE', 'ACCEPT', 'CANCEL', 'RECEIVE', 'SUPPLIER_ORDER', 'REJECT']
const ADMIN_ACTIONS     = Object.keys(ACTION_CONFIG)

const STAND_ENTITIES     = ['movement', 'sale', 'suggestion']
const WAREHOUSE_ENTITIES = ['movement', 'suggestion', 'stock']
const ADMIN_ENTITIES     = Object.keys(ENTITY_CONFIG)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Supabase returnează uneori timestamps fără 'Z' → adăugăm explicit
// altfel browserul le interpretează ca oră locală în loc de UTC
function toUTC(iso: string): Date {
  if (!iso) return new Date()
  return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
}

function formatDate(iso: string) {
  return toUTC(iso).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
  return toUTC(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

function formatRelative(iso: string) {
  const diff  = Date.now() - toUTC(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'acum'
  if (mins < 60)  return `acum ${mins}m`
  if (hours < 24) return `acum ${hours}h`
  if (days < 7)   return `acum ${days}z`
  return formatDate(iso)
}

// ─────────────────────────────────────────────────────────────────────────────
// Log row — click to expand metadata
// ─────────────────────────────────────────────────────────────────────────────

function LogRow({ log, showUser }: { log: AuditLog; showUser: boolean }) {
  const [expanded, setExpanded] = useState(false)

  const ac = ACTION_CONFIG[log.action]  ?? { label: log.action, color: 'text-slate-400 bg-slate-700/50 border-slate-700' }
  const ec = ENTITY_CONFIG[log.entity] ?? { label: log.entity, icon: <FileText size={13} /> }
  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0

  return (
    <>
      <tr
        onClick={() => hasMetadata && setExpanded(e => !e)}
        className={`border-b border-slate-800 transition-colors
          ${hasMetadata ? 'cursor-pointer hover:bg-slate-800/40' : 'hover:bg-slate-800/20'}`}
      >
        {/* Acțiune */}
        <td className="px-5 py-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${ac.color}`}>
            {ac.label}
          </span>
        </td>

        {/* Entitate */}
        <td className="px-5 py-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            {ec.icon} {ec.label}
            {log.entity_id && <span className="text-slate-600">#{log.entity_id}</span>}
          </span>
        </td>

        {/* Descriere */}
        <td className="px-5 py-3 max-w-xs">
          <p className="text-xs text-slate-300 truncate">{log.description}</p>
        </td>

        {/* Utilizator — doar admin vede */}
        {showUser && (
          <td className="px-5 py-3">
            <p className="text-xs font-medium text-slate-300">{log.user_name}</p>
            {log.user_role && (
              <p className="text-[11px] text-slate-500">{ROLE_LABELS[log.user_role] ?? log.user_role}</p>
            )}
          </td>
        )}

        {/* Data */}
        <td className="px-5 py-3 text-right">
          <p className="text-xs text-slate-400" title={log.created_at}>{formatRelative(log.created_at)}</p>
          <p className="text-[11px] text-slate-600">{formatTime(log.created_at)}</p>
        </td>

        {/* Indicator expand */}
        <td className="px-3 py-3 text-slate-700">
          {hasMetadata && (
            expanded
              ? <ArrowUpCircle   size={14} className="text-slate-600" />
              : <ArrowDownCircle size={14} className="text-slate-700 hover:text-slate-500" />
          )}
        </td>
      </tr>

      {/* Rând expandat cu metadata */}
      {expanded && (
        <tr className="border-b border-slate-800 bg-slate-800/30">
          <td colSpan={showUser ? 6 : 5} className="px-5 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(log.metadata ?? {}).map(([k, v]) => (
                <div key={k} className="bg-slate-800 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-slate-500 mb-0.5">{k}</p>
                  <p className="text-xs text-slate-200 font-medium truncate">{String(v ?? '—')}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              {formatDate(log.created_at)} {formatTime(log.created_at)}
              {log.ip_address && ` · IP: ${log.ip_address}`}
            </p>
          </td>
        </tr>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const LIMIT = 25

export default function ActivityLog() {
  const { user } = useAuth()

  const isAdmin     = user?.role === 'admin'
  const isWarehouse = user?.role === 'warehouse_manager'

  const availableActions  = isAdmin ? ADMIN_ACTIONS  : isWarehouse ? WAREHOUSE_ACTIONS  : STAND_ACTIONS
  const availableEntities = isAdmin ? ADMIN_ENTITIES : isWarehouse ? WAREHOUSE_ENTITIES : STAND_ENTITIES

  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [actionFilter, setAction]   = useState('')
  const [entityFilter, setEntity]   = useState('')
  const [fromDate, setFromDate]     = useState('')
  const [toDate, setToDate]         = useState('')

  // Admin → getLogs (full); Stand/Warehouse → getMyActivity (filtrat per locație)
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['activity', isAdmin, page, actionFilter, entityFilter, fromDate, toDate, user?.location_id],
    queryFn: () => {
      if (isAdmin) {
        return auditApi.getLogs({
          page, limit: LIMIT,
          action:    actionFilter || undefined,
          entity:    entityFilter || undefined,
          from_date: fromDate     || undefined,
          to_date:   toDate       || undefined,
        }).then(r => ({ logs: r.logs, total: r.total, page: r.page, pages: r.pages }))
      } else {
        return auditApi.getMyActivity({
          location_id: user?.location_id,
          page,
          limit: LIMIT,
        }).then(r => ({
          logs:  r.logs,
          total: r.total,
          page:  r.page,
          pages: Math.ceil(r.total / LIMIT),
        }))
      }
    },
    placeholderData: prev => prev,
  })

  // Stats — doar admin
  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: auditApi.getStats,
    enabled: isAdmin,
  })

  // Client-side search + filtre (pentru stand/warehouse filtrele se aplică local)
  const logs = (data?.logs ?? []).filter(log => {
    if (search) {
      const q = search.toLowerCase()
      if (
        !log.description.toLowerCase().includes(q) &&
        !log.user_name.toLowerCase().includes(q) &&
        !log.entity.toLowerCase().includes(q)
      ) return false
    }
    if (!isAdmin && actionFilter && log.action !== actionFilter) return false
    if (!isAdmin && entityFilter && log.entity !== entityFilter) return false
    return true
  })

  const hasFilters = !!(search || actionFilter || entityFilter || fromDate || toDate)

  const clearFilters = () => {
    setSearch(''); setAction(''); setEntity('')
    setFromDate(''); setToDate(''); setPage(1)
  }

  // Titlu și descriere contextuale
  const pageTitle = isAdmin
    ? 'Jurnal activitate complet'
    : isWarehouse
      ? 'Activitate depozit'
      : 'Activitatea mea'

  const pageSubtitle = isAdmin
    ? `${data?.total?.toLocaleString() ?? 0} înregistrări totale în sistem`
    : isWarehouse
      ? 'Mișcări, aprobări și acțiuni asociate depozitului'
      : 'Cereri trimise, vânzări înregistrate și transferuri primite'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Activity size={18} className="text-violet-400" />
            {pageTitle}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{pageSubtitle}</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          Actualizează
        </button>
      </div>

      {/* Stats — doar admin */}
      {isAdmin && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Ultimele 7 zile',
              value: stats.total_7days,
              icon: <Activity size={11} />,
              color: 'text-violet-400',
            },
            {
              label: 'Acțiune frecventă',
              value: ACTION_CONFIG[
                Object.entries(stats.by_action).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
              ]?.label ?? '—',
              icon: <CheckCircle size={11} />,
              color: 'text-emerald-400',
            },
            {
              label: 'Utilizator activ',
              value: stats.top_users?.[0]?.name ?? '—',
              icon: <Users size={11} />,
              color: 'text-blue-400',
            },
            {
              label: 'Entitate principală',
              value: ENTITY_CONFIG[
                Object.entries(stats.by_entity).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
              ]?.label ?? '—',
              icon: <FileText size={11} />,
              color: 'text-slate-400',
            },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <p className={`text-xs mb-1 flex items-center gap-1 opacity-70 ${s.color}`}>
                {s.icon}{s.label}
              </p>
              <p className={`text-lg font-bold ${s.color} truncate`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Banner contextual pentru stand/warehouse */}
      {!isAdmin && (
        <div className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border
          ${isWarehouse
            ? 'bg-blue-500/5 border-blue-500/20 text-blue-400/80'
            : 'bg-violet-500/5 border-violet-500/20 text-violet-400/80'}`}
        >
          <Activity size={13} className="shrink-0" />
          {isWarehouse
            ? 'Afișează acțiunile asociate locației acestui depozit — transferuri, aprobări, comenzi.'
            : 'Afișează istoricul standului tău — cereri, vânzări și transferuri primite.'}
        </div>
      )}

      {/* Filtre */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Caută descriere..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 w-48"
          />
        </div>

        {/* Acțiune */}
        <select
          value={actionFilter}
          onChange={e => { setAction(e.target.value); setPage(1) }}
          className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
        >
          <option value="">Toate acțiunile</option>
          {availableActions.map(a => (
            <option key={a} value={a}>{ACTION_CONFIG[a]?.label ?? a}</option>
          ))}
        </select>

        {/* Entitate */}
        <select
          value={entityFilter}
          onChange={e => { setEntity(e.target.value); setPage(1) }}
          className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
        >
          <option value="">Toate entitățile</option>
          {availableEntities.map(e => (
            <option key={e} value={e}>{ENTITY_CONFIG[e]?.label ?? e}</option>
          ))}
        </select>

        {/* Interval dată — doar admin */}
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <input
              type="date" value={fromDate}
              onChange={e => { setFromDate(e.target.value); setPage(1) }}
              className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <span className="text-slate-600 text-xs">—</span>
            <input
              type="date" value={toDate}
              onChange={e => { setToDate(e.target.value); setPage(1) }}
              className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        )}

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <XCircle size={11} /> Resetează
          </button>
        )}

        {hasFilters && (
          <span className="text-xs text-slate-600">{logs.length} rezultate</span>
        )}
      </div>

      {/* Tabel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acțiune</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entitate</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descriere</th>
                {isAdmin && (
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Utilizator</th>
                )}
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dată</th>
                <th className="px-3 py-3.5 w-6" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800 animate-pulse">
                    <td className="px-5 py-3"><div className="h-5 w-20 bg-slate-800 rounded-full" /></td>
                    <td className="px-5 py-3"><div className="h-4 w-16 bg-slate-800 rounded" /></td>
                    <td className="px-5 py-3"><div className="h-4 w-48 bg-slate-800 rounded" /></td>
                    {isAdmin && <td className="px-5 py-3"><div className="h-4 w-24 bg-slate-800 rounded" /></td>}
                    <td className="px-5 py-3"><div className="h-4 w-14 bg-slate-800 rounded ml-auto" /></td>
                    <td className="px-3 py-3" />
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center py-14 text-slate-500">
                    <Activity size={24} className="mx-auto mb-2 text-slate-700" />
                    {hasFilters
                      ? 'Nicio înregistrare pentru filtrele selectate'
                      : 'Nu există activitate înregistrată'}
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <LogRow key={log.id} log={log} showUser={isAdmin} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginare */}
        {data && (data.pages ?? 1) > 1 && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Pagina {data.page} din {data.pages}
              <span className="text-slate-600 ml-2">({data.total} total)</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={data.page <= 1 || isFetching}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => {
                const p = data.pages <= 7
                  ? i + 1
                  : data.page <= 4
                    ? i + 1
                    : data.page >= data.pages - 3
                      ? data.pages - 6 + i
                      : data.page - 3 + i
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    disabled={isFetching}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                      ${p === data.page
                        ? 'bg-violet-600 text-white'
                        : 'hover:bg-slate-800 text-slate-400'}`}
                  >
                    {p}
                  </button>
                )
              })}

              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={data.page >= data.pages || isFetching}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <p className="text-xs text-slate-600 text-center">
          Apasă pe o înregistrare pentru a vedea detaliile complete
        </p>
      )}
    </div>
  )
}