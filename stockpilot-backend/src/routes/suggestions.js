import { Router } from 'express'
import supabase from '../config/supabase.js'
import { generateSuggestions } from '../services/algorithm.js'
import { logAction } from '../services/audit.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// GET /api/suggestions
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('reorder_suggestions')
    .select('*, products(name, sku), from:from_location_id(name, city), to:to_location_id(name, city)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/suggestions/from-stand
router.post('/from-stand', async (req, res) => {
  try {
    const { location_id, items } = req.body

    if (!location_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'location_id și items sunt obligatorii' })
    }

    const { data: warehouse } = await supabase
      .from('locations').select('id, name').eq('type', 'warehouse').limit(1).single()

    if (!warehouse) return res.status(500).json({ error: 'Depozit negăsit' })

    const { data: transportCosts } = await supabase
      .from('transport_costs').select('*')

    const { data: allStock } = await supabase
      .from('stock')
      .select('*, locations(id, name, city, type)')

    const movementRows = []

    for (const item of items) {
      const { data: product } = await supabase
        .from('products').select('*').eq('id', item.product_id).single()

      const warehouseStock     = allStock.find(s => s.location_id === warehouse.id && s.product_id === item.product_id)
      const warehouseAvailable = warehouseStock?.quantity ?? 0
      const warehouseHasStock  = warehouseAvailable >= item.quantity

      const tcWarehouse    = transportCosts.find(t => t.from_location_id === warehouse.id && t.to_location_id === location_id)
      const warehouseCost  = tcWarehouse ? tcWarehouse.fixed_cost + (item.quantity * (product?.weight_kg ?? 0) * tcWarehouse.cost_per_kg) : null
      const warehouseLeadTime = tcWarehouse?.lead_time_days ?? 2

      const surplusStands = allStock.filter(s => {
        if (s.location_id === warehouse.id) return false
        if (s.location_id === location_id) return false
        if (s.locations?.type !== 'stand') return false
        return (s.quantity - (s.safety_stock ?? 0) - 10) >= item.quantity
      })

      let bestSurplus = null
      for (const s of surplusStands) {
        const tc = transportCosts.find(t => t.from_location_id === s.location_id && t.to_location_id === location_id)
        if (!tc) continue
        const cost = tc.fixed_cost + (item.quantity * (product?.weight_kg ?? 0) * tc.cost_per_kg)
        if (!bestSurplus || cost < bestSurplus.cost) {
          bestSurplus = { sourceId: s.location_id, sourceName: s.locations?.name, cost, leadTime: tc.lead_time_days }
        }
      }

      let recommendedSourceId = warehouse.id
      let recommendedCost     = warehouseCost
      let recommendedLeadTime = warehouseLeadTime
      let recommendationReason

      if (bestSurplus && warehouseCost !== null && bestSurplus.cost < warehouseCost * 0.85) {
        recommendedSourceId  = bestSurplus.sourceId
        recommendedCost      = bestSurplus.cost
        recommendedLeadTime  = bestSurplus.leadTime
        recommendationReason = `Transfer din ${bestSurplus.sourceName} — ${bestSurplus.cost.toFixed(2)} RON (față de ${warehouseCost.toFixed(2)} RON din depozit), ${bestSurplus.leadTime}z`
      } else if (!warehouseHasStock && bestSurplus) {
        recommendedSourceId  = bestSurplus.sourceId
        recommendedCost      = bestSurplus.cost
        recommendedLeadTime  = bestSurplus.leadTime
        recommendationReason = `Transfer din ${bestSurplus.sourceName} — depozitul nu are stoc suficient`
      } else if (warehouseHasStock) {
        recommendationReason = `Depozit central — ${warehouseCost !== null ? warehouseCost.toFixed(2) + ' RON, ' : ''}${warehouseLeadTime}z${bestSurplus ? ` (surplus la ${bestSurplus.sourceName} dar diferență nesemnificativă)` : ''}`
      } else {
        recommendedSourceId  = null
        recommendedCost      = null
        recommendedLeadTime  = null
        recommendationReason = 'Stoc insuficient în rețea — necesită comandă furnizor'
      }

      movementRows.push({
        product_id:            item.product_id,
        from_location_id:      recommendedSourceId,
        to_location_id:        location_id,
        quantity:              item.quantity,
        movement_type:         'transfer',
        status:                'pending',
        transport_cost:        recommendedCost,
        notes:                 item.reason || 'Cerere manuală din stand',
        recommendation_reason: recommendationReason,
        recommended_lead_time: recommendedLeadTime,
      })
    }

    const { data, error } = await supabase
      .from('stock_movements')
      .insert(movementRows)
      .select(`*, products(id, name, sku), from_location:from_location_id(id, name, city, type), to_location:to_location_id(id, name, city, type)`)

    if (error) return res.status(500).json({ error: error.message })

    await logAction({
      user: req.user, action: 'CREATE', entity: 'movement', entityId: data?.[0]?.id,
      description: `Cerere manuală stand ID ${location_id}: ${items.length} produs(e) solicitat(e)`,
      metadata: { location_id, items }, req,
    })

    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/suggestions/history
router.get('/history', async (req, res) => {
  const { location_id, product_id, status, limit = 100 } = req.query

  let query = supabase
    .from('reorder_suggestions')
    .select(`*, products(name, sku, category), from:from_location_id(name, city), to:to_location_id(name, city)`)
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

// POST /api/suggestions/run
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
  try {
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
        .maybeSingle()

      if (!existing) {
        let movementStatus = 'pending'
        let movementType   = 'transfer'
        let acceptedAt     = null

        if (!data.from_location_id) {
          movementType   = 'supplier_order'
          movementStatus = 'pending'
        } else {
          const { data: sourceLocation } = await supabase
            .from('locations')
            .select('type')
            .eq('id', data.from_location_id)
            .single()

          if (sourceLocation?.type === 'stand') {
            // FIX: verifică că standul sursă are stoc suficient înainte de awaiting_pickup
            const { data: sourceStock } = await supabase
              .from('stock')
              .select('quantity')
              .eq('location_id', data.from_location_id)
              .eq('product_id', data.product_id)
              .single()

            const available = sourceStock?.quantity ?? 0

            if (available >= data.suggested_qty) {
              // Stoc disponibil → direct awaiting_pickup
              movementStatus = 'awaiting_pickup'
              acceptedAt     = new Date().toISOString()
            }
            // Altfel rămâne pending → warehouse va gestiona manual
          }
          // Depozit → rămâne pending, warehouse apasă "Acceptă & Expediază"
        }

        const { error: movErr } = await supabase
          .from('stock_movements')
          .insert([{
            product_id:       data.product_id,
            from_location_id: data.from_location_id,
            to_location_id:   data.to_location_id,
            quantity:         data.suggested_qty,
            movement_type:    movementType,
            transport_cost:   data.estimated_cost,
            status:           movementStatus,
            accepted_at:      acceptedAt,
            notes:            `Auto-generat din sugestia #${id}`,
          }])

        if (movErr) {
          return res.status(500).json({
            error: `Sugestia a fost aprobată, dar mișcarea nu a putut fi creată: ${movErr.message}`
          })
        }
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
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router