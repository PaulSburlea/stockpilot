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
    .select('*, locations(name, city, type), products(name, sku, category)')

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

  const critical = data.filter(s => s.quantity <= s.safety_stock && s.quantity > 0)
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

    const min_request_qty = Math.max(
      baseQty + urgencyBonus,
      row.safety_stock * 2
    )

    return {
      ...row,
      sold_last_30_days: soldLast30Days,
      min_request_qty,
    }
  })

  res.json(result)
})

// PATCH /api/stock/:id — ajustare manuală cantitate
router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { quantity } = req.body

  // Fetch stocul curent pentru a loga diferența
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
    user: req.user,
    action: 'UPDATE',
    entity: 'stock',
    entityId: Number(id),
    description: `Stoc ajustat manual: ${current?.products?.name ?? `produs #${data.product_id}`} la ${current?.locations?.name ?? `locația #${data.location_id}`} — ${oldQty} → ${quantity} (${sign}${diff})`,
    metadata: {
      product_id:   data.product_id,
      location_id:  data.location_id,
      old_quantity: oldQty,
      new_quantity: quantity,
      delta:        diff,
    },
    req,
  })

  res.json(data)
})

// GET /api/stock/stale-for-stand?location_id=2
router.get('/stale-for-stand', async (req, res) => {
  const { location_id } = req.query
  if (!location_id) return res.status(400).json({ error: 'location_id obligatoriu' })

  const { data: settings } = await supabase
    .from('location_settings')
    .select('stale_days_threshold')
    .eq('location_id', location_id)
    .maybeSingle()

  const staleThreshold = settings?.stale_days_threshold ?? 60

  const { data: stockRows, error } = await supabase
    .from('stock')
    .select('*, products(name, sku, category)')
    .eq('location_id', location_id)
    .gt('quantity', 0)

  if (error) return res.status(500).json({ error: error.message })
  if (!stockRows?.length) return res.json([])

  const productIds = stockRows.map(r => r.product_id)

  const { data: lastSales } = await supabase
    .from('sales')
    .select('product_id, sold_at')
    .eq('location_id', location_id)
    .in('product_id', productIds)
    .order('sold_at', { ascending: false })

  const lastSaleMap = {}
  for (const sale of lastSales ?? []) {
    if (!lastSaleMap[sale.product_id]) {
      lastSaleMap[sale.product_id] = sale.sold_at
    }
  }

  const now = Date.now()
  const stale = stockRows
    .map(row => {
      const lastSale = lastSaleMap[row.product_id]
      const daysSinceLastSale = lastSale
        ? Math.floor((now - new Date(lastSale).getTime()) / 86400000)
        : 9999
      return { ...row, days_since_last_sale: daysSinceLastSale, last_sale_at: lastSale ?? null }
    })
    .filter(row =>
      row.days_since_last_sale >= staleThreshold &&
      row.quantity > (row.safety_stock ?? 0)
    )
    .sort((a, b) => b.days_since_last_sale - a.days_since_last_sale)

  res.json({ stale_threshold_days: staleThreshold, items: stale })
})

// GET /api/stock/stale-network — stoc mort în toată rețeaua (admin)
router.get('/stale-network', async (req, res) => {
  const { data: allSettings } = await supabase
    .from('location_settings').select('location_id, stale_days_threshold')

  const { data: stockRows, error } = await supabase
    .from('stock')
    .select('*, products(name, sku, category), locations(name, city, type)')
    .eq('locations.type', 'stand')
    .gt('quantity', 0)

  if (error) return res.status(500).json({ error: error.message })
  if (!stockRows?.length) return res.json([])

  const { data: lastSales } = await supabase
    .from('sales')
    .select('location_id, product_id, sold_at')
    .order('sold_at', { ascending: false })

  const lastSaleMap = {}
  for (const sale of lastSales ?? []) {
    const key = `${sale.location_id}-${sale.product_id}`
    if (!lastSaleMap[key]) lastSaleMap[key] = sale.sold_at
  }

  const now = Date.now()

  const stale = stockRows
    .filter(row => row.locations?.type === 'stand')
    .map(row => {
      const threshold = allSettings?.find(s => s.location_id === row.location_id)?.stale_days_threshold ?? 60
      const lastSale  = lastSaleMap[`${row.location_id}-${row.product_id}`]
      const days      = lastSale
        ? Math.floor((now - new Date(lastSale).getTime()) / 86400000)
        : 9999
      return { ...row, days_since_last_sale: days, last_sale_at: lastSale ?? null, stale_threshold: threshold }
    })
    .filter(row =>
      row.days_since_last_sale >= row.stale_threshold &&
      row.quantity > (row.safety_stock ?? 0)
    )
    .sort((a, b) => b.days_since_last_sale - a.days_since_last_sale)

  res.json(stale)
})

export default router