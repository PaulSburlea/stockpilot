import { Router } from 'express'
import supabase from '../config/supabase.js'
import { logAction } from '../services/audit.js'

const router = Router()

// GET /api/movements — istoric mișcări
router.get('/', async (req, res) => {
  const { status, location_id } = req.query

  let query = supabase
    .from('stock_movements')
    .select('*, products(name, sku), from:from_location_id(name, city), to:to_location_id(name, city)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/movements — creează un transfer
router.post('/', async (req, res) => {
  const { product_id, from_location_id, to_location_id, quantity, movement_type, notes } = req.body

  // Calculează costul de transport
  const { data: tc } = await supabase
    .from('transport_costs')
    .select('*, products:product_id(weight_kg)')
    .eq('from_location_id', from_location_id)
    .eq('to_location_id', to_location_id)
    .single()

  const { data: product } = await supabase
    .from('products')
    .select('weight_kg')
    .eq('id', product_id)
    .single()

  const transport_cost = tc 
    ? tc.fixed_cost + (quantity * (product?.weight_kg || 0) * tc.cost_per_kg)
    : null

  const { data, error } = await supabase
    .from('stock_movements')
    .insert([{
      product_id, from_location_id, to_location_id,
      quantity, movement_type, notes, transport_cost,
      status: 'pending'
    }])
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  await logAction({
    user: req.user,
    action: 'CREATE',
    entity: 'movement',
    entityId: data.id,
    description: `Mișcare stoc creată: ${data.quantity} buc, tip ${data.movement_type}`,
    metadata: { movement_type: data.movement_type, quantity: data.quantity },
    req,
  })
  res.status(201).json(data)
})

// PATCH /api/movements/:id/complete — marchează transferul ca finalizat
// și actualizează stocurile
router.patch('/:id/complete', async (req, res) => {
  const { id } = req.params

  const { data: movement, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('id', id)
    .single()

  if (error || movement.status !== 'pending') {
    return res.status(400).json({ error: 'Invalid movement' })
  }

  // Scade din sursa
  if (movement.from_location_id) {
    const { data: fromStock } = await supabase
      .from('stock')
      .select('quantity')
      .eq('location_id', movement.from_location_id)
      .eq('product_id', movement.product_id)
      .single()

    await supabase
      .from('stock')
      .update({ quantity: fromStock.quantity - movement.quantity })
      .eq('location_id', movement.from_location_id)
      .eq('product_id', movement.product_id)
  }

  // Adaugă la destinație
  const { data: toStock } = await supabase
    .from('stock')
    .select('quantity')
    .eq('location_id', movement.to_location_id)
    .eq('product_id', movement.product_id)
    .single()

  await supabase
    .from('stock')
    .update({ quantity: toStock.quantity + movement.quantity })
    .eq('location_id', movement.to_location_id)
    .eq('product_id', movement.product_id)

  // Marchează ca finalizat
  const { data: updated } = await supabase
    .from('stock_movements')
    .update({ status: 'completed', completed_at: new Date() })
    .eq('id', id)
    .select()
    .single()

  await logAction({
    user: req.user,
    action: 'TRANSFER_COMPLETE',
    entity: 'movement',
    entityId: Number(id),
    description: `Transfer finalizat: ${movement.quantity} buc — produs ID ${movement.product_id}`,
    metadata: { quantity: movement.quantity, product_id: movement.product_id },
    req,
  })

  res.json(updated)
})

export default router