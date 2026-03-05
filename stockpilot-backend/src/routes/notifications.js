import { Router } from 'express'
import supabase from '../config/supabase.js'

const router = Router()

// GET /api/notifications — generează notificări din starea curentă
router.get('/', async (req, res) => {
  try {
    const notifications = []

    // ── 1. Stocuri critice (sub safety stock) ──
    const { data: allStockForCritical } = await supabase
      .from('stock')
      .select('*, products(name, sku), locations(name, city, type)')

    const criticalStock = (allStockForCritical ?? []).filter(
      item => item.quantity <= item.safety_stock
    )

    for (const item of criticalStock) {
      if (item.locations?.type === 'warehouse') continue
      notifications.push({
        id: `critical-${item.id}`,
        type: 'critical',
        title: 'Stoc critic',
        message: `${item.products?.name} la ${item.locations?.name} — ${item.quantity} buc rămase (minim: ${item.safety_stock})`,
        location: item.locations?.city,
        product: item.products?.name,
        metadata: {
          stock_id: item.id,
          location_id: item.location_id,
          product_id: item.product_id,
          quantity: item.quantity,
          safety_stock: item.safety_stock,
        },
        created_at: new Date().toISOString(),
        action_url: `/stock`,
      })
    }

    // ── 2. Stocuri scăzute (între safety stock și safety stock * 2) ──
    const lowStock = (allStockForCritical ?? []).filter(
      item => item.quantity > item.safety_stock && item.quantity <= item.safety_stock * 2
    )

    for (const item of lowStock) {
      if (item.locations?.type === 'warehouse') continue
      notifications.push({
        id: `low-${item.id}`,
        type: 'warning',
        title: 'Stoc scăzut',
        message: `${item.products?.name} la ${item.locations?.name} — ${item.quantity} buc (sub pragul recomandat)`,
        location: item.locations?.city,
        product: item.products?.name,
        metadata: {
          stock_id: item.id,
          location_id: item.location_id,
          product_id: item.product_id,
          quantity: item.quantity,
          safety_stock: item.safety_stock,
        },
        created_at: new Date().toISOString(),
        action_url: `/stock`,
      })
    }

    // ── 3. Sugestii în așteptare ──
    const { data: suggestions } = await supabase
      .from('reorder_suggestions')
      .select('*, products(name), to:to_location_id(name, city)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)

    for (const s of suggestions ?? []) {
      const isUrgent = s.reason?.includes('[URGENT]')
      notifications.push({
        id: `suggestion-${s.id}`,
        type: isUrgent ? 'critical' : 'info',
        title: isUrgent ? 'Sugestie urgentă' : 'Sugestie reaprovizionare',
        message: `${s.products?.name} → ${s.to?.name}: ${s.suggested_qty} buc recomandate`,
        location: s.to?.city,
        product: s.products?.name,
        metadata: { suggestion_id: s.id },
        created_at: s.created_at,
        action_url: `/suggestions`,
      })
    }

    // ── 4. Transferuri în tranzit ──
    const { data: inTransit } = await supabase
      .from('stock_movements')
      .select('*, products(name), to:to_location_id(name, city)')
      .eq('status', 'in_transit')
      .order('created_at', { ascending: false })
      .limit(5)

    for (const m of inTransit ?? []) {
      notifications.push({
        id: `transit-${m.id}`,
        type: 'info',
        title: 'Transfer în tranzit',
        message: `${m.products?.name} — ${m.quantity} buc în drum spre ${m.to?.name}`,
        location: m.to?.city,
        product: m.products?.name,
        metadata: { movement_id: m.id },
        created_at: m.created_at,
        action_url: `/movements`,
      })
    }

    // Sortează: critical > warning > info, apoi după dată
    const order = { critical: 0, warning: 1, info: 2 }
    notifications.sort((a, b) =>
      order[a.type] - order[b.type] ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    res.json({
      notifications,
      summary: {
        total: notifications.length,
        critical: notifications.filter(n => n.type === 'critical').length,
        warning: notifications.filter(n => n.type === 'warning').length,
        info: notifications.filter(n => n.type === 'info').length,
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router