import { Router } from 'express'
import supabase from '../config/supabase.js'

const router = Router()

// GET /api/audit?page=1&limit=50&action=CREATE&entity=product&user_id=1
router.get('/', async (req, res) => {
  const {
    page   = 1,
    limit  = 50,
    action,
    entity,
    user_id,
    from_date,
    to_date,
  } = req.query

  const offset = (Number(page) - 1) * Number(limit)

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1)

  if (action)    query = query.eq('action', action)
  if (entity)    query = query.eq('entity', entity)
  if (user_id)   query = query.eq('user_id', user_id)
  if (from_date) query = query.gte('created_at', from_date)
  if (to_date)   query = query.lte('created_at', to_date)

  const { data, error, count } = await query

  if (error) return res.status(500).json({ error: error.message })

  res.json({
    logs: data,
    total: count,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(count / Number(limit)),
  })
})

// GET /api/audit/stats — statistici pentru dashboard
router.get('/stats', async (req, res) => {
  const since7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('audit_logs')
    .select('action, entity, user_name, created_at')
    .gte('created_at', since7days)

  if (error) return res.status(500).json({ error: error.message })

  // Agregări
  const byAction = data.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] ?? 0) + 1
    return acc
  }, {})

  const byEntity = data.reduce((acc, l) => {
    acc[l.entity] = (acc[l.entity] ?? 0) + 1
    return acc
  }, {})

  const byUser = data.reduce((acc, l) => {
    acc[l.user_name] = (acc[l.user_name] ?? 0) + 1
    return acc
  }, {})

  const topUsers = Object.entries(byUser)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  res.json({
    total_7days: data.length,
    by_action: byAction,
    by_entity: byEntity,
    top_users: topUsers,
  })
})

export default router