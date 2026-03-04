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
router.get('/critical', async (req, res) => {
  const { data, error } = await supabase
    .from('stock')
    .select('*, locations(name, city), products(name, sku)')
    .filter('quantity', 'lt', supabase.raw('safety_stock * 2'))

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
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