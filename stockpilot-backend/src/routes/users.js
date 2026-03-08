import { Router } from 'express'
import bcrypt from 'bcrypt'
import supabase from '../config/supabase.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { logAction } from '../services/audit.js'

const router = Router()

router.use(authenticate)

// GET /api/users — toți utilizatorii
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, location_id, created_at, locations(name, city)')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/users — creează utilizator nou (doar admin)
router.post('/', authorize('admin'), async (req, res) => {
  const { name, email, password, role, location_id } = req.body

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Toate câmpurile obligatorii trebuie completate' })
  }

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
      location_id: location_id || null,
    }])
    .select('id, name, email, role, location_id, created_at')
    .single()

  if (error) return res.status(400).json({ error: error.message })

  await logAction({
    user: req.user,
    action: 'CREATE',
    entity: 'user',
    entityId: data.id,
    description: `Utilizator nou creat: ${data.name} (${data.email}) — rol: ${data.role}`,
    metadata: { name: data.name, email: data.email, role: data.role, location_id: data.location_id },
    req,
  })

  res.status(201).json(data)
})

// PUT /api/users/:id — editează utilizator (doar admin)
router.put('/:id', authorize('admin'), async (req, res) => {
  const { id } = req.params
  const { name, email, role, location_id, password } = req.body

  const updates = { name, email, role, location_id: location_id || null }

  const passwordChanged = password && password.trim() !== ''
  if (passwordChanged) {
    updates.password = await bcrypt.hash(password, 10)
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select('id, name, email, role, location_id, created_at')
    .single()

  if (error) return res.status(400).json({ error: error.message })

  await logAction({
    user: req.user,
    action: 'UPDATE',
    entity: 'user',
    entityId: Number(id),
    description: `Utilizator actualizat: ${data.name} (${data.email})${passwordChanged ? ' — parolă schimbată' : ''}`,
    metadata: { name: data.name, email: data.email, role: data.role, location_id: data.location_id, password_changed: passwordChanged },
    req,
  })

  res.json(data)
})

// DELETE /api/users/:id — șterge utilizator (doar admin)
router.delete('/:id', authorize('admin'), async (req, res) => {
  const { id } = req.params

  // Nu permite auto-ștergerea
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'Nu te poți șterge pe tine însuți' })
  }

  // Fetch înainte de ștergere ca să logăm numele
  const { data: userToDelete } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id)

  if (error) return res.status(400).json({ error: error.message })

  await logAction({
    user: req.user,
    action: 'DELETE',
    entity: 'user',
    entityId: Number(id),
    description: `Utilizator șters: ${userToDelete?.name ?? 'N/A'} (${userToDelete?.email ?? 'N/A'})`,
    metadata: { name: userToDelete?.name, email: userToDelete?.email, role: userToDelete?.role },
    req,
  })

  res.json({ success: true })
})

export default router