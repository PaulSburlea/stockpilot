import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi  } from '../services/api'
import type { Notification, NotificationSummary } from '../services/api'
import { useAuth } from './AuthContext'

interface NotificationsContextType {
  notifications: Notification[]
  summary: NotificationSummary['summary']
  dismissedIds: Set<string>
  dismiss: (id: string) => void
  dismissAll: () => void
  isLoading: boolean
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getAll,
    // Polling la fiecare 30 secunde
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    enabled: !!user,
  })

  const allNotifications = data?.notifications ?? []
  const visible = allNotifications.filter(n => !dismissedIds.has(n.id))

  const summary = {
    total:    visible.length,
    critical: visible.filter(n => n.type === 'critical').length,
    warning:  visible.filter(n => n.type === 'warning').length,
    info:     visible.filter(n => n.type === 'info').length,
  }

  const dismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]))
  }

  const dismissAll = () => {
    setDismissedIds(new Set(allNotifications.map(n => n.id)))
  }

  return (
    <NotificationsContext.Provider value={{
      notifications: visible,
      summary,
      dismissedIds,
      dismiss,
      dismissAll,
      isLoading,
    }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}