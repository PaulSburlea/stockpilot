import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNotifications } from '../../context/NotificationsContext'
import { useAuth } from '../../context/AuthContext'
import { locationsApi } from '../../services/api'
import type { Notification, Location } from '../../services/api'
import {
  AlertTriangle, Info, X, CheckCheck,
  Bell, ArrowRight, MapPin
} from 'lucide-react'

type FilterType = 'all' | 'critical' | 'warning' | 'info'

/** Id-uri de locație (stand) asociate notificării, pentru filtrare. */
function getNotificationLocationIds(n: Notification): number[] {
  const m = n.metadata ?? {}
  const ids: number[] = []
  if (m.location_id != null) ids.push(Number(m.location_id))
  if (m.to_location_id != null) ids.push(Number(m.to_location_id))
  if (m.from_location_id != null) ids.push(Number(m.from_location_id))
  return [...new Set(ids)]
}

const typeConfig = {
  critical: {
    icon: <AlertTriangle size={14} />,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
  },
  warning: {
    icon: <AlertTriangle size={14} />,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    dot: 'bg-orange-500',
  },
  info: {
    icon: <Info size={14} />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    dot: 'bg-blue-500',
  },
}

function NotificationItem({
  notification,
  onDismiss,
  onNavigate,
}: {
  notification: Notification
  onDismiss: () => void
  onNavigate: () => void
}) {
  const config = typeConfig[notification.type]

  const timeAgo = () => {
    const diff = Date.now() - new Date(notification.created_at).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'acum'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}z`
  }

  return (
    <div className={`relative border rounded-xl p-3.5 ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`mt-0.5 shrink-0 ${config.color}`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`text-xs font-semibold ${config.color}`}>
              {notification.title}
            </p>
            <span className="text-xs text-slate-600 shrink-0">{timeAgo()}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {notification.message}
          </p>
          {notification.location && (
            <p className="text-xs text-slate-600 mt-1">{notification.location}</p>
          )}

          {/* Link acțiune */}
          <button
            onClick={onNavigate}
            className={`mt-2 flex items-center gap-1 text-xs font-medium ${config.color} hover:underline`}
          >
            Vezi detalii
            <ArrowRight size={10} />
          </button>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="shrink-0 text-slate-600 hover:text-slate-400 transition-colors mt-0.5"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

interface Props {
  onClose: () => void
}

export default function NotificationsPanel({ onClose }: Props) {
  const { user } = useAuth()
  const { notifications, summary, dismiss, dismissAll } = useNotifications()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterType>('all')
  const [locationFilter, setLocationFilter] = useState<number | ''>('')

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
    enabled: user?.role === 'admin' || user?.role === 'warehouse_manager',
  })
  const stands = (locations ?? []).filter((l: Location) => l.type === 'stand')

  const byType =
    filter === 'all'
      ? notifications
      : notifications.filter(n => n.type === filter)
  const filteredNotifications =
    locationFilter === ''
      ? byType
      : byType.filter(n => getNotificationLocationIds(n).includes(locationFilter as number))

  const handleNavigate = (url: string) => {
    navigate(url)
    onClose()
  }

  const filterButtons: { key: FilterType; label: string; count: number; activeColor: string }[] = [
    { key: 'all', label: 'Toate', count: summary.total, activeColor: 'bg-slate-600 text-slate-100' },
    ...(summary.critical > 0
      ? [{ key: 'critical' as const, label: 'Critice', count: summary.critical, activeColor: 'bg-red-500/20 text-red-400' }]
      : []),
    ...(summary.warning > 0
      ? [{ key: 'warning' as const, label: 'Atenție', count: summary.warning, activeColor: 'bg-orange-500/20 text-orange-400' }]
      : []),
    ...(summary.info > 0
      ? [{ key: 'info' as const, label: 'Info', count: summary.info, activeColor: 'bg-blue-500/20 text-blue-400' }]
      : []),
  ]

  const showStandFilter = (user?.role === 'admin' || user?.role === 'warehouse_manager') && stands.length > 0

  return (
    <div className="absolute right-0 top-12 w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-100">Notificări</span>
          {summary.total > 0 && (
            <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full">
              {summary.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={dismissAll}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <CheckCheck size={13} />
              Marchează toate
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Sumar tipuri — click = filtrează lista (sortare pe tip) */}
      {summary.total > 0 && (
        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-800">
          {filterButtons.map(({ key, label, count, activeColor }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors
                ${filter === key
                  ? activeColor + ' ring-1 ring-slate-500'
                  : key === 'all'
                    ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                    : key === 'critical'
                      ? 'bg-red-500/10 text-red-400/80 hover:bg-red-500/20 hover:text-red-400'
                      : key === 'warning'
                        ? 'bg-orange-500/10 text-orange-400/80 hover:bg-orange-500/20 hover:text-orange-400'
                        : 'bg-blue-500/10 text-blue-400/80 hover:bg-blue-500/20 hover:text-blue-400'
                }`}
            >
              {key !== 'all' && (
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0
                    ${key === 'critical' ? 'bg-red-500' : key === 'warning' ? 'bg-orange-500' : 'bg-blue-500'}`}
                />
              )}
              {label}
              <span className={filter === key ? 'font-semibold' : ''}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filtru stand — doar pentru admin / manager depozit */}
      {showStandFilter && (
        <div className="px-5 py-2 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1.5">
            <MapPin size={12} className="text-slate-500 shrink-0" />
            <span className="text-xs text-slate-500 font-medium">Stand</span>
          </div>
          <select
            value={locationFilter === '' ? '' : locationFilter}
            onChange={e => setLocationFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">Toate standurile</option>
            {stands.map((stand: Location) => (
              <option key={stand.id} value={stand.id}>
                {stand.name} — {stand.city}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Lista notificări (filtrată) */}
      <div className="max-h-96 overflow-y-auto">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3">
              <Bell size={18} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">
              {filter === 'all' && locationFilter === ''
                ? 'Nicio notificare'
                : locationFilter !== ''
                  ? 'Nicio notificare pentru acest stand'
                  : `Nicio notificare ${filter === 'critical' ? 'critică' : filter === 'warning' ? 'de atenție' : 'de tip info'}`}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {filter === 'all' && locationFilter === ''
                ? 'Totul e în ordine!'
                : 'Alege alt filtru sau Toate.'}
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredNotifications.map(n => (
              <NotificationItem
                key={n.id}
                notification={n}
                onDismiss={() => dismiss(n.id)}
                onNavigate={() => handleNavigate(n.action_url)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-600 text-center">
        Actualizat automat la fiecare 30 secunde
      </div>
    </div>
  )
}