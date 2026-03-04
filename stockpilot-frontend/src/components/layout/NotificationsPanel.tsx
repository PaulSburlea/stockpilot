import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../context/NotificationsContext'
import type { Notification } from '../../services/api'
import {
  AlertTriangle, Info, X, CheckCheck,
  Bell, ArrowRight
} from 'lucide-react'

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
  const { notifications, summary, dismiss, dismissAll } = useNotifications()
  const navigate = useNavigate()

  const handleNavigate = (url: string) => {
    navigate(url)
    onClose()
  }

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

      {/* Sumar tipuri */}
      {summary.total > 0 && (
        <div className="flex gap-2 px-5 py-3 border-b border-slate-800">
          {summary.critical > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {summary.critical} critice
            </div>
          )}
          {summary.warning > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              {summary.warning} atenție
            </div>
          )}
          {summary.info > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {summary.info} info
            </div>
          )}
        </div>
      )}

      {/* Lista notificări */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3">
              <Bell size={18} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">Nicio notificare</p>
            <p className="text-xs text-slate-600 mt-1">Totul e în ordine!</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {notifications.map(n => (
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