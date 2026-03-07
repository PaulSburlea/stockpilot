import { Router } from 'express'
import supabase from '../config/supabase.js'
import { logAction } from '../services/audit.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

// Autentificare pe toate rutele
router.use(authenticate)

// ─────────────────────────────────────────────
// GET /api/movements
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, location_id } = req.query

    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        products (id, name, sku, weight_kg),
        from_location:from_location_id (id, name, city, type),
        to_location:to_location_id (id, name, city, type)
      `)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    // Stand manager vede doar mișcările care îl implică
    if (req.user.role === 'stand_manager') {
      query = query.or(
        `from_location_id.eq.${req.user.location_id},to_location_id.eq.${req.user.location_id}`
      )
    } else if (location_id) {
      query = query.or(
        `from_location_id.eq.${location_id},to_location_id.eq.${location_id}`
      )
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/movements
// Creare mișcare manuală (admin/warehouse)
router.post('/', authorize('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const { product_id, from_location_id, to_location_id, quantity, movement_type, notes } = req.body

    if (!product_id || !to_location_id || !quantity || !movement_type) {
      return res.status(400).json({ error: 'Câmpuri obligatorii lipsă' })
    }

    // ── FIX: supplier_order creat manual → direct in_transit ──────────────────
    // Warehouse-ul care creează comanda = aprobare implicită.
    // Nu are sens să stea pending și să apară butonul "Comandă furnizor" pe ea.
    const initialStatus = movement_type === 'supplier_order' ? 'in_transit' : 'pending'

    const { data, error } = await supabase
      .from('stock_movements')
      .insert([{
        product_id,
        from_location_id: from_location_id ?? null,
        to_location_id,
        quantity,
        movement_type,
        notes,
        status: initialStatus,
        // Dacă e in_transit din start, marchăm accepted_at acum
        accepted_at: initialStatus === 'in_transit' ? new Date().toISOString() : null,
      }])
      .select(`
        *,
        products (id, name, sku, weight_kg),
        from_location:from_location_id (id, name, city, type),
        to_location:to_location_id (id, name, city, type)
      `)
      .single()

    if (error) return res.status(500).json({ error: error.message })

    await logAction({
      user: req.user,
      action: 'CREATE',
      entity: 'movement',
      entityId: data.id,
      description: `Mișcare creată manual (${movement_type}): ${quantity} buc produs ${product_id} → status inițial: ${initialStatus}`,
      metadata: { from_location_id, to_location_id, quantity, movement_type, initial_status: initialStatus },
      req,
    })

    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// POST /api/movements/:id/order-from-supplier
// Warehouse decide să comande de la furnizor când rețeaua nu are stoc
router.post('/:id/order-from-supplier', authorize('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const { id } = req.params

    const { data: movement } = await supabase
      .from('stock_movements').select('*').eq('id', id).single()

    if (!movement || movement.status !== 'pending') {
      return res.status(400).json({ error: 'Mișcarea nu este pending' })
    }

    // Calculează costul estimativ furnizor (din transport_costs unde from=NULL)
    const { data: supplierTc } = await supabase
      .from('transport_costs')
      .select('*')
      .is('from_location_id', null)
      .eq('to_location_id', movement.to_location_id)
      .maybeSingle()

    const { data: product } = await supabase
      .from('products').select('weight_kg').eq('id', movement.product_id).single()

    const supplierCost = supplierTc
      ? supplierTc.fixed_cost + (movement.quantity * (product?.weight_kg ?? 0) * supplierTc.cost_per_kg)
      : null

    // Anulează mișcarea originală de tip transfer
    await supabase
      .from('stock_movements')
      .update({ status: 'cancelled', notes: 'Înlocuit cu comandă furnizor' })
      .eq('id', id)

    // Creează o mișcare nouă de tip supplier_order
    const { data: newMovement, error } = await supabase
      .from('stock_movements')
      .insert([{
        product_id:            movement.product_id,
        from_location_id:      null,   // furnizor extern
        to_location_id:        movement.to_location_id,
        quantity:              movement.quantity,
        movement_type:         'supplier_order',
        status:                'in_transit',   // furnizorul expediază direct
        transport_cost:        supplierCost,
        notes:                 `Comandă furnizor — rețeaua nu a avut stoc (înlocuiește mișcarea #${id})`,
        recommendation_reason: 'Comandă furnizor externă',
        accepted_at:           new Date().toISOString(),
      }])
      .select(`
        *,
        products (id, name, sku),
        to_location:to_location_id (id, name, city, type)
      `)
      .single()

    if (error) return res.status(500).json({ error: error.message })

    await logAction({
      user: req.user,
      action: 'SUPPLIER_ORDER',
      entity: 'movement',
      entityId: newMovement.id,
      description: `Comandă furnizor creată pentru ${movement.quantity} buc, produs ID ${movement.product_id}`,
      metadata: {
        original_movement_id: Number(id),
        to_location_id: movement.to_location_id,
        estimated_cost: supplierCost,
      },
      req,
    })

    res.status(201).json(newMovement)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// ─────────────────────────────────────────────
