import { Router } from 'express'
import supabase from '../config/supabase.js'
import { generateSuggestions } from '../services/algorithm.js'
import { logAction } from '../services/audit.js'

const router = Router()

// GET /api/suggestions — sugestiile existente
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('reorder_suggestions')
    .select('*, products(name, sku), from:from_location_id(name, city), to:to_location_id(name, city)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/suggestions/history?location_id=2&product_id=3&status=approved
router.get('/history', async (req, res) => {
  const { location_id, product_id, status, limit = 100 } = req.query

  let query = supabase
    .from('reorder_suggestions')
    .select(`
      *,
      products(name, sku, category),
      from:from_location_id(name, city),
      to:to_location_id(name, city)
    `)
    .in('status', ['approved', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(Number(limit))

  if (location_id) query = query.eq('to_location_id', location_id)
  if (product_id)  query = query.eq('product_id', product_id)
  if (status)      query = query.eq('status', status)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/suggestions/run — rulează algoritmul
router.post('/run', async (req, res) => {
  try {
    const suggestions = await generateSuggestions()
    res.json({ generated: suggestions.length, suggestions })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/suggestions/:id — aprobă sau respinge
router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { status } = req.body

  const { data, error } = await supabase
    .from('reorder_suggestions')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })

  if (status === 'approved') {
    const { data: existing } = await supabase
      .from('stock_movements')
      .select('id')
      .eq('notes', `Auto-generat din sugestia #${id}`)
      .single()

    if (!existing) {
      const { error: movErr } = await supabase.from('stock_movements').insert([{
        product_id:       data.product_id,
        from_location_id: data.from_location_id,
        to_location_id:   data.to_location_id,
        quantity:         data.suggested_qty,
        movement_type:    data.from_location_id ? 'transfer' : 'supplier_order',
        transport_cost:   data.estimated_cost,
        status:           'pending',
        notes:            `Auto-generat din sugestia #${id}`
      }])

      if (movErr) return res.status(500).json({ error: `Sugestia a fost aprobată, dar mișcarea de stoc nu a putut fi creată: ${movErr.message}` })
    }
  }

  await logAction({
    user: req.user,
    action: status === 'approved' ? 'APPROVE' : 'REJECT',
    entity: 'suggestion',
    entityId: Number(id),
    description: `Sugestie #${id} ${status === 'approved' ? 'aprobată' : 'respinsă'}: ${data.suggested_qty} buc`,
    metadata: { status, product_id: data.product_id, to_location_id: data.to_location_id },
    req,
  })

  res.json(data)
})

export default router