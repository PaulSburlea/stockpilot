const API_URL = import.meta.env.VITE_API_URL

// ── Helper fetch ──────────────────────────────────────────
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')

  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Something went wrong')
  }

  return res.json()
}

// ── Types ─────────────────────────────────────────────────
export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'warehouse_manager' | 'stand_manager'
  location_id?: number
  created_at: string
  locations?: Location
}

export interface Location {
  id: number
  name: string
  type: 'warehouse' | 'stand'
  city: string
  address?: string
  lat?: number
  lng?: number
}

export interface Product {
  id: number
  name: string
  sku: string
  category: string
  unit_price: number
  weight_kg: number
}

export interface StockItem {
  id: number
  location_id: number
  product_id: number
  quantity: number
  safety_stock: number
  updated_at: string
  locations?: Location
  products?: Product
}

export interface CriticalStandItem extends StockItem {
  sold_last_30_days: number
  min_request_qty: number
}

export interface Sale {
  id: number
  location_id: number
  product_id: number
  quantity: number
  sold_at: string
  locations?: Location
  products?: Product
}

export interface SalesAnalytics {
  location: Location
  product: Product
  total_quantity: number
  total_days: number
  avg_daily: number
}

export interface Movement {
  id: number
  product_id: number
  from_location_id?: number
  to_location_id: number
  quantity: number
  movement_type: 'transfer' | 'supplier_order' | 'adjustment'
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled'
  transport_cost?: number
  notes?: string
  created_at: string
  products?: Product
  from?: Location
  to?: Location
}

export interface MovementSourceCandidate {
  location_id: number
  location_name: string
  city: string
  available_qty: number
  sold_last_30_days: number
  margin: number
}

export interface MovementOptions {
  can_fulfil_from_source: boolean
  candidates: MovementSourceCandidate[]
}

export interface Suggestion {
  id: number
  product_id: number
  from_location_id?: number
  to_location_id: number
  suggested_qty: number
  reason: string
  estimated_cost: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  products?: Product
  from?: Location
  to?: Location
  updated_at?: string | null
}

export interface ForecastPoint {
  day: number
  date: string
  projected_stock: number
  safety_stock: number
}

export interface ForecastItem {
  location_id: number
  product_id: number
  location_name: string
  location_city: string
  product_name: string
  product_sku: string
  product_category: string
  current_stock: number
  safety_stock: number
  daily_rate: number
  avg_daily_30: number
  avg_daily_60: number
  avg_daily_90: number
  days_until_stockout: number
  stockout_date: string
  forecast_30: number
  forecast_60: number
  forecast_90: number
  projection: ForecastPoint[]
  risk_level: 'critical' | 'warning' | 'normal' | 'safe'
}

export interface CostOption {
  type: 'transfer' | 'warehouse' | 'supplier'
  label: string
  from_location_id: number | null
  from_location_name: string
  from_city: string | null
  available_stock: number | null
  transferable_qty: number | null
  quantity: number
  costs: {
    acquisition?: number
    fixed: number
    variable: number
    total: number
    per_unit: number
  }
  lead_time_days: number
  total_cost: number
  pros: string[]
  cons: string[]
  recommended?: boolean
}

export interface CostComparison {
  product: Product
  to_location: Location
  quantity: number
  options: CostOption[]
  cheapest: CostOption
  fastest: CostOption
}

export interface Notification {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  location?: string
  product?: string
  metadata: Record<string, any>
  created_at: string
  action_url: string
}

export interface NotificationSummary {
  notifications: Notification[]
  summary: {
    total: number
    critical: number
    warning: number
    info: number
  }
}

export interface AuditLog {
  id: number
  user_id?: number
  user_name: string
  user_email?: string
  user_role?: string
  action: string
  entity: string
  entity_id?: number
  description: string
  metadata?: Record<string, any>
  ip_address?: string
  created_at: string
}