// PATCH /api/movements/:id/accept
// Warehouse acceptă cererea unui stand
// Dacă sursa e depozit → direct in_transit + scade stoc din depozit
// Dacă sursa e stand   → awaiting_pickup (stand-ul sursă trebuie să confirme)
// ─────────────────────────────────────────────
router.patch('/:id/accept', authorize('admin', 'warehouse_manager'), async (req, res) => {
  try {
    const { id } = req.params
    const { source_location_id } = req.body  // poate suprascrie sursa recomandată

    const { data: movement, error: mErr } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('id', id)
      .single()

    if (mErr || !movement) return res.status(404).json({ error: 'Mișcare negăsită' })
    if (movement.status !== 'pending') {
      return res.status(400).json({ error: `Mișcarea are status "${movement.status}", nu poate fi acceptată` })
    }

    const fromId = source_location_id || movement.from_location_id

    if (!fromId) {
      return res.status(400).json({
        error: 'Nicio sursă disponibilă.',
        code: 'NO_SOURCE',  // frontend-ul verifică acest cod
        movement_id: movement.id,
      })
    }
    // Determină tipul sursei
    const { data: sourceLocation, error: locErr } = await supabase
      .from('locations')
      .select('id, name, type')
      .eq('id', fromId)
      .single()

    if (locErr || !sourceLocation) return res.status(400).json({ error: 'Locația sursă negăsită' })

    if (sourceLocation.type === 'warehouse') {
      // ── SURSĂ DEPOZIT → verifică stoc, scade, marchează in_transit ──────────
      const { data: sourceStock } = await supabase
        .from('stock')
        .select('quantity')
        .eq('location_id', fromId)
        .eq('product_id', movement.product_id)
        .single()

      const available = sourceStock?.quantity ?? 0
      if (available < movement.quantity) {
        return res.status(400).json({
          error: `Stoc insuficient în depozit. Disponibil: ${available}, necesar: ${movement.quantity}`
        })
      }

      const { error: stockErr } = await supabase
        .from('stock')
        .update({ quantity: available - movement.quantity })
        .eq('location_id', fromId)
        .eq('product_id', movement.product_id)

      if (stockErr) return res.status(500).json({ error: stockErr.message })

      const { data: updated, error: updateErr } = await supabase
        .from('stock_movements')
        .update({
          status: 'in_transit',
          from_location_id: fromId,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(`
          *,
          products (id, name, sku),
          from_location:from_location_id (id, name, city, type),
          to_location:to_location_id (id, name, city, type)
        `)
        .single()

      if (updateErr) return res.status(500).json({ error: updateErr.message })

      await logAction({
        user: req.user,
        action: 'ACCEPT',
        entity: 'movement',
        entityId: Number(id),
        description: `Acceptat și expediat din depozit (${sourceLocation.name}): ${movement.quantity} buc, produs ID ${movement.product_id}`,
        metadata: { from_location_id: fromId, to_location_id: movement.to_location_id, source_type: 'warehouse' },
        req,
      })

      return res.json(updated)

    } else {
      // ── SURSĂ STAND → marchează awaiting_pickup, Stand B va primi notificare ──
      const { data: updated, error: updateErr } = await supabase
        .from('stock_movements')
        .update({
          status: 'awaiting_pickup',
          from_location_id: fromId,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(`
          *,
          products (id, name, sku),
          from_location:from_location_id (id, name, city, type),
          to_location:to_location_id (id, name, city, type)
        `)
        .single()

      if (updateErr) return res.status(500).json({ error: updateErr.message })

      await logAction({
        user: req.user,
        action: 'ACCEPT',
        entity: 'movement',
        entityId: Number(id),
        description: `Acceptat, în așteptarea expedierii de la standul ${sourceLocation.name} (ID ${fromId})`,
        metadata: { from_location_id: fromId, to_location_id: movement.to_location_id, source_type: 'stand' },
        req,
      })

      return res.json(updated)
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// PATCH /api/movements/:id/pickup
// Stand B confirmă că a expediat produsele
// Scade stocul din Stand B, marchează in_transit
// ─────────────────────────────────────────────
router.patch('/:id/pickup', async (req, res) => {
  try {
    const { id } = req.params

    const { data: movement, error: mErr } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('id', id)
      .single()

    if (mErr || !movement) return res.status(404).json({ error: 'Mișcare negăsită' })
    if (movement.status !== 'awaiting_pickup') {
      return res.status(400).json({ error: 'Mișcarea nu este în așteptarea expedierii' })
    }

    // Stand manager poate confirma DOAR dacă e standul sursă
    if (
      req.user.role === 'stand_manager' &&
      req.user.location_id !== movement.from_location_id
    ) {
      return res.status(403).json({ error: 'Nu poți confirma expedierea pentru alt stand' })
    }

    // Verifică stoc disponibil
    const { data: sourceStock } = await supabase
      .from('stock')
      .select('quantity')
      .eq('location_id', movement.from_location_id)
      .eq('product_id', movement.product_id)
      .single()

    const available = sourceStock?.quantity ?? 0
    if (available < movement.quantity) {
      return res.status(400).json({
        error: `Stoc insuficient. Disponibil: ${available}, necesar: ${movement.quantity}. Contactează managerul de depozit.`
      })
    }

    // Scade din Stand B
    const { error: stockErr } = await supabase
      .from('stock')
      .update({ quantity: available - movement.quantity })
      .eq('location_id', movement.from_location_id)
      .eq('product_id', movement.product_id)

    if (stockErr) return res.status(500).json({ error: stockErr.message })

    const { data: updated, error: updateErr } = await supabase
      .from('stock_movements')
      .update({
        status: 'in_transit',
        picked_up_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        products (id, name, sku),
        from_location:from_location_id (id, name, city, type),
        to_location:to_location_id (id, name, city, type)
      `)
      .single()

    if (updateErr) return res.status(500).json({ error: updateErr.message })

    await logAction({
      user: req.user,
      action: 'PICKUP',
      entity: 'movement',
      entityId: Number(id),
      description: `Expediat de la standul ID ${movement.from_location_id}: ${movement.quantity} buc, produs ID ${movement.product_id}`,
      metadata: { from_location_id: movement.from_location_id, to_location_id: movement.to_location_id },
      req,
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// PATCH /api/movements/:id/receive
// Stand A confirmă primirea → adaugă stoc, completed
// ─────────────────────────────────────────────
router.patch('/:id/receive', async (req, res) => {
  try {
    const { id } = req.params

    const { data: movement, error: mErr } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('id', id)
      .single()

    if (mErr || !movement) return res.status(404).json({ error: 'Mișcare negăsită' })
    if (movement.status !== 'in_transit') {
      return res.status(400).json({ error: 'Mișcarea nu este în tranzit' })
    }

    // Stand manager poate confirma DOAR dacă e standul destinație
    if (
      req.user.role === 'stand_manager' &&
      req.user.location_id !== movement.to_location_id
    ) {
      return res.status(403).json({ error: 'Nu poți confirma primirea pentru alt stand' })
    }

    // Adaugă stoc la destinație
    const { data: toStock } = await supabase
      .from('stock')
      .select('quantity')
      .eq('location_id', movement.to_location_id)
      .eq('product_id', movement.product_id)
      .single()

    const { error: stockErr } = await supabase
      .from('stock')
      .update({ quantity: (toStock?.quantity ?? 0) + movement.quantity })
      .eq('location_id', movement.to_location_id)
      .eq('product_id', movement.product_id)

    if (stockErr) return res.status(500).json({ error: stockErr.message })

    const { data: updated, error: updateErr } = await supabase
      .from('stock_movements')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        products (id, name, sku),
        from_location:from_location_id (id, name, city, type),
        to_location:to_location_id (id, name, city, type)
      `)
      .single()

    if (updateErr) return res.status(500).json({ error: updateErr.message })

    await logAction({
      user: req.user,
      action: 'RECEIVE',
      entity: 'movement',
      entityId: Number(id),
      description: `Primire confirmată la locația ID ${movement.to_location_id}: ${movement.quantity} buc, produs ID ${movement.product_id}`,
      metadata: { from_location_id: movement.from_location_id, to_location_id: movement.to_location_id },
      req,
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// PATCH /api/movements/:id/cancel
// Anulare — posibil din pending sau awaiting_pickup
// Dacă era awaiting_pickup, stocul nu a fost scăzut → nimic de restaurat
// ─────────────────────────────────────────────
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const { data: movement, error: mErr } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('id', id)
      .single()

    if (mErr || !movement) return res.status(404).json({ error: 'Mișcare negăsită' })

    const cancellableStatuses = ['pending', 'awaiting_pickup']
    if (!cancellableStatuses.includes(movement.status)) {
      return res.status(400).json({
        error: `Nu poți anula o mișcare cu statusul "${movement.status}"`
      })
    }

    // Stand manager poate anula doar propriile cereri (ca destinație) sau pickup-uri (ca sursă)
    if (req.user.role === 'stand_manager') {
      const isDestination = req.user.location_id === movement.to_location_id
      const isSource = req.user.location_id === movement.from_location_id
      if (!isDestination && !isSource) {
        return res.status(403).json({ error: 'Nu poți anula această mișcare' })
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('stock_movements')
      .update({
        status: 'cancelled',
        notes: reason
          ? `${movement.notes ? movement.notes + ' | ' : ''}Anulat: ${reason}`
          : movement.notes,
      })
      .eq('id', id)
      .select(`
        *,
        products (id, name, sku),
        from_location:from_location_id (id, name, city, type),
        to_location:to_location_id (id, name, city, type)
      `)
      .single()

    if (updateErr) return res.status(500).json({ error: updateErr.message })

    await logAction({
      user: req.user,
      action: 'CANCEL',
      entity: 'movement',
      entityId: Number(id),
      description: `Mișcare anulată${reason ? ': ' + reason : ''}`,
      metadata: { previous_status: movement.status, reason },
      req,
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router