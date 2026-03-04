import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import supabase from '../config/supabase.js'
import { logAction } from '../services/audit.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email și parola sunt obligatorii' })
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()

  if (error || !user) {
    return res.status(401).json({ error: 'Email sau parolă incorectă' })
  }

  const validPassword = await bcrypt.compare(password, user.password)
  if (!validPassword) {
    return res.status(401).json({ error: 'Email sau parolă incorectă' })
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, location_id: user.location_id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      location_id: user.location_id,
    }
  })

  await logAction({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    action: 'LOGIN',
    entity: 'user',
    entityId: user.id,
    description: `${user.name} s-a autentificat`,
    req,
  })
})

export default router