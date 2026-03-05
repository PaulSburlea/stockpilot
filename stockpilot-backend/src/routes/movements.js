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
  if (location_id) {
    // doar mișcări unde locația este sursă sau destinație
    query = query.or(
      `from_location_id.eq.${location_id},to_location_id.eq.${location_id}`
    )
  }

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

// GET /api/movements/:id/options — opțiuni de sursă dacă depozitul nu are stoc
router.get('/:id/options', async (req, res) => {
  const { id } = req.params

  const { data: movement, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('id', id)
    .single()

  if (error || movement.status !== 'pending') {
    return res.status(400).json({ error: 'Invalid movement' })
  }

  const sourceId = movement.from_location_id
  if (!sourceId) {
    return res.status(400).json({ error: 'Mișcarea nu are locație sursă setată.' })
  }

  // Verificăm stocul în sursa actuală (depozit)
  const { data: sourceStock } = await supabase
    .from('stock')
    .select('quantity')
    .eq('location_id', sourceId)
    .eq('product_id', movement.product_id)
    .single()

  const availableAtSource = sourceStock?.quantity ?? 0

  if (availableAtSource >= movement.quantity) {
    // Depozitul poate onora cererea, nu avem nevoie de alte opțiuni
    return res.json({
      can_fulfil_from_source: true,
      candidates: [],
    })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Toate stocurile pentru produsul respectiv, cu locații
  const { data: allStock } = await supabase
    .from('stock')
    .select('quantity, location_id, locations(id, name, city, type)')
    .eq('product_id', movement.product_id)

  const candidateStocks = (allStock ?? []).filter(
    row =>
      row.location_id !== movement.to_location_id && // să nu fie destinația
      row.quantity > 0 &&                            // are măcar ceva stoc
      row.locations?.type === 'stand'               // magazin / stand, nu depozit
  )

  const candidateLocationIds = candidateStocks.map(row => row.location_id)

  // Vânzări în ultimele 30 de zile pentru produsul respectiv la toate locațiile candidate
  const { data: salesRows } = await supabase
    .from('sales')
    .select('location_id, quantity')
    .eq('product_id', movement.product_id)
    .in('location_id', candidateLocationIds)
    .gte('sold_at', since)

  const soldByLocation = (salesRows ?? []).reduce((acc, sale) => {
    const key = sale.location_id
    acc[key] = (acc[key] || 0) + sale.quantity
    return acc
  }, {})

  const candidates = candidateStocks
    .map(row => {
      const soldLast30 = soldByLocation[row.location_id] || 0
      const margin = row.quantity - soldLast30
      return {
        location_id: row.location_id,
        location_name: row.locations?.name,
        city: row.locations?.city,
        available_qty: row.quantity,
        sold_last_30_days: soldLast30,
        margin,
      }
    })
    .filter(c => c.sold_last_30_days <= c.available_qty && c.margin > 0)
    .sort((a, b) => b.margin - a.margin)

  return res.json({
    can_fulfil_from_source: false,
    candidates,
  })
})

// PATCH /api/movements/:id/complete — marchează transferul ca finalizat
// și actualizează stocurile. Poate primi opțional `source_location_id`.
router.patch('/:id/complete', async (req, res) => {
  const { id } = req.params
  const { source_location_id } = req.body || {}

  const { data: movement, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('id', id)
    .single()

  if (error || movement.status !== 'pending') {
    return res.status(400).json({ error: 'Invalid movement' })
  }

  // Determinăm sursa: parametru explicit sau cea de pe mișcare
  const fromLocationId = source_location_id || movement.from_location_id

  if (!fromLocationId) {
    return res.status(400).json({ error: 'Mișcarea nu are locație sursă.' })
  }

  // 1. Verificăm și actualizăm stocul sursă
  const { data: fromStock } = await supabase
    .from('stock')
    .select('quantity')
    .eq('location_id', fromLocationId)
    .eq('product_id', movement.product_id)
    .single()

  const available = fromStock?.quantity ?? 0

  // Cantitatea efectiv transferată este cantitatea cerută,
  // limitată doar de stocul disponibil în locația sursă.
  const transferQty = Math.min(movement.quantity, available)

  if (transferQty <= 0) {
    return res.status(400).json({ error: 'Stoc insuficient în locația sursă aleasă pentru a trimite în siguranță.' })
  }

  await supabase
    .from('stock')
    .update({ quantity: available - transferQty })
    .eq('location_id', fromLocationId)
    .eq('product_id', movement.product_id)

  // 2. Adăugăm la destinație
  const { data: toStock } = await supabase
    .from('stock')
    .select('quantity')
    .eq('location_id', movement.to_location_id)
    .eq('product_id', movement.product_id)
    .single()

  const toQty = toStock?.quantity ?? 0

  await supabase
    .from('stock')
    .update({ quantity: toQty + transferQty })
    .eq('location_id', movement.to_location_id)
    .eq('product_id', movement.product_id)

  // 3. Actualizăm mișcarea (status + eventual noua sursă)
  const { data: updated } = await supabase
    .from('stock_movements')
    .update({
      status: 'completed',
      completed_at: new Date(),
      quantity: transferQty,
      from_location_id: fromLocationId,
    })
    .eq('id', id)
    .select()
    .single()

  await logAction({
    user: req.user,
    action: 'TRANSFER_COMPLETE',
    entity: 'movement',
    entityId: Number(id),
    description: `Transfer finalizat: ${movement.quantity} buc — produs ID ${movement.product_id}`,
    metadata: {
      quantity: transferQty,
      product_id: movement.product_id,
      from_location_id: fromLocationId,
      to_location_id: movement.to_location_id,
    },
    req,
  })

  res.json(updated)
})

// POST /api/movements/:id/forward — creează o nouă cerere de la un magazin sursă către destinație,
// pe baza unei cereri existente, fără a mișca efectiv stocul încă.
router.post('/:id/forward', async (req, res) => {
  const { id } = req.params
  const { source_location_id, requested_qty } = req.body || {}

  if (!source_location_id) {
    return res.status(400).json({ error: 'source_location_id este obligatoriu' })
  }

  const { data: movement, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('id', id)
    .single()

  if (error || movement.status !== 'pending') {
    return res.status(400).json({ error: 'Mișcare invalidă pentru redirectare' })
  }

  // Verificăm stocul în magazinul sursă propus
  const { data: fromStock } = await supabase
    .from('stock')
    .select('quantity')
    .eq('location_id', source_location_id)
    .eq('product_id', movement.product_id)
    .single()

  const available = fromStock?.quantity ?? 0
  if (available <= 0) {
    return res.status(400).json({ error: 'Magazinul sursă nu are stoc disponibil.' })
  }

  // Calculăm cantitatea propusă:
  // - utilizăm ce a ales utilizatorul în fereastră (requested_qty)
  // - dar nu mai mult decât: cererea inițială și stocul disponibil
  const requested = Number(requested_qty) && Number(requested_qty) > 0
    ? Number(requested_qty)
    : movement.quantity

  const proposedQty = Math.max(
    1,
    Math.min(requested, movement.quantity, available)
  )

  // Creăm o nouă mișcare de tip "cerere" între magazinul sursă și destinație
  const { data: newMovement, error: insertError } = await supabase
    .from('stock_movements')
    .insert([{
      product_id:       movement.product_id,
      from_location_id: source_location_id,
      to_location_id:   movement.to_location_id,
      quantity:         proposedQty,
      movement_type:    'transfer',
      status:           'pending',
      notes:            `Cerere redirecționată din mișcarea #${movement.id}`,
    }])
    .select()
    .single()

  if (insertError) {
    return res.status(500).json({ error: insertError.message })
  }

  // Marcam mișcarea inițială ca "anulată" (depozitul nu a putut onora cererea direct)
  await supabase
    .from('stock_movements')
    .update({ status: 'cancelled', notes: 'Cerere redirecționată către alt magazin' })
    .eq('id', id)

  await logAction({
    user: req.user,
    action: 'FORWARD',
    entity: 'movement',
    entityId: Number(newMovement.id),
    description: `Cerere redirecționată către magazinul ${source_location_id} pentru ${proposedQty} buc — produs ID ${movement.product_id}`,
    metadata: {
      original_movement_id: movement.id,
      new_movement_id: newMovement.id,
      product_id: movement.product_id,
      from_location_id: source_location_id,
      to_location_id: movement.to_location_id,
      proposed_qty: proposedQty,
    },
    req,
  })

  res.status(201).json(newMovement)
})

// PATCH /api/movements/:id/cancel — respinge cererea / mișcarea
router.patch('/:id/cancel', async (req, res) => {
  const { id } = req.params

  const { data: movement, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('id', id)
    .single()

  if (error || movement.status !== 'pending') {
    return res.status(400).json({ error: 'Doar mișcările în așteptare pot fi respinse.' })
  }

  const { data: updated, error: updateError } = await supabase
    .from('stock_movements')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return res.status(400).json({ error: updateError.message })
  }

  await logAction({
    user: req.user,
    action: 'CANCEL',
    entity: 'movement',
    entityId: Number(id),
    description: `Mișcare stoc respinsă: ${movement.quantity} buc — produs ID ${movement.product_id}`,
    metadata: { quantity: movement.quantity, product_id: movement.product_id },
    req,
  })

  res.json(updated)
})

export default router