export interface AuditResponse {
  logs: AuditLog[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface AuditStats {
  total_7days: number
  by_action: Record<string, number>
  by_entity: Record<string, number>
  top_users: { name: string; count: number }[]
}

export interface LocationSettings {
  id?: number
  location_id: number
  lead_time_days: number
  safety_stock_multiplier: number
  reorder_threshold_days: number
  surplus_threshold_days: number
  max_transfer_qty: number
  auto_suggestions: boolean
  notes?: string
  updated_at?: string
  updated_by?: string
  locations?: Location
}

// ── Users ─────────────────────────────────────────────────
export const usersApi = {
  getAll: () => request<User[]>('/users'),
  create: (data: Omit<User, 'id' | 'created_at' | 'locations'> & { password: string }) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<User> & { password?: string }) =>
    request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' }),
}

// ── Locations ─────────────────────────────────────────────
export const locationsApi = {
  getAll: () => request<Location[]>('/locations'),
  getById: (id: number) => request<Location & { stock: StockItem[] }>(`/locations/${id}`),
}

// ── Products ──────────────────────────────────────────────
export const productsApi = {
  getAll: (category?: string) =>
    request<Product[]>(`/products${category ? `?category=${category}` : ''}`),
  getById: (id: number) =>
    request<Product & { stock_by_location: StockItem[] }>(`/products/${id}`),
  create: (data: Omit<Product, 'id'>) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Omit<Product, 'id'>) =>
  request<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/products/${id}`, {
      method: 'DELETE',
    }),
}

// ── Stock ─────────────────────────────────────────────────
export const stockApi = {
  getAll: (params?: { location_id?: number; product_id?: number }) => {
    const query = new URLSearchParams()
    if (params?.location_id) query.set('location_id', String(params.location_id))
    if (params?.product_id)  query.set('product_id', String(params.product_id))
    return request<StockItem[]>(`/stock?${query}`)
  },
  getCritical: () => request<StockItem[]>('/stock/critical'),
  getCriticalForStand: (location_id: number) => {
    const query = new URLSearchParams({ location_id: String(location_id) })
    return request<CriticalStandItem[]>(`/stock/critical-for-stand?${query}`)
  },
  update: (id: number, quantity: number) =>
    request<StockItem>(`/stock/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
}

// ── Sales ─────────────────────────────────────────────────
export const salesApi = {
  create: (data: { location_id: number; product_id: number; quantity: number }) =>
    request<{ sale: Sale; new_stock: number }>('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAnalytics: (days: 30 | 60 | 90 = 30, location_id?: number) => {
    const query = new URLSearchParams({ days: String(days) })
    if (location_id) query.set('location_id', String(location_id))
    return request<SalesAnalytics[]>(`/sales/analytics?${query}`)
  },
}

