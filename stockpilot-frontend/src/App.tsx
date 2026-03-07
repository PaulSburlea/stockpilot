import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Products from './pages/Products'
import Movements from './pages/Movements'
import Suggestions from './pages/Suggestions'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Sales from './pages/Sales'
import Users from './pages/Users'
import LocationDetail from './pages/LocationDetail'
import Locations from './pages/Locations'
import Forecasting from './pages/Forecasting'
import CostComparison from './pages/CostComparison'
import Export from './pages/Export'
import StockMap from './pages/StockMap'
import AuditLog from './pages/AuditLog'
import ActivityLog from './pages/ActivityLog'
import Settings from './pages/Settings'
import SuggestionsHistory from './pages/SuggestionsHistory'

export default function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400 text-sm">Loading StockPilot...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {/* Rute protejate — orice rol */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard"     element={<Dashboard />} />
        <Route path="/stock"         element={<Stock />} />
        <Route path="/movements"     element={<Movements />} />
        <Route path="/sales"         element={<Sales />} />
        <Route path="/locations/:id" element={<LocationDetail />} />
        <Route path="/locations"     element={<Locations />} />
        <Route path="/export"        element={<Export />} />
        <Route path="/map"           element={<StockMap />} />
        {/* Activitate proprie — accesibil tuturor rolurilor */}
        <Route path="/activity"      element={<ActivityLog />} />
      </Route>

      {/* Rute protejate — doar admin și warehouse_manager */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'warehouse_manager']} />}>
        <Route path="/products"           element={<Products />} />
        <Route path="/suggestions"        element={<Suggestions />} />
        <Route path="/forecasting"        element={<Forecasting />} />
        <Route path="/cost-comparison"    element={<CostComparison />} />
        <Route path="/settings"           element={<Settings />} />
        <Route path="/suggestions/history" element={<SuggestionsHistory />} />
      </Route>

      {/* Rute protejate — doar admin */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/users" element={<Users />} />
        <Route path="/audit" element={<AuditLog />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}