import { Router } from 'express'
import bcrypt from 'bcrypt'
import supabase from '../config/supabase.js'

const router = Router()

// GET /api/users — toți utilizatorii
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, location_id, created_at, locations(name, city)')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/users — creează utilizator nou
router.post('/', async (req, res) => {
  const { name, email, password, role, location_id } = req.body

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Toate câmpurile obligatorii trebuie completate' })
  }

  // Verifică dacă email-ul există deja
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    return res.status(400).json({ error: 'Email-ul este deja folosit' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const { data, error } = await supabase
    .from('users')
    .insert([{
      name, email,
      password: hashedPassword,
      role,
      location_id: location_id || null
    }])
    .select('id, name, email, role, location_id, created_at')
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

// PUT /api/users/:id — editează utilizator
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { name, email, role, location_id, password } = req.body

  const updates = { name, email, role, location_id: location_id || null }

  // Parola e opțională la editare
  if (password && password.trim() !== '') {
    updates.password = await bcrypt.hash(password, 10)
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select('id, name, email, role, location_id, created_at')
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// DELETE /api/users/:id — șterge utilizator
router.delete('/:id', async (req, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id)

  if (error) return res.status(400).json({ error: error.message })
  res.json({ success: true })
})

export default router