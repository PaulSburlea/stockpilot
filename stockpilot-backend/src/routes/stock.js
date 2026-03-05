import { Router } from 'express'
import supabase from '../config/supabase.js'

const router = Router()

// GET /api/stock — toate stocurile
// Query params opționali: ?location_id=2&product_id=5
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

// GET /api/stock/critical — stocuri sub safety stock * 2
// Notă: supabase-js nu suportă expresii raw aici, așa că filtrăm în JS
router.get('/critical', async (req, res) => {
  const { data, error } = await supabase
    .from('stock')
    .select('*, locations(name, city), products(name, sku)')

  if (error) return res.status(500).json({ error: error.message })

  const result = (data ?? []).filter(row => row.quantity < row.safety_stock * 2)
  res.json(result)
})

// GET /api/stock/critical-for-stand?location_id=2
// Returnează stocurile critice pentru un stand + vânzări ultima lună
router.get('/critical-for-stand', async (req, res) => {
  const { location_id } = req.query

  if (!location_id) {
    return res.status(400).json({ error: 'location_id este obligatoriu' })
  }

  // 1. Stocuri critice sau scăzute pentru locația respectivă
  const { data: stockRows, error: stockError } = await supabase
    .from('stock')
    .select('*, locations(name, city), products(name, sku)')
    .eq('location_id', location_id)

  // Dacă interogarea de stoc eșuează, returnăm listă goală
  if (stockError) {
    console.error('critical-for-stand stock error', stockError)
    return res.json([])
  }

  if (!stockRows || stockRows.length === 0) {
    return res.json([])
  }

  // Păstrăm doar stocurile critice sau scăzute (<= safety_stock * 2)
  const filteredStock = stockRows.filter(
    row => row.quantity <= row.safety_stock * 2
  )

  if (filteredStock.length === 0) {
    return res.json([])
  }

  const productIds = filteredStock.map(row => row.product_id)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 2. Vânzări în ultima lună pentru aceste produse în acel stand
  const { data: salesRows, error: salesError } = await supabase
    .from('sales')
    .select('*')
    .eq('location_id', location_id)
    .in('product_id', productIds)
    .gte('sold_at', since)

  // Dacă interogarea de vânzări eșuează, considerăm vânzări 0 (minim = 10)
  if (salesError) {
    console.error('critical-for-stand sales error', salesError)
  }

  const soldByProduct = (salesRows ?? []).reduce((acc, sale) => {
    const key = sale.product_id
    acc[key] = (acc[key] || 0) + sale.quantity
    return acc
  }, {})

  const result = filteredStock.map(row => {
    const soldLast30Days = soldByProduct[row.product_id] || 0
    const isCritical = row.quantity <= row.safety_stock
    const extra = isCritical ? 10 : 5
    const minRequestQty = soldLast30Days + extra
    return {
      ...row,
      sold_last_30_days: soldLast30Days,
      min_request_qty: minRequestQty,
    }
  })

  res.json(result)
})

// PATCH /api/stock/:id — actualizează cantitate (ex: ajustare manuală)
router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { quantity } = req.body

  const { data, error } = await supabase
    .from('stock')
    .update({ quantity, updated_at: new Date() })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

export default router