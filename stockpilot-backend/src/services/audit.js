import supabase from '../config/supabase.js'

// Helper central — apelat din orice rută când se întâmplă ceva important
export async function logAction({
  user,
  action,
  entity,
  entityId,
  description,
  metadata = {},
  req = null,
}) {
  try {
    const ip = req
      ? req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress
      : null

    await supabase.from('audit_logs').insert([{
      user_id:    user?.id    ?? null,
      user_name:  user?.name  ?? 'System',
      user_email: user?.email ?? null,
      user_role:  user?.role  ?? null,
      action,
      entity,
      entity_id:  entityId ?? null,
      description,
      metadata,
      ip_address: ip,
    }])
  } catch (err) {
    // Audit log nu trebuie să blocheze operația principală
    console.error('Audit log error:', err.message)
  }
}