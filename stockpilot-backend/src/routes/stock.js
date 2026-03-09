import { Router } from 'express'
import supabase from '../config/supabase.js'
import { logAction } from '../services/audit.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// GET /api/stock
router.get('/', async (req, res) => {
  const { location_id, product_id } = req.query

  let query = supabase
    .from('stock')
    .select('*, locations(name, city, type), products(name, sku, category, unit_price)')

  if (location_id) query = query.eq('location_id', location_id)
  if (product_id)  query = query.eq('product_id', product_id)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/stock/critical
router.get('/critical', async (req, res) => {
  const { data, error } = await supabase
    .from('stock')
    .select('*, locations(name, city), products(name, sku)')

  if (error) return res.status(500).json({ error: error.message })

  const critical = data.filter(s => s.quantity <= s.safety_stock)
  res.json(critical)
})

// GET /api/stock/critical-for-stand?location_id=2
router.get('/critical-for-stand', async (req, res) => {
  const { location_id } = req.query
  if (!location_id) {
    return res.status(400).json({ error: 'location_id este obligatoriu' })
  }

  const { data: stockRows, error: stockError } = await supabase
    .from('stock')
    .select('*, locations(name, city), products(name, sku)')
    .eq('location_id', location_id)

  if (stockError) {
    console.error('critical-for-stand stock error', stockError)
    return res.json([])
  }
  if (!stockRows || stockRows.length === 0) return res.json([])

  const filteredStock = stockRows.filter(
    row => row.quantity <= row.safety_stock * 2 && row.quantity > 0
  )
  if (filteredStock.length === 0) return res.json([])

  const productIds = filteredStock.map(row => row.product_id)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: salesRows, error: salesError } = await supabase
    .from('sales')
    .select('*')
    .eq('location_id', location_id)
    .in('product_id', productIds)
    .gte('sold_at', since)

  if (salesError) console.error('critical-for-stand sales error', salesError)

  const soldByProduct = (salesRows ?? []).reduce((acc, sale) => {
    acc[sale.product_id] = (acc[sale.product_id] || 0) + sale.quantity
    return acc
  }, {})

  const result = filteredStock.map(row => {
    const soldLast30Days = soldByProduct[row.product_id] || 0
    const isCritical = row.quantity <= row.safety_stock

    const baseQty = soldLast30Days > 0
      ? Math.ceil(soldLast30Days * 1.5)
      : row.safety_stock * 3

    const urgencyBonus = isCritical ? row.safety_stock : 0
    const min_request_qty = Math.max(baseQty + urgencyBonus, row.safety_stock * 2)

    return { ...row, sold_last_30_days: soldLast30Days, min_request_qty }
  })

  res.json(result)
})

// PATCH /api/stock/:id — ajustare manuală cantitate
router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { quantity } = req.body

  const { data: current } = await supabase
    .from('stock')
    .select('quantity, product_id, location_id, products(name), locations(name)')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('stock')
    .update({ quantity, updated_at: new Date() })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })

  const oldQty = current?.quantity ?? '?'
  const diff   = typeof oldQty === 'number' ? quantity - oldQty : '?'
  const sign   = typeof diff === 'number' && diff >= 0 ? '+' : ''

  await logAction({
    user: req.user, action: 'UPDATE', entity: 'stock', entityId: Number(id),
    description: `Stoc ajustat manual: ${current?.products?.name ?? `produs #${data.product_id}`} la ${current?.locations?.name ?? `locația #${data.location_id}`} — ${oldQty} → ${quantity} (${sign}${diff})`,
    metadata: { product_id: data.product_id, location_id: data.location_id, old_quantity: oldQty, new_quantity: quantity, delta: diff },
    req,
  })

  res.json(data)
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper: construiește lastSaleMap pentru o listă de rânduri de stoc
// Returnează { "locationId-productId": "ISO date" | null }
// ─────────────────────────────────────────────────────────────────────────────
async function buildLastSaleMap(stockRows) {
  if (!stockRows?.length) return {}

  // Colectăm perechi unice (location_id, product_id)
  const pairs = stockRows.map(r => `${r.location_id}-${r.product_id}`)

  // Fetch toate vânzările pentru produsele implicate (fără filtru pe location — e mai simplu)
  const productIds  = [...new Set(stockRows.map(r => r.product_id))]
  const locationIds = [...new Set(stockRows.map(r => r.location_id))]

  const { data: sales } = await supabase
    .from('sales')
    .select('location_id, product_id, sold_at')
    .in('product_id', productIds)
    .in('location_id', locationIds)
    .order('sold_at', { ascending: false })

  const map = {}
  for (const sale of sales ?? []) {
    const key = `${sale.location_id}-${sale.product_id}`
    if (!map[key]) map[key] = sale.sold_at
  }

  return map
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stock/stale-for-stand?location_id=2
// Stoc mort = a fost vândut cândva, dar ultima vânzare e mai veche decât pragul
// EXCLUDE produsele niciodată vândute (acelea sunt "fără tracțiune")
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stale-for-stand', async (req, res) => {
  try {
    const locationId = Number(req.query.location_id)
    if (!locationId) return res.status(400).json({ error: 'location_id obligatoriu' })

    const { data: settings } = await supabase
      .from('location_settings')
      .select('stale_days_threshold')
      .eq('location_id', locationId)
      .maybeSingle()

    const threshold = settings?.stale_days_threshold ?? 60

    const { data: stockRows, error } = await supabase
      .from('stock')
      .select('*, products(name, sku, category)')
      .eq('location_id', locationId)
      .gt('quantity', 0)

    if (error) return res.status(500).json({ error: error.message })
    if (!stockRows?.length) return res.json({ stale_threshold_days: threshold, items: [] })

    const lastSaleMap = await buildLastSaleMap(stockRows)
    const now = Date.now()

    const stale = stockRows
      .filter(row => row.quantity > (row.safety_stock ?? 0))
      .map(row => {
        const lastSale = lastSaleMap[`${row.location_id}-${row.product_id}`]
        const daysSince = lastSale
          ? Math.floor((now - new Date(lastSale).getTime()) / 86400000)
          : null  // null = niciodată vândut
        return { ...row, days_since_last_sale: daysSince, last_sale_at: lastSale ?? null }
      })
      // Stoc mort = a fost vândut (lastSale există) dar a trecut mai mult decât pragul
      .filter(row => row.days_since_last_sale !== null && row.days_since_last_sale >= threshold)
      .sort((a, b) => b.days_since_last_sale - a.days_since_last_sale)

    res.json({ stale_threshold_days: threshold, items: stale })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stock/stale-network
// Stoc mort în toată rețeaua — exclude produsele niciodată vândute
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stale-network', async (req, res) => {
  try {
    const { data: allSettings } = await supabase
      .from('location_settings').select('location_id, stale_days_threshold')

    const { data: stockRows, error } = await supabase
      .from('stock')
      .select('*, products(name, sku, category), locations(name, city, type)')
      .gt('quantity', 0)

    if (error) return res.status(500).json({ error: error.message })
    if (!stockRows?.length) return res.json([])

    // Doar standuri
    const standRows = stockRows.filter(row => row.locations?.type === 'stand')
    if (!standRows.length) return res.json([])

    const lastSaleMap = await buildLastSaleMap(standRows)
    const now = Date.now()

    const stale = standRows
      .filter(row => row.quantity > (row.safety_stock ?? 0))
      .map(row => {
        const threshold = allSettings?.find(s => s.location_id === row.location_id)?.stale_days_threshold ?? 60
        const lastSale  = lastSaleMap[`${row.location_id}-${row.product_id}`]
        const daysSince = lastSale
          ? Math.floor((now - new Date(lastSale).getTime()) / 86400000)
          : null  // null = niciodată vândut
        return { ...row, days_since_last_sale: daysSince, last_sale_at: lastSale ?? null, stale_threshold: threshold }
      })
      // Stoc mort = a fost vândut cândva, dar a stagnat peste prag
      .filter(row => row.days_since_last_sale !== null && row.days_since_last_sale >= row.stale_threshold)
      .sort((a, b) => b.days_since_last_sale - a.days_since_last_sale)

    res.json(stale)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stock/no-traction-network
// Stoc fără tracțiune = produse cu stoc > safety_stock care NU au fost
// niciodată vândute la acel stand. Candidați pentru returnare la depozit.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/no-traction-network', async (req, res) => {
  try {
    const { data: stockRows, error } = await supabase
      .from('stock')
      .select('*, products(name, sku, category, unit_price), locations(name, city, type)')
      .gt('quantity', 0)

    if (error) return res.status(500).json({ error: error.message })
    if (!stockRows?.length) return res.json([])

    const standRows = stockRows.filter(row => row.locations?.type === 'stand')
    if (!standRows.length) return res.json([])

    const lastSaleMap = await buildLastSaleMap(standRows)

    // Stoc adăugat la stand (din movements) — pentru a calcula de când e acolo
    const productIds  = [...new Set(standRows.map(r => r.product_id))]
    const locationIds = [...new Set(standRows.map(r => r.location_id))]

    const { data: movements } = await supabase
      .from('stock_movements')
      .select('product_id, to_location_id, completed_at, created_at')
      .in('product_id', productIds)
      .in('to_location_id', locationIds)
      .eq('status', 'completed')
      .order('completed_at', { ascending: true })

    // Prima dată când produsul a ajuns la stand
    const firstArrivalMap = {}
    for (const m of movements ?? []) {
      const key = `${m.to_location_id}-${m.product_id}`
      if (!firstArrivalMap[key]) {
        firstArrivalMap[key] = m.completed_at ?? m.created_at
      }
    }

    const now = Date.now()

    const noTraction = standRows
      .filter(row => row.quantity > (row.safety_stock ?? 0))
      .map(row => {
        const key      = `${row.location_id}-${row.product_id}`
        const lastSale = lastSaleMap[key]

        // Doar produse niciodată vândute la standul ăsta
        if (lastSale) return null

        const firstArrival = firstArrivalMap[key]
        const daysAtStand  = firstArrival
          ? Math.floor((now - new Date(firstArrival).getTime()) / 86400000)
          : null

        return {
          ...row,
          days_since_last_sale: null,
          last_sale_at: null,
          first_arrival_at: firstArrival ?? null,
          days_at_stand: daysAtStand,
        }
      })
      .filter(Boolean)
      // Ordonăm după valoare imobilizată (qty × unit_price) descrescător
      .sort((a, b) => {
        const aVal = a.quantity * (a.products?.unit_price ?? 0)
        const bVal = b.quantity * (b.products?.unit_price ?? 0)
        return bVal - aVal
      })

    res.json(noTraction)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router