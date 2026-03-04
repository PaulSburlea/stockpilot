import { Router } from 'express'
import supabase from '../config/supabase.js'

const router = Router()

// Helper — convertește array de obiecte în CSV
function toCSV(data, columns) {
  if (!data || data.length === 0) return ''
  const header = columns.map(c => c.label).join(',')
  const rows = data.map(row =>
    columns.map(c => {
      const val = c.getValue ? c.getValue(row) : row[c.key]
      const str = val === null || val === undefined ? '' : String(val)
      // Escape dacă conține virgulă sau ghilimele
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  return [header, ...rows].join('\n')
}

// Helper — sanitizează părțile din numele fișierului (fără diacritice / spații)
function sanitizeFilenamePart(str) {
  return String(str)
    .normalize('NFD')                    // separă diacriticele
    .replace(/[\u0300-\u036f]/g, '')     // scoate diacriticele
    .replace(/[^a-zA-Z0-9_-]/g, '_')     // orice altceva -> _
    .toLowerCase()
}

// Helper — determină eticheta de scope (oraș sau "general"), nesanitizată
async function getScopeLabel(locationId) {
  if (!locationId) return 'general'

  const { data: location } = await supabase
    .from('locations')
    .select('city')
    .eq('id', locationId)
    .single()

  return location?.city || 'general'
}

// GET /api/export/stock?location_id=2
router.get('/stock', async (req, res) => {
  const { location_id } = req.query

  let query = supabase
    .from('stock')
    .select('*, products(name, sku, category, unit_price), locations(name, city, type)')
    .order('location_id')

  if (location_id) query = query.eq('location_id', location_id)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const dateStr = new Date().toISOString().split('T')[0]
  const scopeRaw = await getScopeLabel(location_id ? Number(location_id) : null)
  const scopeLabel = sanitizeFilenamePart(scopeRaw)

  const csv = toCSV(data, [
    { label: 'Locatie',       getValue: r => r.locations?.name },
    { label: 'Oras',          getValue: r => r.locations?.city },
    { label: 'Tip',           getValue: r => r.locations?.type },
    { label: 'Produs',        getValue: r => r.products?.name },
    { label: 'SKU',           getValue: r => r.products?.sku },
    { label: 'Categorie',     getValue: r => r.products?.category },
    { label: 'Cantitate',     key: 'quantity' },
    { label: 'Stoc minim',    key: 'safety_stock' },
    { label: 'Pret achizitie',getValue: r => r.products?.unit_price },
    { label: 'Valoare stoc',  getValue: r => (r.quantity * (r.products?.unit_price ?? 0)).toFixed(2) },
    { label: 'Status',        getValue: r => {
        if (r.quantity <= r.safety_stock) return 'Critic'
        if (r.quantity <= r.safety_stock * 2) return 'Scazut'
        if (r.quantity >= r.safety_stock * 8) return 'Surplus'
        return 'Normal'
      }
    },
    { label: 'Ultima actualizare', key: 'updated_at' },
  ])

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="stocuri_${dateStr}_${scopeLabel}.csv"`
  )
  res.send('\uFEFF' + csv) // BOM pentru Excel
})

// GET /api/export/sales?days=30&location_id=2
router.get('/sales', async (req, res) => {
  const { days = 30, location_id } = req.query
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('sales')
    .select('*, products(name, sku, category, unit_price), locations(name, city)')
    .gte('sold_at', since)
    .order('sold_at', { ascending: false })

  if (location_id) query = query.eq('location_id', location_id)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const dateStr = new Date().toISOString().split('T')[0]
  const scopeRaw = await getScopeLabel(location_id ? Number(location_id) : null)
  const scopeLabel = sanitizeFilenamePart(scopeRaw)

  const csv = toCSV(data, [
    { label: 'Data',          getValue: r => new Date(r.sold_at).toLocaleString('ro-RO') },
    { label: 'Locatie',       getValue: r => r.locations?.name },
    { label: 'Oras',          getValue: r => r.locations?.city },
    { label: 'Produs',        getValue: r => r.products?.name },
    { label: 'SKU',           getValue: r => r.products?.sku },
    { label: 'Categorie',     getValue: r => r.products?.category },
    { label: 'Cantitate',     key: 'quantity' },
    { label: 'Pret unitar',   getValue: r => r.products?.unit_price },
    { label: 'Valoare totala',getValue: r => (r.quantity * (r.products?.unit_price ?? 0)).toFixed(2) },
  ])

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="vanzari_${days}zile_${dateStr}_${scopeLabel}.csv"`
  )
  res.send('\uFEFF' + csv)
})

// GET /api/export/movements?status=completed
router.get('/movements', async (req, res) => {
  const { status } = req.query

  let query = supabase
    .from('stock_movements')
    .select('*, products(name, sku), from:from_location_id(name, city), to:to_location_id(name, city)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const csv = toCSV(data, [
    { label: 'Data creare',     getValue: r => new Date(r.created_at).toLocaleString('ro-RO') },
    { label: 'Data finalizare', getValue: r => r.completed_at ? new Date(r.completed_at).toLocaleString('ro-RO') : '' },
    { label: 'Produs',          getValue: r => r.products?.name },
    { label: 'SKU',             getValue: r => r.products?.sku },
    { label: 'De la',           getValue: r => r.from?.name ?? 'Furnizor' },
    { label: 'Catre',           getValue: r => r.to?.name },
    { label: 'Cantitate',       key: 'quantity' },
    { label: 'Tip',             key: 'movement_type' },
    { label: 'Status',          key: 'status' },
    { label: 'Cost transport',  key: 'transport_cost' },
    { label: 'Note',            key: 'notes' },
  ])

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="miscari_stoc_${new Date().toISOString().split('T')[0]}_general.csv"`
  )
  res.send('\uFEFF' + csv)
})

// GET /api/export/summary — raport complet combinat
router.get('/summary', async (req, res) => {
  const { location_id } = req.query

  // Ia stocurile
  let stockQuery = supabase
    .from('stock')
    .select('*, products(name, sku, category, unit_price), locations(name, city)')
  if (location_id) stockQuery = stockQuery.eq('location_id', location_id)
  const { data: stocks } = await stockQuery

  // Ia vânzările din ultimele 30 zile
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  let salesQuery = supabase
    .from('sales')
    .select('location_id, product_id, quantity')
    .gte('sold_at', since30)
  if (location_id) salesQuery = salesQuery.eq('location_id', location_id)
  const { data: sales } = await salesQuery

  // Calculează vânzări per locație+produs
  const salesMap = {}
  for (const s of sales ?? []) {
    const key = `${s.location_id}-${s.product_id}`
    salesMap[key] = (salesMap[key] ?? 0) + s.quantity
  }

  const rows = (stocks ?? []).map(s => {
    const key = `${s.location_id}-${s.product_id}`
    const sold30 = salesMap[key] ?? 0
    const dailyRate = sold30 / 30
    const daysLeft = dailyRate > 0
      ? Math.floor((s.quantity - s.safety_stock) / dailyRate)
      : 999

    return {
      ...s,
      sold_30: sold30,
      daily_rate: dailyRate.toFixed(2),
      days_left: daysLeft > 999 ? '999+' : daysLeft,
      status: s.quantity <= s.safety_stock ? 'Critic'
            : s.quantity <= s.safety_stock * 2 ? 'Scazut'
            : s.quantity >= s.safety_stock * 8 ? 'Surplus'
            : 'Normal',
      stock_value: (s.quantity * (s.products?.unit_price ?? 0)).toFixed(2),
    }
  })

  const dateStr = new Date().toISOString().split('T')[0]
  const scopeRaw = await getScopeLabel(location_id ? Number(location_id) : null)
  const scopeLabel = sanitizeFilenamePart(scopeRaw)

  const csv = toCSV(rows, [
    { label: 'Locatie',           getValue: r => r.locations?.name },
    { label: 'Oras',              getValue: r => r.locations?.city },
    { label: 'Produs',            getValue: r => r.products?.name },
    { label: 'SKU',               getValue: r => r.products?.sku },
    { label: 'Categorie',         getValue: r => r.products?.category },
    { label: 'Stoc actual',       key: 'quantity' },
    { label: 'Stoc minim',        key: 'safety_stock' },
    { label: 'Status',            key: 'status' },
    { label: 'Vandut 30 zile',    key: 'sold_30' },
    { label: 'Rata zilnica',      key: 'daily_rate' },
    { label: 'Zile ramase',       key: 'days_left' },
    { label: 'Valoare stoc (RON)',key: 'stock_value' },
  ])

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="raport_complet_${dateStr}_${scopeLabel}.csv"`
  )
  res.send('\uFEFF' + csv)
})

export default router