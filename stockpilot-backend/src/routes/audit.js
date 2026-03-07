import { Router } from 'express'
import supabase from '../config/supabase.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/audit/my-activity
// Activitatea proprie a utilizatorului curent (stand sau warehouse).
// Returnează acțiunile efectuate de acest user, paginate.
// Stand și warehouse văd DOAR ce au făcut ei personal.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-activity', async (req, res) => {
  try {
    const { page = 1, limit = 25 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1)

    const { data, error, count } = await query

    if (error) return res.status(500).json({ error: error.message })

    res.json({
      logs:  data ?? [],
      total: count ?? 0,
      page:  Number(page),
      pages: Math.ceil((count ?? 0) / Number(limit)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/audit — toate log-urile (doar admin)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, entity, from_date, to_date } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1)

    if (action)    query = query.eq('action', action)
    if (entity)    query = query.eq('entity', entity)
    if (from_date) query = query.gte('created_at', from_date)
    if (to_date)   query = query.lte('created_at', to_date + 'T23:59:59')

    const { data, error, count } = await query

    if (error) return res.status(500).json({ error: error.message })

    res.json({
      logs:  data ?? [],
      total: count ?? 0,
      page:  Number(page),
      pages: Math.ceil((count ?? 0) / Number(limit)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/audit/stats — statistici 7 zile (doar admin)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', authorize('admin'), async (req, res) => {
  try {
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('audit_logs')
      .select('action, entity, user_name, user_role')
      .gte('created_at', since7)

    if (error) return res.status(500).json({ error: error.message })

    const total_7days = data.length

    const by_action = data.reduce((acc, l) => {
      acc[l.action] = (acc[l.action] ?? 0) + 1
      return acc
    }, {})

    const by_entity = data.reduce((acc, l) => {
      acc[l.entity] = (acc[l.entity] ?? 0) + 1
      return acc
    }, {})

    const userCounts = data.reduce((acc, l) => {
      if (!l.user_name) return acc
      acc[l.user_name] = (acc[l.user_name] ?? 0) + 1
      return acc
    }, {})

    const top_users = Object.entries(userCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    res.json({ total_7days, by_action, by_entity, top_users })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router