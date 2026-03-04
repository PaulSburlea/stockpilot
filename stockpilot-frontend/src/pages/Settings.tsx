import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, locationsApi } from '../services/api'
import type { LocationSettings } from '../services/api'
import {
  Settings as SettingsIcon, Save, RotateCcw,
  Warehouse, Store, ChevronDown, ChevronUp,
  Info, CheckCircle
} from 'lucide-react'

// Tooltip informativ
function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-600 hover:text-slate-400 transition-colors"
      >
        <Info size={13} />
      </button>
      {show && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-52 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 z-50 shadow-xl">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-700" />
        </div>
      )}
    </div>
  )
}

// Slider cu valoare afișată
function SettingSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  tooltip,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit: string
  tooltip: string
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-300">{label}</label>
          <InfoTooltip text={tooltip} />
        </div>
        <span className="text-sm font-bold text-violet-400">
          {value} {unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-violet-500
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:hover:bg-violet-400"
          style={{
            background: `linear-gradient(to right, #7c3aed ${pct}%, #334155 ${pct}%)`
          }}
        />
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>{min} {unit}</span>
          <span>{max} {unit}</span>
        </div>
      </div>
    </div>
  )
}

// Card pentru o locație
function LocationSettingsCard({ locationId }: { locationId: number }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<LocationSettings | null>(null)

    const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', locationId],
    queryFn: () => settingsApi.getByLocation(locationId),
    })

    // Sincronizează form când vin datele
    useEffect(() => {
    if (settings && !form) setForm(settings)
    }, [settings])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<LocationSettings>) =>
      settingsApi.update(locationId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settings', locationId] })
      setForm(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => settingsApi.reset(locationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settings', locationId] })
      setForm(data)
    },
  })

  const location = settings?.locations
  const currentForm = form ?? settings

  if (isLoading || !currentForm) return null

  const isWarehouse = location?.type === 'warehouse'
  const hasChanges = form && settings && (
    form.lead_time_days !== settings.lead_time_days ||
    form.safety_stock_multiplier !== settings.safety_stock_multiplier ||
    form.reorder_threshold_days !== settings.reorder_threshold_days ||
    form.surplus_threshold_days !== settings.surplus_threshold_days ||
    form.max_transfer_qty !== settings.max_transfer_qty ||
    form.auto_suggestions !== settings.auto_suggestions ||
    form.notes !== settings.notes
  )

  return (
    <div className={`bg-slate-900 border rounded-xl overflow-hidden transition-colors
      ${isWarehouse ? 'border-blue-500/20' : 'border-slate-800'}`}
    >
      {/* Header card */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isWarehouse ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
            {isWarehouse
              ? <Warehouse size={16} className="text-blue-400" />
              : <Store size={16} className="text-emerald-400" />
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">
              {location?.name ?? `Locație #${locationId}`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{location?.city}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Indicatori rapizi */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
            <span>Lead time: <span className="text-slate-300 font-medium">{currentForm.lead_time_days}z</span></span>
            <span>Prag: <span className="text-slate-300 font-medium">{currentForm.reorder_threshold_days}z</span></span>
            <span className={`font-medium ${currentForm.auto_suggestions ? 'text-emerald-400' : 'text-slate-500'}`}>
              {currentForm.auto_suggestions ? '● Auto' : '○ Manual'}
            </span>
          </div>

          {hasChanges && (
            <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
              Modificat
            </span>
          )}

          {expanded
            ? <ChevronUp size={16} className="text-slate-500" />
            : <ChevronDown size={16} className="text-slate-500" />
          }
        </div>
      </div>

      {/* Conținut expandat */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-800 pt-5 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Coloana stângă */}
            <div className="space-y-5">
              <SettingSlider
                label="Lead time livrare"
                value={currentForm.lead_time_days}
                min={1} max={14} unit="zile"
                tooltip="Numărul de zile necesar pentru livrarea stocului de la depozit sau furnizor. Algoritmul generează sugestii cu acest timp înainte."
                onChange={v => setForm(f => f ? { ...f, lead_time_days: v } : f)}
              />

              <SettingSlider
                label="Prag reaprovizionare"
                value={currentForm.reorder_threshold_days}
                min={1} max={30} unit="zile"
                tooltip="Dacă stocul estimat ajunge sub acest număr de zile, sistemul generează o sugestie de reaprovizionare."
                onChange={v => setForm(f => f ? { ...f, reorder_threshold_days: v } : f)}
              />

              <SettingSlider
                label="Prag surplus"
                value={currentForm.surplus_threshold_days}
                min={20} max={120} unit="zile"
                tooltip="Dacă stocul acoperă mai mult decât acest număr de zile, locația este considerată în surplus și poate dona stoc."
                onChange={v => setForm(f => f ? { ...f, surplus_threshold_days: v } : f)}
              />
            </div>

            {/* Coloana dreaptă */}
            <div className="space-y-5">
              <SettingSlider
                label="Multiplicator stoc minim"
                value={currentForm.safety_stock_multiplier}
                min={0.5} max={3} step={0.1} unit="×"
                tooltip="Înmulțește stocul de siguranță din baza de date. 1.5× înseamnă că sistemul tratează stocul minim ca 50% mai mare decât cel setat."
                onChange={v => setForm(f => f ? { ...f, safety_stock_multiplier: v } : f)}
              />

              <SettingSlider
                label="Cantitate maximă transfer"
                value={currentForm.max_transfer_qty}
                min={10} max={500} step={10} unit="buc"
                tooltip="Cantitatea maximă de produse dintr-un singur transfer. Limitează transferurile prea mari care ar putea descongestiona alte locații."
                onChange={v => setForm(f => f ? { ...f, max_transfer_qty: v } : f)}
              />

              {/* Toggle auto sugestii */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Sugestii automate
                    </label>
                    <InfoTooltip text="Dacă activ, algoritmul include această locație la rularea automată. Dezactivează pentru locații temporar închise." />
                  </div>
                  <button
                    onClick={() => setForm(f => f ? { ...f, auto_suggestions: !f.auto_suggestions } : f)}
                    className={`relative w-11 h-6 rounded-full transition-colors
                      ${currentForm.auto_suggestions ? 'bg-violet-600' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
                      ${currentForm.auto_suggestions ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  {currentForm.auto_suggestions
                    ? 'Locația este inclusă în algoritmul automat'
                    : 'Locația este exclusă din algoritmul automat'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-xs font-medium text-slate-300">Note interne</label>
              <InfoTooltip text="Note vizibile doar pentru administratori. Ex: orar special, constrângeri de spațiu, etc." />
            </div>
            <textarea
              value={currentForm.notes ?? ''}
              onChange={e => setForm(f => f ? { ...f, notes: e.target.value } : f)}
              placeholder="Note opționale despre această locație..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          {/* Ultima actualizare */}
          {settings?.updated_at && (
            <p className="text-xs text-slate-600">
              Ultima actualizare: {new Date(settings.updated_at).toLocaleString('ro-RO')}
              {settings.updated_by && ` de ${settings.updated_by}`}
            </p>
          )}

          {/* Butoane acțiuni */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={13} />
              Reset default
            </button>

            <button
              onClick={() => form && updateMutation.mutate(form)}
              disabled={updateMutation.isPending || !hasChanges}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                ${saved
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20'
                  : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
            >
              {saved ? (
                <>
                  <CheckCircle size={13} />
                  Salvat!
                </>
              ) : (
                <>
                  <Save size={13} />
                  {updateMutation.isPending ? 'Se salvează...' : 'Salvează modificările'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { data: isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getAll,
  })

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
  })

  const warehouse = locations?.find(l => l.type === 'warehouse')
  const stands    = locations?.filter(l => l.type === 'stand') ?? []

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header info */}
      <div className="bg-slate-900 border border-violet-500/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <SettingsIcon size={18} className="text-violet-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-1">
              Parametri per locație
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Fiecare locație poate avea parametri diferiți pentru algoritmul de reaprovizionare.
              De exemplu, un stand dintr-un mall mare poate necesita un lead time mai scurt și un prag
              de reaprovizionare mai agresiv față de un stand dintr-un oraș mai mic.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Se încarcă...</div>
      ) : (
        <div className="space-y-4">
          {/* Depozit central */}
          {warehouse && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Depozit central
              </h2>
              <LocationSettingsCard locationId={warehouse.id} />
            </div>
          )}

          {/* Standuri */}
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Standuri ({stands.length})
            </h2>
            <div className="space-y-3">
              {stands.map(stand => (
                <LocationSettingsCard key={stand.id} locationId={stand.id} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}