import { Router } from 'express'
import supabase from '../config/supabase.js'
import { logAction } from '../services/audit.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// POST /api/sales — înregistrează o vânzare
// Asta e cel mai important endpoint — scade din stoc automat
router.post('/', async (req, res) => {
  const { location_id, product_id, quantity } = req.body

  // 1. Decrementare atomică — verifică și scade stocul într-o singură operație
  const { data: decremented, error: decError } = await supabase
    .rpc('decrement_stock', {
      p_location_id: location_id,
      p_product_id: product_id,
      p_quantity: quantity,
    })

  if (decError) return res.status(500).json({ error: decError.message })

  if (!decremented) {
    // Stoc insuficient — citim cantitatea curentă pentru mesaj
    const { data: stockRow } = await supabase
      .from('stock').select('quantity')
      .eq('location_id', location_id).eq('product_id', product_id).single()

    return res.status(400).json({
      error: 'Insufficient stock',
      available: stockRow?.quantity ?? 0,
    })
  }

  // 2. Inserează vânzarea
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert([{ location_id, product_id, quantity }])
    .select()
    .single()

  if (saleError) return res.status(500).json({ error: saleError.message })

  // Citim stocul actualizat pentru log + răspuns
  const { data: updatedStock } = await supabase
    .from('stock').select('quantity')
    .eq('location_id', location_id).eq('product_id', product_id).single()

  const newStock = updatedStock?.quantity ?? 0

  await logAction({
    user: req.user,
    action: 'CREATE',
    entity: 'sale',
    entityId: sale.id,
    description: `Vânzare înregistrată: ${quantity} buc — produs ID ${product_id} la locația ID ${location_id}`,
    metadata: { product_id, location_id, quantity, new_stock: newStock },
    req,
  })

  res.status(201).json({ sale, new_stock: newStock })
})

// GET /api/sales/analytics — vânzări agregate pentru dashboard
router.get('/analytics', async (req, res) => {
  const { days = 30, location_id } = req.query
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('sales')
    .select('*, locations(name, city), products(name, category)')
    .gte('sold_at', since)

  if (location_id) query = query.eq('location_id', location_id)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Agregăm în JS — total per produs per locație
  const aggregated = data.reduce((acc, sale) => {
    const key = `${sale.location_id}-${sale.product_id}`
    if (!acc[key]) {
      acc[key] = {
        location: sale.locations,
        product: sale.products,
        total_quantity: 0,
        total_days: parseInt(days)
      }
    }
    acc[key].total_quantity += sale.quantity
    acc[key].avg_daily = +(acc[key].total_quantity / parseInt(days)).toFixed(2)
    return acc
  }, {})

  res.json(Object.values(aggregated))
})

export default router