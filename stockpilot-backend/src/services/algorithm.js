import supabase from '../config/supabase.js'

const DAYS_OPTIONS = [30, 60, 90]
const WEIGHTS = { 30: 0.5, 60: 0.3, 90: 0.2 }
const BUFFER_DAYS = 5          // zile extra buffer peste lead time
const SURPLUS_THRESHOLD = 45   // dacă ai stoc pentru mai mult de 45 zile = surplus

export async function generateSuggestions() {
  const suggestions = []

  // 1. Ia toate locațiile de tip stand
  const { data: stands } = await supabase
    .from('locations')
    .select('*')
    .eq('type', 'stand')

  // 2. Ia toate produsele
  const { data: products } = await supabase
    .from('products')
    .select('*')

  // 3. Ia toate stocurile
  const { data: allStock } = await supabase
    .from('stock')
    .select('*')

  // 4. Ia costurile de transport
  const { data: transportCosts } = await supabase
    .from('transport_costs')
    .select('*')

  // 5. Calculează rata medie de vânzare ponderată pentru fiecare locație × produs
  const salesRates = await calculateWeightedSalesRates(stands, products)

  // 6. Identifică deficite și surplusuri
  for (const product of products) {
    const deficitStands  = []
    const surplusStands  = []

    for (const stand of stands) {
      const stock = allStock.find(
        s => s.location_id === stand.id && s.product_id === product.id
      )
      if (!stock) continue

      const dailySales = salesRates[`${stand.id}-${product.id}`] || 0.1
      const daysRemaining = (stock.quantity - stock.safety_stock) / dailySales

      // Lead time minim din depozit central (location_id = 1)
      const leadTime = getLeadTime(1, stand.id, transportCosts)

      if (daysRemaining < leadTime + BUFFER_DAYS) {
        deficitStands.push({
          stand,
          stock,
          dailySales,
          daysRemaining,
          leadTime,
          neededQty: Math.ceil(dailySales * (leadTime + BUFFER_DAYS + 14)) 
          // comandăm pentru lead time + buffer + 14 zile extra
        })
      } else if (daysRemaining > SURPLUS_THRESHOLD) {
        surplusStands.push({
          stand,
          stock,
          dailySales,
          daysRemaining,
          transferableQty: Math.floor(
            stock.quantity - stock.safety_stock - (dailySales * 30)
          )
        })
      }
    }

    // 7. Pentru fiecare deficit, calculează cea mai bună sursă
    for (const deficit of deficitStands) {
      const options = []

      // Opțiunea A — transfer de la un stand cu surplus
      for (const surplus of surplusStands) {
        if (surplus.transferableQty <= 0) continue

        const tc = transportCosts.find(
          t => t.from_location_id === surplus.stand.id && 
               t.to_location_id === deficit.stand.id
        )
        if (!tc) continue

        const qty = Math.min(deficit.neededQty, surplus.transferableQty)
        const cost = tc.fixed_cost + (qty * product.weight_kg * tc.cost_per_kg)

        options.push({
          type: 'transfer',
          fromLocation: surplus.stand,
          qty,
          cost,
          leadTime: tc.lead_time_days,
          reason: `Transfer de la ${surplus.stand.name} (stoc pentru ${Math.round(surplus.daysRemaining)} zile). Cost: ${cost.toFixed(2)} RON.`
        })
      }

      // Opțiunea B — comandă din depozit central
      const tcWarehouse = transportCosts.find(
        t => t.from_location_id === 1 && 
             t.to_location_id === deficit.stand.id
      )
      if (tcWarehouse) {
        const qty = deficit.neededQty
        const cost = tcWarehouse.fixed_cost + (qty * product.weight_kg * tcWarehouse.cost_per_kg)

        options.push({
          type: 'supplier_order',
          fromLocation: null,
          qty,
          cost,
          leadTime: tcWarehouse.lead_time_days,
          reason: `Comandă din depozitul central. Cost transport: ${cost.toFixed(2)} RON.`
        })
      }

      if (options.length === 0) continue

      // 8. Alege opțiunea optimă
      // Dacă stocul se epuizează înainte de lead time, prioritizăm viteza
      const urgent = deficit.daysRemaining < 2
      const best = urgent
        ? options.sort((a, b) => a.leadTime - b.leadTime)[0]
        : options.sort((a, b) => a.cost - b.cost)[0]

      suggestions.push({
        product_id:       product.id,
        from_location_id: best.fromLocation?.id || null,
        to_location_id:   deficit.stand.id,
        suggested_qty:    best.qty,
        estimated_cost:   best.cost,
        reason: `[${urgent ? 'URGENT' : 'NORMAL'}] ${deficit.stand.name} va rămâne fără "${product.name}" în ~${Math.round(deficit.daysRemaining)} zile. ${best.reason}`
      })
    }
  }

  // 9. Salvează sugestiile în baza de date
  if (suggestions.length > 0) {
    // Șterge sugestiile vechi neprocesate
    await supabase
      .from('reorder_suggestions')
      .delete()
      .eq('status', 'pending')

    await supabase
      .from('reorder_suggestions')
      .insert(suggestions)
  }

  return suggestions
}

// ── Helpers ──────────────────────────────────────────────

async function calculateWeightedSalesRates(stands, products) {
  const rates = {}

  for (const days of DAYS_OPTIONS) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: sales } = await supabase
      .from('sales')
      .select('location_id, product_id, quantity')
      .gte('sold_at', since)

    for (const sale of sales) {
      const key = `${sale.location_id}-${sale.product_id}`
      if (!rates[key]) rates[key] = { weighted: 0 }
      rates[key].weighted += (sale.quantity / days) * WEIGHTS[days]
    }
  }

  return Object.fromEntries(
    Object.entries(rates).map(([k, v]) => [k, v.weighted])
  )
}

function getLeadTime(fromId, toId, transportCosts) {
  const tc = transportCosts.find(
    t => t.from_location_id === fromId && t.to_location_id === toId
  )
  return tc?.lead_time_days || 3
}