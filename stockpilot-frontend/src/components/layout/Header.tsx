import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationsContext'
import { Bell, MapPin } from 'lucide-react'
import NotificationsPanel from './NotificationsPanel'

const pageTitles: Record<string, string> = {
  '/dashboard':       'Dashboard',
  '/stock':           'Gestionare Stocuri',
  '/products':        'Produse',
  '/movements':       'Mișcări Stoc',
  '/suggestions':     'Sugestii Reaprovizionare',
  '/sales':           'Înregistrare Vânzări',
  '/users':           'Utilizatori',
  '/locations':       'Locații',
  '/forecasting':     'Forecast Stocuri',
  '/cost-comparison': 'Comparator Costuri',
}

export default function Header() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { summary, notifications } = useNotifications()
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Închide panelul dacă dai click în afara lui
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const criticalCount = summary.critical
  const totalCount    = summary.total

  // Pulsează dacă sunt notificări critice
  const hasCritical = criticalCount > 0

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
      <h1 className="text-base font-semibold text-slate-100">
        {pageTitles[pathname] ?? 'StockPilot'}
      </h1>

      <div className="flex items-center gap-4">
        {user?.role === 'stand_manager' && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin size={13} />
            <span>Stand local</span>
          </div>
        )}

        {/* Clopotel notificări */}
        <div ref={panelRef} className="relative">
          <button
            onClick={() => setPanelOpen(prev => !prev)}
            className={`relative p-2 rounded-lg transition-colors
              ${panelOpen ? 'bg-slate-700' : 'hover:bg-slate-800'}`}
          >
            <Bell
              size={18}
              className={hasCritical ? 'text-red-400' : 'text-slate-400'}
            />

            {/* Badge număr */}
            {totalCount > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1
                rounded-full text-[10px] text-white flex items-center justify-center font-bold
                ${hasCritical ? 'bg-red-500' : 'bg-violet-600'}`}
              >
                {totalCount > 9 ? '9+' : totalCount}
              </span>
            )}

            {/* Puls animat dacă sunt critice */}
            {hasCritical && (
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-red-500 animate-ping opacity-40" />
            )}
          </button>

          {/* Panoul de notificări */}
          {panelOpen && (
            <NotificationsPanel onClose={() => setPanelOpen(false)} />
          )}
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}