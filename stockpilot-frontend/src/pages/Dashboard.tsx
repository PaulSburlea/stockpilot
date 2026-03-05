import { useAuth } from '../context/AuthContext'
import DashboardAdmin from './DashboardAdmin'
import DashboardStand from './DashboardStand'

export default function Dashboard() {
  const { user } = useAuth()
  return user?.role === 'stand_manager' ? <DashboardStand /> : <DashboardAdmin />
}