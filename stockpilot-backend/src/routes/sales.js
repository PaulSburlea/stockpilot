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

  // 1. Verifică că există suficient stoc
  const { data: stockRow, error: stockError } = await supabase
    .from('stock')
    .select('*')
    .eq('location_id', location_id)
    .eq('product_id', product_id)
    .single()

  if (stockError || !stockRow) {
    return res.status(404).json({ error: 'Stock record not found' })
  }

  if (stockRow.quantity < quantity) {
    return res.status(400).json({ 
      error: 'Insufficient stock',
      available: stockRow.quantity 
    })
  }

  // 2. Inserează vânzarea
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert([{ location_id, product_id, quantity }])
    .select()
    .single()

  if (saleError) return res.status(500).json({ error: saleError.message })

  // 3. Scade din stoc
  const { error: updateError } = await supabase
    .from('stock')
    .update({ 
      quantity: stockRow.quantity - quantity,
      updated_at: new Date()
    })
    .eq('id', stockRow.id)

  if (updateError) return res.status(500).json({ error: updateError.message })

  await logAction({
    user: req.user,
    action: 'CREATE',
    entity: 'sale',
    entityId: sale.id,
    description: `Vânzare înregistrată: ${quantity} buc — produs ID ${product_id} la locația ID ${location_id}`,
    metadata: { product_id, location_id, quantity, new_stock: stockRow.quantity - quantity },
    req,
  })

  res.status(201).json({ sale, new_stock: stockRow.quantity - quantity })
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