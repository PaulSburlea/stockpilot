import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { exportApi, locationsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  Download, FileText, TrendingUp,
  ArrowLeftRight, BarChart2, CheckCircle
} from 'lucide-react'

interface ExportCardProps {
  icon: React.ReactNode
  title: string
  description: string
  color: string
  onExport: () => void
  options?: React.ReactNode
}

function ExportCard({ icon, title, description, color, onExport, options }: ExportCardProps) {
  const [exported, setExported] = useState(false)

  const handleExport = () => {
    onExport()
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${color}`}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>

      {options && (
        <div className="border-t border-slate-800 pt-4">
          {options}
        </div>
      )}

      <button
        onClick={handleExport}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all
          ${exported
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100'
          }`}
      >
        {exported ? (
          <>
            <CheckCircle size={15} />
            Descărcat!
          </>
        ) : (
          <>
            <Download size={15} />
            Descarcă CSV
          </>
        )}
      </button>
    </div>
  )
}

export default function Export() {
  const { user } = useAuth()
  const [stockLocation, setStockLocation]       = useState('')
  const [salesDays, setSalesDays]               = useState<30 | 60 | 90>(30)
  const [salesLocation, setSalesLocation]       = useState('')
  const [movementsStatus, setMovementsStatus]   = useState('')
  const [summaryLocation, setSummaryLocation]   = useState('')

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
  })

  const stands = locations?.filter(l => l.type === 'stand') ?? []

  const selectClass = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
  const labelClass  = "block text-xs font-medium text-slate-500 mb-1.5"

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-sm text-slate-500">
          Exportă datele din sistem în format CSV, compatibil cu Excel și Google Sheets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Export stocuri */}
        <ExportCard
          icon={<FileText size={20} className="text-blue-400" />}
          title="Stocuri curente"
          description="Export complet al stocurilor per produs per locație, cu status și valoare totală."
          color="bg-blue-500/10"
          onExport={() => exportApi.downloadStock(stockLocation ? Number(stockLocation) : undefined)}
          options={
            user?.role !== 'stand_manager' ? (
              <div>
                <label className={labelClass}>Filtrează după locație</label>
                <select
                  value={stockLocation}
                  onChange={e => setStockLocation(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Toate locațiile</option>
                  {locations?.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            ) : null
          }
        />

        {/* Export vânzări */}
        <ExportCard
          icon={<TrendingUp size={20} className="text-emerald-400" />}
          title="Vânzări"
          description="Istoricul vânzărilor cu detalii per produs, locație și valoare totală."
          color="bg-emerald-500/10"
          onExport={() => exportApi.downloadSales(
            salesDays,
            salesLocation ? Number(salesLocation) : undefined
          )}
          options={
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Perioadă</label>
                <div className="flex gap-2">
                  {([30, 60, 90] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setSalesDays(d)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${salesDays === d
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      {d} zile
                    </button>
                  ))}
                </div>
              </div>
              {user?.role !== 'stand_manager' && (
                <div>
                  <label className={labelClass}>Filtrează după locație</label>
                  <select
                    value={salesLocation}
                    onChange={e => setSalesLocation(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Toate locațiile</option>
                    {stands.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          }
        />

        {/* Export mișcări */}
        <ExportCard
          icon={<ArrowLeftRight size={20} className="text-violet-400" />}
          title="Mișcări de stoc"
          description="Toate transferurile și comenzile cu costuri de transport și statusuri."
          color="bg-violet-500/10"
          onExport={() => exportApi.downloadMovements(movementsStatus || undefined)}
          options={
            <div>
              <label className={labelClass}>Filtrează după status</label>
              <select
                value={movementsStatus}
                onChange={e => setMovementsStatus(e.target.value)}
                className={selectClass}
              >
                <option value="">Toate statusurile</option>
                <option value="pending">În așteptare</option>
                <option value="in_transit">În tranzit</option>
                <option value="completed">Finalizate</option>
                <option value="cancelled">Anulate</option>
              </select>
            </div>
          }
        />

        {/* Raport complet */}
        <ExportCard
          icon={<BarChart2 size={20} className="text-orange-400" />}
          title="Raport complet"
          description="Raport combinat cu stoc actual, vânzări pe 30 zile, rata zilnică și zile estimate până la epuizare."
          color="bg-orange-500/10"
          onExport={() => exportApi.downloadSummary(summaryLocation ? Number(summaryLocation) : undefined)}
          options={
            user?.role !== 'stand_manager' ? (
              <div>
                <label className={labelClass}>Filtrează după locație</label>
                <select
                  value={summaryLocation}
                  onChange={e => setSummaryLocation(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Toate locațiile</option>
                  {stands.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            ) : null
          }
        />
      </div>

      {/* Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Cum deschizi fișierele CSV
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-500">
          <div className="space-y-1.5">
            <p className="font-medium text-slate-400">Microsoft Excel</p>
            <p>Deschide Excel → Date → Din Text/CSV → selectează fișierul → Encoding: UTF-8</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-medium text-slate-400">Google Sheets</p>
            <p>File → Import → Upload → selectează fișierul → separator virgulă</p>
          </div>
        </div>
      </div>
    </div>
  )
}