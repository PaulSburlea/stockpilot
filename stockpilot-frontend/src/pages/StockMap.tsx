import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { locationsApi, stockApi } from '../services/api'
import type { Location, StockItem } from '../services/api'
import { useNavigate } from 'react-router-dom'
import { MapPin, Package, AlertTriangle, TrendingUp, ExternalLink } from 'lucide-react'

// Fix iconițe Leaflet cu Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Calculează statistici per locație
function getLocationStats(locationId: number, allStock: StockItem[]) {
  const stock = allStock.filter(s => s.location_id === locationId)
  const totalQty     = stock.reduce((s, i) => s + i.quantity, 0)
  const criticalCount = stock.filter(i => i.quantity <= i.safety_stock).length
  const lowCount      = stock.filter(i => i.quantity > i.safety_stock && i.quantity <= i.safety_stock * 2).length
  const productCount  = stock.length
  const totalValue    = stock.reduce((s, i) => s + i.quantity * (i.products?.unit_price ?? 0), 0)

  const riskLevel =
    criticalCount > 0  ? 'critical' :
    lowCount > 0       ? 'warning' :
    totalQty === 0     ? 'empty' : 'good'

  return { totalQty, criticalCount, lowCount, productCount, totalValue, riskLevel }
}

// Culori pentru cercuri pe hartă
const riskColors = {
  critical: { color: '#ef4444', fill: '#ef4444' },
  warning:  { color: '#f97316', fill: '#f97316' },
  empty:    { color: '#6b7280', fill: '#6b7280' },
  good:     { color: '#10b981', fill: '#10b981' },
  warehouse:{ color: '#3b82f6', fill: '#3b82f6' },
}

