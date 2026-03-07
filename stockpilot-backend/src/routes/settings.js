import { Router } from 'express'
import supabase from '../config/supabase.js'
import { logAction } from '../services/audit.js'
import { authenticate } from '../middleware/auth.js' 

const router = Router()

router.use(authenticate)

// Câmpurile permise + valorile lor default
// Sursa unică de adevăr — folosită la validare, GET fallback și reset
const DEFAULTS = {
  lead_time_days:          2,
  safety_stock_multiplier: 1.0,
  reorder_threshold_days:  7,
  surplus_threshold_days:  45,
  max_transfer_qty:        100,
  auto_suggestions:        true,
  stale_days_threshold:    60,    // zile fără vânzări → stoc mort
  storage_capacity:        9999,  // buc totale max per stand (9999 = nelimitat)
  notes:                   '',
}

// ─────────────────────────────────────────────
// GET /api/settings — toate setările
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('location_settings')
    .select('*, locations(name, city, type)')
    .order('location_id')

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ─────────────────────────────────────────────
// GET /api/settings/:location_id
// ─────────────────────────────────────────────
router.get('/:location_id', async (req, res) => {
  const { location_id } = req.params

  const { data, error } = await supabase
    .from('location_settings')
    .select('*, locations(name, city, type)')
    .eq('location_id', location_id)
    .single()

  if (error) {
    // Rândul nu există încă — returnează default-uri cu location_id
    return res.json({ location_id: Number(location_id), ...DEFAULTS })
  }

  // Completăm câmpurile noi cu default dacă sunt null
  // (pentru rânduri create înainte de migrare)
  res.json({
    ...data,
    stale_days_threshold: data.stale_days_threshold ?? DEFAULTS.stale_days_threshold,
    storage_capacity:     data.storage_capacity     ?? DEFAULTS.storage_capacity,
  })
})

// ─────────────────────────────────────────────
// PUT /api/settings/:location_id
// ─────────────────────────────────────────────
router.put('/:location_id', async (req, res) => {
  const { location_id } = req.params
  const {
    lead_time_days,
    safety_stock_multiplier,
    reorder_threshold_days,
    surplus_threshold_days,
    max_transfer_qty,
    auto_suggestions,
    stale_days_threshold,
    storage_capacity,
    notes,
  } = req.body

  // Validări
  if (lead_time_days != null && (lead_time_days < 1 || lead_time_days > 30))
    return res.status(400).json({ error: 'Lead time trebuie să fie între 1 și 30 zile' })

  if (safety_stock_multiplier != null && (safety_stock_multiplier < 0.5 || safety_stock_multiplier > 5))
    return res.status(400).json({ error: 'Multiplicatorul trebuie să fie între 0.5 și 5' })

  if (stale_days_threshold != null && (stale_days_threshold < 7 || stale_days_threshold > 365))
    return res.status(400).json({ error: 'Pragul de stoc mort trebuie să fie între 7 și 365 zile' })

  if (storage_capacity != null && (storage_capacity < 1 || storage_capacity > 99999))
    return res.status(400).json({ error: 'Capacitatea trebuie să fie între 1 și 99999 unități' })

  const updates = {
    lead_time_days,
    safety_stock_multiplier,
    reorder_threshold_days,
    surplus_threshold_days,
    max_transfer_qty,
    auto_suggestions,
    stale_days_threshold,
    storage_capacity,
    notes,
    updated_at: new Date().toISOString(),
    updated_by: req.user?.name ?? 'System',
  }

  // Elimină câmpurile undefined (nu suprascrie cu null ce nu s-a trimis)
  Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k])

  const { data, error } = await supabase
    .from('location_settings')
    .upsert({ location_id: Number(location_id), ...updates }, { onConflict: 'location_id' })
    .select('*, locations(name, city, type)')
    .single()

  if (error) return res.status(400).json({ error: error.message })

  await logAction({
    user: req.user,
    action: 'UPDATE',
    entity: 'settings',
    entityId: Number(location_id),
    description: `Setări actualizate pentru locația ID ${location_id}`,
    metadata: updates,
    req,
  })

  res.json({
    ...data,
    stale_days_threshold: data.stale_days_threshold ?? DEFAULTS.stale_days_threshold,
    storage_capacity:     data.storage_capacity     ?? DEFAULTS.storage_capacity,
  })
})

// ─────────────────────────────────────────────
// POST /api/settings/reset/:location_id
// ─────────────────────────────────────────────
router.post('/reset/:location_id', async (req, res) => {
  const { location_id } = req.params

  const resetPayload = {
    location_id: Number(location_id),
    ...DEFAULTS,
    updated_at: new Date().toISOString(),
    updated_by: req.user?.name ?? 'System',
  }

  const { data, error } = await supabase
    .from('location_settings')
    .upsert(resetPayload, { onConflict: 'location_id' })
    .select('*, locations(name, city, type)')
    .single()

  if (error) return res.status(400).json({ error: error.message })

  await logAction({
    user: req.user,
    action: 'UPDATE',
    entity: 'settings',
    entityId: Number(location_id),
    description: `Setări resetate la default pentru locația ID ${location_id}`,
    req,
  })

  res.json(data)
})

export default router