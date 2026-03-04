import { Router } from 'express'
import supabase from '../config/supabase.js'
import { logAction } from '../services/audit.js'

const router = Router()

// GET /api/settings — toate setările
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('location_settings')
    .select('*, locations(name, city, type)')
    .order('location_id')

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/settings/:location_id — setările unei locații
router.get('/:location_id', async (req, res) => {
  const { location_id } = req.params

  const { data, error } = await supabase
    .from('location_settings')
    .select('*, locations(name, city, type)')
    .eq('location_id', location_id)
    .single()

  if (error) {
    // Dacă nu există, returnează default-uri
    return res.json({
      location_id: Number(location_id),
      lead_time_days: 2,
      safety_stock_multiplier: 1.0,
      reorder_threshold_days: 7,
      surplus_threshold_days: 45,
      max_transfer_qty: 100,
      auto_suggestions: true,
      notes: '',
    })
  }

  res.json(data)
})

// PUT /api/settings/:location_id — actualizează setările
router.put('/:location_id', async (req, res) => {
  const { location_id } = req.params
  const {
    lead_time_days,
    safety_stock_multiplier,
    reorder_threshold_days,
    surplus_threshold_days,
    max_transfer_qty,
    auto_suggestions,
    notes,
  } = req.body

  // Validări
  if (lead_time_days < 1 || lead_time_days > 30) {
    return res.status(400).json({ error: 'Lead time trebuie să fie între 1 și 30 zile' })
  }
  if (safety_stock_multiplier < 0.5 || safety_stock_multiplier > 5) {
    return res.status(400).json({ error: 'Multiplicatorul trebuie să fie între 0.5 și 5' })
  }

  const updates = {
    lead_time_days,
    safety_stock_multiplier,
    reorder_threshold_days,
    surplus_threshold_days,
    max_transfer_qty,
    auto_suggestions,
    notes,
    updated_at: new Date().toISOString(),
    updated_by: req.user?.name ?? 'System',
  }

  // Upsert — creează dacă nu există, actualizează dacă există
  const { data, error } = await supabase
    .from('location_settings')
    .upsert({ location_id: Number(location_id), ...updates })
    .select('*, locations(name, city)')
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

  res.json(data)
})

// POST /api/settings/reset/:location_id — resetează la default
router.post('/reset/:location_id', async (req, res) => {
  const { location_id } = req.params

  const defaults = {
    location_id: Number(location_id),
    lead_time_days: 2,
    safety_stock_multiplier: 1.0,
    reorder_threshold_days: 7,
    surplus_threshold_days: 45,
    max_transfer_qty: 100,
    auto_suggestions: true,
    notes: '',
    updated_at: new Date().toISOString(),
    updated_by: req.user?.name ?? 'System',
  }

  const { data, error } = await supabase
    .from('location_settings')
    .upsert(defaults)
    .select()
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