import { Router } from 'express'
import supabase from '../config/supabase.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { logAction } from '../services/audit.js'

const router = Router()

router.use(authenticate)

// GET /api/locations
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('type', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/locations/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params

  const { data: location, error } = await supabase
    .from('locations').select('*').eq('id', id).single()

  if (error) return res.status(404).json({ error: 'Location not found' })

  const { data: stock } = await supabase
    .from('stock').select('*, products(*)').eq('location_id', id)

  res.json({ ...location, stock })
})

// POST /api/locations — doar admin
router.post('/', authorize('admin'), async (req, res) => {
  const { name, type, city, address, lat, lng } = req.body

  if (!name || !type || !city) {
    return res.status(400).json({ error: 'name, type și city sunt obligatorii' })
  }

  const { data, error } = await supabase
    .from('locations')
    .insert([{ name, type, city, address: address || null, lat: lat || null, lng: lng || null }])
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })

  // Creează automat rânduri de stock pentru toate produsele existente
  const { data: products } = await supabase.from('products').select('id')
  if (products?.length) {
    await supabase.from('stock').insert(
      products.map(p => ({
        location_id: data.id,
        product_id: p.id,
        quantity: 0,
        safety_stock: 5,
      }))
    )
  }

  // Setări default pentru locația nouă
  await supabase.from('location_settings').insert([{ location_id: data.id }])

  await logAction({
    user: req.user, action: 'CREATE', entity: 'location', entityId: data.id,
    description: `Locație nouă creată: ${data.name} (${data.city})`,
    metadata: { type, city }, req,
  })

  res.status(201).json(data)
})

// PUT /api/locations/:id — doar admin (type nu se poate schimba)
router.put('/:id', authorize('admin'), async (req, res) => {
  const { id } = req.params
  const { name, city, address, lat, lng } = req.body

  const { data, error } = await supabase
    .from('locations')
    .update({ name, city, address: address || null, lat: lat || null, lng: lng || null })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })

  await logAction({
    user: req.user, action: 'UPDATE', entity: 'location', entityId: Number(id),
    description: `Locație actualizată: ${data.name}`,
    metadata: { name, city }, req,
  })

  res.json(data)
})

// DELETE /api/locations/:id — doar admin
router.delete('/:id', authorize('admin'), async (req, res) => {
  const { id } = req.params

  // Blochează dacă are utilizatori asignați
  const { data: assignedUsers } = await supabase
    .from('users').select('id').eq('location_id', id)

  if (assignedUsers?.length) {
    return res.status(400).json({
      error: `Nu poți șterge locația — are ${assignedUsers.length} utilizator(i) asignat(i). Reasignează-i mai întâi.`
    })
  }

  // Fetch înainte de ștergere ca să logăm numele
  const { data: locationToDelete } = await supabase
    .from('locations')
    .select('name, city, type')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('locations').delete().eq('id', id)
  if (error) return res.status(400).json({ error: error.message })

  await logAction({
    user: req.user,
    action: 'DELETE',
    entity: 'location',
    entityId: Number(id),
    description: `Locație ștearsă: ${locationToDelete?.name ?? 'N/A'} (${locationToDelete?.city ?? 'N/A'})`,
    metadata: { name: locationToDelete?.name, city: locationToDelete?.city, type: locationToDelete?.type },
    req,
  })

  res.json({ success: true })
})

export default router