// ── Movements ─────────────────────────────────────────────
export const movementsApi = {
  getAll: (status?: string, location_id?: number) => {
    const query = new URLSearchParams()
    if (status) query.set('status', status)
    if (location_id) query.set('location_id', String(location_id))
    const qs = query.toString()
    return request<Movement[]>(`/movements${qs ? `?${qs}` : ''}`)
  },
  create: (data: Partial<Movement>) =>
    request<Movement>('/movements', { method: 'POST', body: JSON.stringify(data) }),
  complete: (id: number) =>
    request<Movement>(`/movements/${id}/complete`, { method: 'PATCH' }),
  completeWithSource: (id: number, source_location_id: number) =>
    request<Movement>(`/movements/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ source_location_id }),
    }),
  cancel: (id: number) =>
    request<Movement>(`/movements/${id}/cancel`, { method: 'PATCH' }),
  getOptions: (id: number) =>
    request<MovementOptions>(`/movements/${id}/options`),
  forward: (id: number, source_location_id: number, requested_qty: number) =>
    request<Movement>(`/movements/${id}/forward`, {
      method: 'POST',
      body: JSON.stringify({ source_location_id, requested_qty }),
    }),
}

// ── Suggestions ───────────────────────────────────────────
export const suggestionsApi = {
  getAll: () => request<Suggestion[]>('/suggestions'),
  run: () => request<{ generated: number; suggestions: Suggestion[] }>('/suggestions/run', {
    method: 'POST',
  }),
  updateStatus: (id: number, status: 'approved' | 'rejected') =>
    request<Suggestion>(`/suggestions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  createFromStand: (payload: { location_id: number; items: { product_id: number; quantity: number; reason?: string }[] }) =>
    request<Suggestion[]>('/suggestions/from-stand', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getHistory: (params?: {
    location_id?: number
    product_id?: number
    status?: 'approved' | 'rejected'
  }) => {
    const query = new URLSearchParams()
    if (params?.location_id) query.set('location_id', String(params.location_id))
    if (params?.product_id)  query.set('product_id', String(params.product_id))
    if (params?.status)      query.set('status', params.status)
    return request<Suggestion[]>(`/suggestions/history?${query}`)
  },
}

// ── Forecast ─────────────────────────────────────────────
export const forecastApi = {
  get: (params?: { location_id?: number; product_id?: number }) => {
    const query = new URLSearchParams()
    if (params?.location_id) query.set('location_id', String(params.location_id))
    if (params?.product_id)  query.set('product_id', String(params.product_id))
    return request<ForecastItem[]>(`/forecast?${query}`)
  },
}

// ── Cost Comparison ─────────────────────────────────────────────────
export const costComparisonApi = {
  compare: (data: { product_id: number; to_location_id: number; quantity: number }) =>
    request<CostComparison>('/cost-comparison', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ── Notifications ─────────────────────────────────────────
export const notificationsApi = {
  getAll: () => request<NotificationSummary>('/notifications'),
}

// ── Export ─────────────────────────────────────────────────
export const exportApi = {
  downloadStock: (location_id?: number) => {
    const query = location_id ? `?location_id=${location_id}` : ''
    window.open(`${import.meta.env.VITE_API_URL}/export/stock${query}`, '_blank')
  },
  downloadSales: (days: 30 | 60 | 90 = 30, location_id?: number) => {
    const query = new URLSearchParams({ days: String(days) })
    if (location_id) query.set('location_id', String(location_id))
    window.open(`${import.meta.env.VITE_API_URL}/export/sales?${query}`, '_blank')
  },
  downloadMovements: (status?: string) => {
    const query = status ? `?status=${status}` : ''
    window.open(`${import.meta.env.VITE_API_URL}/export/movements${query}`, '_blank')
  },
  downloadSummary: (location_id?: number) => {
    const query = location_id ? `?location_id=${location_id}` : ''
    window.open(`${import.meta.env.VITE_API_URL}/export/summary${query}`, '_blank')
  },
}

// ── Audit Logs ─────────────────────────────────────────────────
export const auditApi = {
  getLogs: (params?: {
    page?: number
    limit?: number
    action?: string
    entity?: string
    user_id?: number
    from_date?: string
    to_date?: string
  }) => {
    const query = new URLSearchParams()
    if (params?.page)      query.set('page', String(params.page))
    if (params?.limit)     query.set('limit', String(params.limit))
    if (params?.action)    query.set('action', params.action)
    if (params?.entity)    query.set('entity', params.entity)
    if (params?.user_id)   query.set('user_id', String(params.user_id))
    if (params?.from_date) query.set('from_date', params.from_date)
    if (params?.to_date)   query.set('to_date', params.to_date)
    return request<AuditResponse>(`/audit?${query}`)
  },
  getStats: () => request<AuditStats>('/audit/stats'),
}

// ── Location Settings ─────────────────────────────────────────
export const settingsApi = {
  getAll: () => request<LocationSettings[]>('/settings'),
  getByLocation: (location_id: number) =>
    request<LocationSettings>(`/settings/${location_id}`),
  update: (location_id: number, data: Partial<LocationSettings>) =>
    request<LocationSettings>(`/settings/${location_id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  reset: (location_id: number) =>
    request<LocationSettings>(`/settings/reset/${location_id}`, {
      method: 'POST',
    }),
}