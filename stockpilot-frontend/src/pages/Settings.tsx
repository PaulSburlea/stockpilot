import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, locationsApi } from '../services/api'
import type { LocationSettings } from '../services/api'
import {
  Settings as SettingsIcon, Save, RotateCcw,
  Warehouse, Store, ChevronDown, ChevronUp,
  Info, CheckCircle, AlertCircle, Sliders
} from 'lucide-react'

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
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-56 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 z-50 shadow-xl">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-700" />
        </div>
      )}
    </div>
  )
}

function SettingSlider({
  label, value, min, max, step = 1, unit, tooltip, onChange, disabled,
}: {
  label: string; value: number; min: number; max: number
  step?: number; unit: string; tooltip: string
  onChange: (v: number) => void; disabled?: boolean
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-300">{label}</label>
          <InfoTooltip text={tooltip} />
        </div>
        <span className="text-sm font-bold text-violet-400 tabular-nums">{value} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500
          [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:bg-violet-400
          [&::-webkit-slider-thumb]:shadow-lg"
        style={{ background: `linear-gradient(to right, #7c3aed ${pct}%, #1e293b ${pct}%)` }}
      />
      <div className="flex justify-between text-xs text-slate-600">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  )
}

// Slider procentaj (0.05–1.00 stocat ca decimal, afișat ca %)
function PercentSlider({
  label, value, min, max, step = 0.05, tooltip, onChange, disabled,
}: {
  label: string; value: number; min: number; max: number
  step?: number; tooltip: string
  onChange: (v: number) => void; disabled?: boolean
}) {
  const pct = ((value - min) / (max - min)) * 100
  const display = Math.round(value * 100)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-300">{label}</label>
          <InfoTooltip text={tooltip} />
        </div>
        <span className="text-sm font-bold text-violet-400 tabular-nums">{display}%</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        disabled={disabled}
        onChange={e => onChange(Number(Number(e.target.value).toFixed(2)))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500
          [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:bg-violet-400
          [&::-webkit-slider-thumb]:shadow-lg"
        style={{ background: `linear-gradient(to right, #7c3aed ${pct}%, #1e293b ${pct}%)` }}
      />
      <div className="flex justify-between text-xs text-slate-600">
        <span>{Math.round(min * 100)}%</span>
        <span>{Math.round(max * 100)}%</span>
      </div>
    </div>
  )
}

function LocationSettingsCard({ locationId }: { locationId: number }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<LocationSettings | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', locationId],
    queryFn: () => settingsApi.getByLocation(locationId),
  })

  useEffect(() => {
    if (settings) setForm(prev => prev ?? settings)
  }, [settings])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<LocationSettings>) => settingsApi.update(locationId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settings', locationId] })
      setForm(data)
      setSaved(true)
      setSaveError(null)
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err: Error) => {
      setSaveError(err.message ?? 'Eroare la salvare. Încearcă din nou.')
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => settingsApi.reset(locationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settings', locationId] })
      setForm(data)
      setSaveError(null)
    },
    onError: (err: Error) => {
      setSaveError(err.message ?? 'Eroare la resetare.')
    },
  })

  const location    = settings?.locations
  const currentForm = form ?? settings

  if (isLoading || !currentForm) return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl h-16 animate-pulse" />
  )

  const isWarehouse = location?.type === 'warehouse'
  const isBusy      = updateMutation.isPending || resetMutation.isPending

  const hasChanges = form && settings && (
    form.lead_time_days           !== settings.lead_time_days           ||
    form.safety_stock_multiplier  !== settings.safety_stock_multiplier  ||
    form.reorder_threshold_days   !== settings.reorder_threshold_days   ||
    form.surplus_threshold_days   !== settings.surplus_threshold_days   ||
    form.min_transfer_qty         !== settings.min_transfer_qty         ||
    form.max_transfer_qty         !== settings.max_transfer_qty         ||
    form.max_transport_cost_ratio !== settings.max_transport_cost_ratio ||
    form.auto_suggestions         !== settings.auto_suggestions         ||
    form.stale_days_threshold     !== settings.stale_days_threshold     ||
    form.storage_capacity         !== settings.storage_capacity         ||
    form.notes                    !== settings.notes
  )

  const set = <K extends keyof LocationSettings>(key: K, val: LocationSettings[K]) =>
    setForm(f => f ? { ...f, [key]: val } : f)

  // Validare live min ≤ max
  const minQty = currentForm.min_transfer_qty ?? 5
  const maxQty = currentForm.max_transfer_qty ?? 100
  const minMaxError = minQty > maxQty
    ? 'Cantitatea minimă nu poate depăși cantitatea maximă.' : null

  return (
    <div className={`bg-slate-900 border rounded-xl overflow-hidden transition-all duration-200
      ${isWarehouse ? 'border-blue-500/30' : 'border-slate-800'}
      ${expanded ? 'shadow-xl shadow-black/20' : ''}`}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isWarehouse ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
            {isWarehouse
              ? <Warehouse size={15} className="text-blue-400" />
              : <Store size={15} className="text-emerald-400" />
            }
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-100">
              {location?.name ?? `Locație #${locationId}`}
            </p>
            <p className="text-xs text-slate-500">{location?.city}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="text-slate-500">
              Lead <span className="text-slate-300 font-medium">{currentForm.lead_time_days}z</span>
            </span>
            <span className="text-slate-500">
              Min <span className="text-slate-300 font-medium">{currentForm.min_transfer_qty ?? 5}buc</span>
            </span>
            <span className="text-slate-500">
              Prag <span className="text-slate-300 font-medium">{currentForm.reorder_threshold_days}z</span>
            </span>
            <span className={`font-medium ${currentForm.auto_suggestions ? 'text-emerald-400' : 'text-slate-600'}`}>
              {currentForm.auto_suggestions ? '● Auto' : '○ Manual'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && !saved && (
              <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                Nesalvat
              </span>
            )}
            {expanded
              ? <ChevronUp size={15} className="text-slate-500 shrink-0" />
              : <ChevronDown size={15} className="text-slate-500 shrink-0" />
            }
          </div>
        </div>
      </button>

      {/* Conținut */}
      {expanded && (
        <div className="border-t border-slate-800">

          {/* Erori */}
          {(saveError || minMaxError) && (
            <div className="mx-5 mt-5 space-y-2">
              {saveError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-red-400">Eroare la salvare</p>
                    <p className="text-xs text-red-400/70 mt-0.5">{saveError}</p>
                  </div>
                  <button onClick={() => setSaveError(null)} className="ml-auto text-red-400/50 hover:text-red-400 text-xs">✕</button>
                </div>
              )}
              {minMaxError && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                  <AlertCircle size={14} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">{minMaxError}</p>
                </div>
              )}
            </div>
          )}

          <div className="px-5 pb-5 pt-5 space-y-7">

            {/* ── Reaprovizionare ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sliders size={12} className="text-slate-600" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Reaprovizionare
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <SettingSlider
                  label="Lead time livrare" unit="zile" disabled={isBusy}
                  value={currentForm.lead_time_days} min={1} max={14}
                  tooltip="Zile necesare pentru livrare de la depozit/furnizor."
                  onChange={v => set('lead_time_days', v)}
                />
                <SettingSlider
                  label="Prag reaprovizionare" unit="zile" disabled={isBusy}
                  value={currentForm.reorder_threshold_days} min={1} max={30}
                  tooltip="Dacă stocul estimat scade sub acest număr de zile, algoritmul generează o sugestie."
                  onChange={v => set('reorder_threshold_days', v)}
                />
                <SettingSlider
                  label="Prag surplus" unit="zile" disabled={isBusy}
                  value={currentForm.surplus_threshold_days} min={20} max={120}
                  tooltip="Stocul care acoperă mai mult decât atâtea zile e considerat surplus — poate fi transferat altora."
                  onChange={v => set('surplus_threshold_days', v)}
                />
                <SettingSlider
                  label="Multiplicator stoc minim" unit="×" step={0.1} disabled={isBusy}
                  value={currentForm.safety_stock_multiplier} min={0.5} max={3}
                  tooltip="Înmulțește stocul de siguranță setat per produs. 1.5× = tratează minimul ca și cum ar fi cu 50% mai mare."
                  onChange={v => set('safety_stock_multiplier', v)}
                />
              </div>
            </section>

            {/* ── Transfer & cost ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sliders size={12} className="text-slate-600" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Transfer & cost
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <SettingSlider
                  label="Cantitate minimă transfer" unit="buc" step={1} disabled={isBusy}
                  value={currentForm.min_transfer_qty ?? 5} min={1} max={50}
                  tooltip="Sugestiile cu mai puține unități decât acest prag sunt ignorate — nu merită logistic să miști 1-2 bucăți."
                  onChange={v => set('min_transfer_qty', v)}
                />
                <SettingSlider
                  label="Cantitate maximă transfer" unit="buc" step={10} disabled={isBusy}
                  value={currentForm.max_transfer_qty} min={10} max={500}
                  tooltip="Limita per transfer sugerat. Previne transferuri care ar lăsa sursa fără stoc."
                  onChange={v => set('max_transfer_qty', v)}
                />
                <PercentSlider
                  label="Cost maxim transport / marfă" disabled={isBusy}
                  value={currentForm.max_transport_cost_ratio ?? 0.25} min={0.05} max={1}
                  tooltip="Dacă costul de transport depășește X% din valoarea mărfii mutate, transferul e ignorat. Ex: 25% = transport de 50 RON pentru marfă de 200 RON."
                  onChange={v => set('max_transport_cost_ratio', v)}
                />
              </div>

              {/* Preview: la 25% cu un exemplu */}
              <div className="mt-3 px-3 py-2 bg-slate-800/50 border border-slate-800 rounded-lg">
                <p className="text-xs text-slate-500">
                  Cu pragul curent de{' '}
                  <span className="text-slate-300 font-medium">
                    {Math.round((currentForm.max_transport_cost_ratio ?? 0.25) * 100)}%
                  </span>
                  , un transfer de{' '}
                  <span className="text-slate-300 font-medium">{currentForm.min_transfer_qty ?? 5} buc</span>
                  {' '}la produs de <span className="text-slate-300 font-medium">20 RON/buc</span>{' '}
                  acceptă transport maxim de{' '}
                  <span className="text-slate-300 font-medium">
                    {((currentForm.max_transport_cost_ratio ?? 0.25) * (currentForm.min_transfer_qty ?? 5) * 20).toFixed(0)} RON
                  </span>.
                </p>
              </div>
            </section>

            {/* ── Stoc mort & capacitate ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sliders size={12} className="text-slate-600" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Stoc mort & capacitate
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <SettingSlider
                  label="Prag stoc mort" unit="zile" disabled={isBusy}
                  value={currentForm.stale_days_threshold ?? 60} min={14} max={180}
                  tooltip="Produsele nevândute mai mult decât atâtea zile sunt clasificate ca stoc mort."
                  onChange={v => set('stale_days_threshold', v)}
                />
                <SettingSlider
                  label="Capacitate stand" unit="buc" step={50} disabled={isBusy}
                  value={currentForm.storage_capacity ?? 9999} min={50} max={2000}
                  tooltip="Numărul maxim de unități totale (toate produsele) pe care standul le poate stoca simultan."
                  onChange={v => set('storage_capacity', v)}
                />
              </div>
              {(currentForm.storage_capacity ?? 9999) >= 2000 && (
                <p className="text-xs text-slate-600 mt-3 italic">
                  Capacitate la maxim — nelimitată efectiv.
                </p>
              )}
            </section>

            {/* ── Control algoritm ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sliders size={12} className="text-slate-600" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Control algoritm
                </p>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-300">Sugestii automate</label>
                  <InfoTooltip text="Dacă activ, algoritmul include această locație la rulare." />
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${currentForm.auto_suggestions ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {currentForm.auto_suggestions ? 'Activ' : 'Inactiv'}
                  </span>
                  <button
                    disabled={isBusy}
                    onClick={() => set('auto_suggestions', !currentForm.auto_suggestions)}
                    className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50
                      ${currentForm.auto_suggestions ? 'bg-violet-600' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform
                      ${currentForm.auto_suggestions ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </section>

            {/* Note */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <label className="text-xs font-medium text-slate-400">Note interne</label>
                <InfoTooltip text="Vizibile doar pentru administratori." />
              </div>
              <textarea
                value={currentForm.notes ?? ''}
                disabled={isBusy}
                onChange={e => set('notes', e.target.value)}
                placeholder="Note opționale despre această locație..."
                rows={2}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300
                  placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none
                  disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              />
            </section>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div>
                {settings?.updated_at && (
                  <p className="text-xs text-slate-600">
                    Actualizat {new Date(settings.updated_at).toLocaleString('ro-RO')}
                    {settings.updated_by && settings.updated_by !== 'System'
                      ? ` · ${settings.updated_by}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => resetMutation.mutate()}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                    text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700
                    border border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={12} className={resetMutation.isPending ? 'animate-spin' : ''} />
                  Reset
                </button>
                <button
                  onClick={() => form && !minMaxError && updateMutation.mutate(form)}
                  disabled={isBusy || !hasChanges || !!minMaxError}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold
                    transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                    ${saved
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40'
                    }`}
                >
                  {saved ? (
                    <><CheckCircle size={12} /> Salvat</>
                  ) : updateMutation.isPending ? (
                    <><Save size={12} className="animate-pulse" /> Se salvează...</>
                  ) : (
                    <><Save size={12} /> Salvează</>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { isLoading } = useQuery({
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
      <div className="bg-slate-900 border border-violet-500/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <SettingsIcon size={18} className="text-violet-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-1">Parametri per locație</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Fiecare locație are parametri independenți pentru algoritmul de reaprovizionare.
              Modificările se aplică la următoarea rulare.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {warehouse && (
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3 px-1">
                Depozit central
              </p>
              <LocationSettingsCard locationId={warehouse.id} />
            </div>
          )}
          {stands.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3 px-1">
                Standuri ({stands.length})
              </p>
              <div className="space-y-3">
                {stands.map(stand => (
                  <LocationSettingsCard key={stand.id} locationId={stand.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}