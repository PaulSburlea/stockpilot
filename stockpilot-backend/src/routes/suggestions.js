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

// POST /api/suggestions/from-stand — cerere manuală de produse dintr-un stand
router.post('/from-stand', async (req, res) => {
  const { location_id, items } = req.body

  if (!location_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'location_id și items sunt obligatorii' })
  }

  // Găsim depozitul central (presupunem un singur rând cu type = 'warehouse')
  const { data: warehouse, error: warehouseError } = await supabase
    .from('locations')
    .select('id')
    .eq('type', 'warehouse')
    .limit(1)
    .single()

  if (warehouseError || !warehouse) {
    return res.status(500).json({ error: 'Nu s-a putut identifica depozitul central' })
  }

  const rows = items.map(item => ({
    product_id: item.product_id,
    from_location_id: warehouse.id,
    to_location_id: location_id,
    suggested_qty: item.quantity,
    reason: item.reason || 'Cerere manuală de produse din stand',
    status: 'pending',
  }))

  const { data, error } = await supabase
    .from('reorder_suggestions')
    .insert(rows)
    .select()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Creăm și mișcări de stoc pentru fiecare produs cerut,
  // astfel încât cererea să fie vizibilă în pagina "Mișcări stoc"
  const movementRows = data.map(s => ({
    product_id:       s.product_id,
    from_location_id: s.from_location_id,
    to_location_id:   s.to_location_id,
    quantity:         s.suggested_qty,
    movement_type:    'transfer',
    status:           'pending',
    notes:            `Cerere manuală din stand #${s.id}`,
  }))

  await supabase
    .from('stock_movements')
    .insert(movementRows)

  await logAction({
    user: req.user,
    action: 'CREATE',
    entity: 'suggestion',
    entityId: data?.[0]?.id,
    description: `Cerere manuală de produse din stand pentru locația ${location_id}`,
    metadata: { location_id, items },
    req,
  })

  res.status(201).json(data)
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
  const { status } = req.body  // 'approved' sau 'rejected'

  const { data, error } = await supabase
    .from('reorder_suggestions')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })

  // Dacă e aprobat, creează automat mișcarea de stoc
  if (status === 'approved') {
    await supabase.from('stock_movements').insert([{
      product_id:       data.product_id,
      from_location_id: data.from_location_id,
      to_location_id:   data.to_location_id,
      quantity:         data.suggested_qty,
      movement_type:    data.from_location_id ? 'transfer' : 'supplier_order',
      transport_cost:   data.estimated_cost,
      status:           'pending',
      notes:            `Auto-generat din sugestia #${id}`
    }])
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