import { Router } from 'express'
import supabase from '../config/supabase.js'

const router = Router()

// GET /api/locations — toate locațiile
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('type', { ascending: false }) // warehouse primul

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/locations/:id — o locație cu stocurile ei
router.get('/:id', async (req, res) => {
  const { id } = req.params

  const { data: location, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return res.status(404).json({ error: 'Location not found' })

  const { data: stock } = await supabase
    .from('stock')
    .select('*, products(*)')
    .eq('location_id', id)

  res.json({ ...location, stock })
})

export default router