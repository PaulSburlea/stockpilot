import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Lightbulb,
  BoxesIcon,
  LogOut,
  Warehouse,
  ShoppingCart,
  Users,
  MapPin,
  TrendingDown,
  GitCompare,
  Download,
  Map,
  ScrollText,
  SlidersHorizontal,
  ClipboardList,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles: ('admin' | 'warehouse_manager' | 'stand_manager')[]
  end?: boolean
}

const navItems: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
    roles: ['admin', 'warehouse_manager', 'stand_manager'],
  },
  {
    to: '/users',
    label: 'Utilizatori',
    icon: <Users size={18} />,
    roles: ['admin'],
  },
  {
    to: '/locations',
    label: 'Locații',
    icon: <MapPin size={18} />,
    roles: ['admin', 'warehouse_manager', 'stand_manager'],
  },
  {
    to: '/map',
    label: 'Hartă rețea',
    icon: <Map size={18} />,
    roles: ['admin', 'warehouse_manager'],
  },
  {
    to: '/forecasting',
    label: 'Forecast',
    icon: <TrendingDown size={18} />,
    roles: ['admin', 'warehouse_manager'],
  },
  {
    to: '/sales',
    label: 'Vânzări',
    icon: <ShoppingCart size={18} />,
    roles: ['admin', 'warehouse_manager', 'stand_manager'],
  },
  {
    to: '/stock',
    label: 'Stocuri',
    icon: <BoxesIcon size={18} />,
    roles: ['admin', 'warehouse_manager', 'stand_manager'],
  },
  {
    to: '/cost-comparison',
    label: 'Comparator costuri',
    icon: <GitCompare size={18} />,
    roles: ['admin', 'warehouse_manager'],
  },
  {
    to: '/products',
    label: 'Produse',
    icon: <Package size={18} />,
    roles: ['admin', 'warehouse_manager'],
  },
  {
    to: '/movements',
    label: 'Mișcări stoc',
    icon: <ArrowLeftRight size={18} />,
    roles: ['admin', 'warehouse_manager', 'stand_manager'],
  },
  {
    to: '/suggestions',
    label: 'Sugestii AI',
    icon: <Lightbulb size={18} />,
    roles: ['admin', 'warehouse_manager'],
    end: true,
  },
  {
    to: '/suggestions/history',
    label: 'Istoric sugestii',
    icon: <ClipboardList size={18} />,
    roles: ['admin', 'warehouse_manager'],
  },
  {
    to: '/export',
    label: 'Export rapoarte',
    icon: <Download size={18} />,
    roles: ['admin', 'warehouse_manager', 'stand_manager'],
  },
  {
    to: '/audit',
    label: 'Audit log',
    icon: <ScrollText size={18} />,
    roles: ['admin'],
  },
  {
    to: '/settings',
    label: 'Setări locații',
    icon: <SlidersHorizontal size={18} />,
    roles: ['admin', 'warehouse_manager'],
  },
]

const roleLabels = {
  admin: 'Administrator',
  warehouse_manager: 'Manager Depozit',
  stand_manager: 'Manager Stand',
}

const roleBadgeColors = {
  admin: 'bg-violet-500/20 text-violet-300',
  warehouse_manager: 'bg-blue-500/20 text-blue-300',
  stand_manager: 'bg-emerald-500/20 text-emerald-300',
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visibleItems = navItems.filter(
    item => user && item.roles.includes(user.role)
  )

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="h-16 px-6 flex items-center border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Warehouse size={22} className="text-violet-400" />
          <span className="text-lg font-bold text-white tracking-tight">
            Stock<span className="text-violet-400">Pilot</span>
          </span>
        </div>
      </div>

      {/* Navigație */}
      <nav className="flex-1 p-4 space-y-1">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="p-4 border-t border-slate-800">
        <div className="mb-3 px-1">
          <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
          <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${roleBadgeColors[user?.role ?? 'stand_manager']}`}>
            {roleLabels[user?.role ?? 'stand_manager']}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
        >
          <LogOut size={16} />
          Deconectare
        </button>
      </div>
    </aside>
  )
}