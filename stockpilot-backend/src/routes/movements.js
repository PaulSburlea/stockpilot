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
// și actualizează stocurile. Dacă depozitul nu are stoc suficient,
// caută cel mai bun magazin alternativ.
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

  let fromLocationId = movement.from_location_id

  // Scade din sursă (depozit sau magazin alternativ)
  if (fromLocationId) {
    // Stocul curent al sursei
    const { data: fromStock } = await supabase
      .from('stock')
      .select('quantity')
      .eq('location_id', fromLocationId)
      .eq('product_id', movement.product_id)
      .single()

    const availableQty = fromStock?.quantity ?? 0

    if (availableQty < movement.quantity) {
      // Nu avem suficient stoc la sursa actuală — încercăm să găsim un magazin alternativ
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Toate stocurile pentru produsul respectiv, cu locații
      const { data: allStock } = await supabase
        .from('stock')
        .select('*, locations(id, type)')
        .eq('product_id', movement.product_id)

      const candidateStocks = (allStock ?? []).filter(
        row =>
          row.location_id !== movement.to_location_id && // să nu fie destinația
          row.quantity >= movement.quantity &&           // are cantitatea cerută
          row.locations?.type === 'stand'               // magazin / stand, nu depozit
      )

      if (!candidateStocks.length) {
        return res.status(400).json({ error: 'Stoc insuficient în depozit și niciun magazin nu are stoc suficient.' })
      }

      const candidateLocationIds = candidateStocks.map(row => row.location_id)

      // Vânzări în ultimele 30 de zile pentru produsul respectiv la toate locațiile candidate
      const { data: salesRows } = await supabase
        .from('sales')
        .select('*')
        .eq('product_id', movement.product_id)
        .in('location_id', candidateLocationIds)
        .gte('sold_at', since)

      const soldByLocation = (salesRows ?? []).reduce((acc, sale) => {
        const key = sale.location_id
        acc[key] = (acc[key] || 0) + sale.quantity
        return acc
      }, {})

      // Filtrăm doar locațiile unde vânzările din ultima lună nu depășesc stocul actual
      // și alegem pe cea cu "marja" cea mai mare (stoc - vânzări)
      let bestCandidate = null
      let bestMargin = -Infinity

      for (const row of candidateStocks) {
        const soldLast30 = soldByLocation[row.location_id] || 0
        if (soldLast30 > row.quantity) continue

        const margin = row.quantity - soldLast30
        if (margin >= movement.quantity && margin > bestMargin) {
          bestMargin = margin
          bestCandidate = row
        }
      }

      if (!bestCandidate) {
        return res.status(400).json({ error: 'Nu s-a găsit niciun magazin cu stoc suficient și vânzări reduse.' })
      }

      fromLocationId = bestCandidate.location_id
    }

    // Actualizăm stocul sursă (după ce am decis locația finală)
    const { data: finalFromStock } = await supabase
      .from('stock')
      .select('quantity')
      .eq('location_id', fromLocationId)
      .eq('product_id', movement.product_id)
      .single()

    const finalAvailable = finalFromStock?.quantity ?? 0
    if (finalAvailable < movement.quantity) {
      return res.status(400).json({ error: 'Stoc insuficient în locația sursă.' })
    }

    await supabase
      .from('stock')
      .update({ quantity: finalAvailable - movement.quantity })
      .eq('location_id', fromLocationId)
      .eq('product_id', movement.product_id)

    // Dacă am schimbat sursa, actualizăm și mișcarea
    if (fromLocationId !== movement.from_location_id) {
      await supabase
        .from('stock_movements')
        .update({ from_location_id: fromLocationId })
        .eq('id', id)
    }
  }

  // Adaugă la destinație
  const { data: toStock } = await supabase
    .from('stock')
    .select('quantity')
    .eq('location_id', movement.to_location_id)
    .eq('product_id', movement.product_id)
    .single()

  const toQty = toStock?.quantity ?? 0

  await supabase
    .from('stock')
    .update({ quantity: toQty + movement.quantity })
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
    metadata: {
      quantity: movement.quantity,
      product_id: movement.product_id,
      from_location_id: fromLocationId,
      to_location_id: movement.to_location_id,
    },
    req,
  })

  res.json(updated)
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