// Card lateral pentru locația selectată
function LocationSideCard({
  location,
  stats,
  stock,
  onClose,
  onViewDetail,
}: {
  location: Location
  stats: ReturnType<typeof getLocationStats>
  stock: StockItem[]
  onClose: () => void
  onViewDetail: () => void
}) {
  const criticalItems = stock
    .filter(s => s.location_id === location.id && s.quantity <= s.safety_stock)
    .slice(0, 4)

  const topItems = stock
    .filter(s => s.location_id === location.id)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 4)

  return (
    <div className="absolute top-4 right-4 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-1000 overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 border-b border-slate-800
        ${location.type === 'warehouse' ? 'bg-blue-500/5' : 'bg-slate-800/50'}`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                ${location.type === 'warehouse'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {location.type === 'warehouse' ? 'Depozit' : 'Stand'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-100">{location.name}</h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
              <MapPin size={11} />
              {location.city}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* KPI-uri */}
      <div className="grid grid-cols-3 gap-px bg-slate-800 border-b border-slate-800">
        {[
          { label: 'Stoc total', value: stats.totalQty.toLocaleString(), color: 'text-slate-100' },
          { label: 'Produse', value: stats.productCount, color: 'text-slate-100' },
          { label: 'Critice', value: stats.criticalCount, color: stats.criticalCount > 0 ? 'text-red-400' : 'text-slate-100' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-slate-900 py-3 text-center">
            <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-slate-600">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Stocuri critice */}
      {criticalItems.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={11} />
            Stocuri critice
          </p>
          <div className="space-y-1.5">
            {criticalItems.map(item => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-400 truncate flex-1 mr-2">
                  {item.products?.name}
                </span>
                <span className="text-red-400 font-bold shrink-0">{item.quantity} buc</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top stocuri */}
      <div className="px-4 py-3 border-b border-slate-800">
        <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
          <Package size={11} />
          Top stocuri
        </p>
        <div className="space-y-1.5">
          {topItems.map(item => (
            <div key={item.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-400 truncate flex-1 mr-2">
                {item.products?.name}
              </span>
              <span className="text-slate-200 font-medium shrink-0">{item.quantity} buc</span>
            </div>
          ))}
        </div>
      </div>

      {/* Valoare stoc */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Valoare totală stoc</span>
          <span className="text-sm font-bold text-violet-400">
            {stats.totalValue.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} RON
          </span>
        </div>
      </div>

      {/* Buton detalii */}
      <div className="p-4">
        <button
          onClick={onViewDetail}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <ExternalLink size={14} />
          Vezi pagina locației
        </button>
      </div>
    </div>
  )
}

// Legenda hărții
function MapLegend() {
  return (
    <div className="absolute bottom-6 left-4 bg-slate-900/95 border border-slate-800 rounded-xl px-4 py-3 z-1000">
      <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Legendă</p>
      <div className="space-y-1.5">
        {[
          { color: '#3b82f6', label: 'Depozit central' },
          { color: '#10b981', label: 'Stand — stoc OK' },
          { color: '#f97316', label: 'Stand — stoc scăzut' },
          { color: '#ef4444', label: 'Stand — stoc critic' },
          { color: '#6b7280', label: 'Stand — fără stoc' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2 text-xs text-slate-400">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600 mt-2">
        Dimensiunea cercului = volumul stocului
      </p>
    </div>
  )
}

export default function StockMap() {
  const navigate = useNavigate()
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
  })

  const { data: allStock } = useQuery({
    queryKey: ['stock', 'all'],
    queryFn: () => stockApi.getAll(),
  })

  const stands    = locations?.filter(l => l.type === 'stand') ?? []
  const warehouse = locations?.find(l => l.type === 'warehouse')

  // Calculează raza cercului proporțional cu stocul
  const getRadius = (locationId: number) => {
    const stats = getLocationStats(locationId, allStock ?? [])
    const maxStock = Math.max(...(locations ?? []).map(l =>
      getLocationStats(l.id, allStock ?? []).totalQty
    ))
    const minR = 14
    const maxR = 45
    if (maxStock === 0) return minR
    return minR + ((stats.totalQty / maxStock) * (maxR - minR))
  }

  const selectedStats = selectedLocation
    ? getLocationStats(selectedLocation.id, allStock ?? [])
    : null

  // Sumar general
  const totalCritical = (allStock ?? []).filter(s =>
    s.quantity <= s.safety_stock &&
    locations?.find(l => l.id === s.location_id)?.type === 'stand'
  ).length

  return (
    <div className="space-y-4">
      {/* Sumar rapid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Total standuri',
            value: stands.length,
            icon: <MapPin size={15} className="text-emerald-400" />,
            color: 'text-slate-100',
          },
          {
            label: 'Stocuri critice',
            value: totalCritical,
            icon: <AlertTriangle size={15} className="text-red-400" />,
            color: totalCritical > 0 ? 'text-red-400' : 'text-slate-100',
          },
          {
            label: 'Stoc total rețea',
            value: (allStock ?? []).reduce((s, i) => s + i.quantity, 0).toLocaleString(),
            icon: <Package size={15} className="text-blue-400" />,
            color: 'text-slate-100',
          },
          {
            label: 'Valoare rețea',
            value: (allStock ?? [])
              .reduce((s, i) => s + i.quantity * (i.products?.unit_price ?? 0), 0)
              .toLocaleString('ro-RO', { maximumFractionDigits: 0 }) + ' RON',
            icon: <TrendingUp size={15} className="text-violet-400" />,
            color: 'text-violet-400',
          },
        ].map(kpi => (
          <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              {kpi.icon}
              <span className="text-xs text-slate-500">{kpi.label}</span>
            </div>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Harta */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
           style={{ height: '600px' }}
      >
        <MapContainer
          center={[45.9432, 24.9668]} // centrul României
          zoom={7}
          style={{ height: '100%', width: '100%', background: '#0f172a' }}
          zoomControl={true}
        >
          {/* Tile layer dark */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Depozit central */}
          {warehouse?.lat && warehouse?.lng && (
            <CircleMarker
              center={[warehouse.lat, warehouse.lng]}
              radius={getRadius(warehouse.id)}
              pathOptions={{
                color: riskColors.warehouse.color,
                fillColor: riskColors.warehouse.fill,
                fillOpacity: 0.7,
                weight: 2,
              }}
              eventHandlers={{
                click: () => setSelectedLocation(warehouse),
              }}
            >
              <Popup>
                <div className="text-xs font-semibold">{warehouse.name}</div>
                <div className="text-xs text-gray-500">{warehouse.city}</div>
              </Popup>
            </CircleMarker>
          )}

          {/* Standuri */}
          {stands.map(stand => {
            if (!stand.lat || !stand.lng) return null
            const stats  = getLocationStats(stand.id, allStock ?? [])
            const colors = riskColors[stats.riskLevel as keyof typeof riskColors]

            return (
              <CircleMarker
                key={stand.id}
                center={[stand.lat, stand.lng]}
                radius={getRadius(stand.id)}
                pathOptions={{
                  color: colors.color,
                  fillColor: colors.fill,
                  fillOpacity: 0.75,
                  weight: 2,
                }}
                eventHandlers={{
                  click: () => setSelectedLocation(stand),
                }}
              >
                <Popup>
                  <div className="text-xs font-semibold">{stand.name}</div>
                  <div className="text-xs text-gray-500">{stand.city}</div>
                  <div className="text-xs mt-1">Stoc: {stats.totalQty} buc</div>
                  {stats.criticalCount > 0 && (
                    <div className="text-xs text-red-500 font-semibold">
                      ⚠ {stats.criticalCount} produse critice
                    </div>
                  )}
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>

        {/* Legenda */}
        <MapLegend />

        {/* Card lateral locație selectată */}
        {selectedLocation && selectedStats && (
          <LocationSideCard
            location={selectedLocation}
            stats={selectedStats}
            stock={allStock ?? []}
            onClose={() => setSelectedLocation(null)}
            onViewDetail={() => navigate(`/locations/${selectedLocation.id}`)}
          />
        )}
      </div>
    </div>
  )
}