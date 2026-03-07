import supabase from '../config/supabase.js'

const DAYS_OPTIONS = [30, 60, 90]
const WEIGHTS      = { 30: 0.5, 60: 0.3, 90: 0.2 }

export async function generateSuggestions() {
  const suggestions = []

  // ── 1. Fetch date ────────────────────────────────────────────────────────────
  const { data: stands } = await supabase
    .from('locations').select('*').eq('type', 'stand')

  const { data: warehouse } = await supabase
    .from('locations').select('*').eq('type', 'warehouse').limit(1).single()

  if (!warehouse) throw new Error('Depozitul central nu a fost găsit')

  const { data: products }       = await supabase.from('products').select('*')
  const { data: allStock }       = await supabase.from('stock').select('*')
  const { data: transportCosts } = await supabase.from('transport_costs').select('*')
  const { data: allSettings }    = await supabase.from('location_settings').select('*')

  // ── 2. Ultima vânzare per produs × stand ─────────────────────────────────────
  // Folosim asta pentru detectarea stocului mort.
  const { data: recentSales } = await supabase
    .from('sales')
    .select('location_id, product_id, sold_at')
    .order('sold_at', { ascending: false })

  const lastSaleMap = {}   // key: `standId-productId` → ISO date string
  for (const sale of recentSales ?? []) {
    const key = `${sale.location_id}-${sale.product_id}`
    if (!lastSaleMap[key]) lastSaleMap[key] = sale.sold_at  // prima = cea mai recentă
  }

  // ── 3. Stoc total per stand (pentru verificarea capacității) ─────────────────
  const totalStockPerStand = {}
  for (const s of allStock ?? []) {
    totalStockPerStand[s.location_id] =
      (totalStockPerStand[s.location_id] ?? 0) + Number(s.quantity)
  }

  // ── 4. Helper settings per locație ──────────────────────────────────────────
  const getSettings = (standId) => {
    const s = allSettings?.find(s => s.location_id === standId)
    return {
      lead_time_days:          s?.lead_time_days          ?? 2,
      safety_stock_multiplier: s?.safety_stock_multiplier ?? 1.0,
      reorder_threshold_days:  s?.reorder_threshold_days  ?? 0,
      surplus_threshold_days:  s?.surplus_threshold_days  ?? 100,
      max_transfer_qty:        s?.max_transfer_qty         ?? 200,
      auto_suggestions:        s?.auto_suggestions         ?? true,
      // NOU
      stale_days_threshold:    s?.stale_days_threshold    ?? 60,
      storage_capacity:        s?.storage_capacity        ?? 9999,
    }
  }

  // ── 5. Helper: zile de când nu s-a vândut nimic ──────────────────────────────
  const daysSinceLastSale = (standId, productId) => {
    const lastSale = lastSaleMap[`${standId}-${productId}`]
    if (!lastSale) return 9999   // niciodată vândut
    return Math.floor((Date.now() - new Date(lastSale).getTime()) / 86400000)
  }

  // ── 6. Helper: capacitate disponibilă la un stand ───────────────────────────
  // Returnează câte unități mai poate primi standul în total.
  const availableCapacity = (standId) => {
    const settings = getSettings(standId)
    const used = totalStockPerStand[standId] ?? 0
    return Math.max(0, settings.storage_capacity - used)
  }

  // ── 7. Rate de vânzare ponderate ─────────────────────────────────────────────
  const salesRates = await calculateWeightedSalesRates(stands, products)

  // ── 8. Identifică deficite, surplusuri și stoc mort ──────────────────────────
  for (const product of products) {
    const deficitStands  = []
    const surplusStands  = []
    const staleStands    = []   // NOU — stoc mort (nu se vinde de mult)

    for (const stand of stands) {
      const settings = getSettings(stand.id)
      if (!settings.auto_suggestions) continue

      const stock = allStock.find(
        s => s.location_id === stand.id && s.product_id === product.id
      )
      if (!stock || Number(stock.quantity) === 0) continue

      const qty                 = Number(stock.quantity)
      const effectiveSafetyStock = Number(stock.safety_stock) * settings.safety_stock_multiplier
      const dailySales          = salesRates[`${stand.id}-${product.id}`] || 0
      const daysRemaining       = dailySales > 0
        ? (qty - effectiveSafetyStock) / dailySales
        : Infinity
      const leadTime            = getLeadTime(warehouse.id, stand.id, transportCosts)
      const bufferDays          = settings.lead_time_days
      const staleDays           = daysSinceLastSale(stand.id, product.id)
      const capAvailable        = availableCapacity(stand.id)

      // ── DEFICIT: stocul se termină înainte de a putea reumple ──────────────
      if (isFinite(daysRemaining) && daysRemaining < leadTime + bufferDays) {
        // Cât poate primi efectiv, limitat de capacitate
        const neededQty = Math.min(
          Math.ceil(dailySales * (leadTime + bufferDays + 14)),
          settings.max_transfer_qty,
          capAvailable           // NOU — nu trimitem peste capacitate
        )
        if (neededQty > 0) {
          deficitStands.push({
            stand, stock, qty, dailySales, daysRemaining, leadTime,
            neededQty, capAvailable,
          })
        }
        continue   // un stand nu poate fi simultan deficit și sursă
      }

      // ── STOC MORT: nu se vinde de mult timp, indiferent de cantitate ───────
      // Condiție: nicio vânzare în stale_days_threshold zile
      //           ȘI cantitate peste safety_stock (avem ce muta)
      const movableFromStale = Math.min(
        Math.floor(qty - effectiveSafetyStock),
        settings.max_transfer_qty
      )

      if (staleDays >= settings.stale_days_threshold && movableFromStale > 0) {
        staleStands.push({
          stand, stock, qty, dailySales: 0, daysRemaining: Infinity,
          staleDays, movableQty: movableFromStale,
          // Stocul mort NU mai rezervăm 30 de zile — vrem să scăpăm de el
        })
        continue   // clasificat ca stale, nu și ca surplus normal
      }

      // ── SURPLUS NORMAL: se vinde, dar avem prea mult ─────────────────────
      if (isFinite(daysRemaining) && daysRemaining > settings.surplus_threshold_days) {
        const transferableQty = Math.min(
          Math.floor(qty - effectiveSafetyStock - (dailySales * 30)),
          settings.max_transfer_qty
        )
        if (transferableQty > 0) {
          surplusStands.push({
            stand, stock, qty, dailySales, daysRemaining,
            transferableQty,
          })
        }
      }
    }

    // ── 9. FLOW A — Deficit ← sursă (surplus stand sau depozit) ────────────────
    for (const deficit of deficitStands) {
      const options = []

      // Opțiunea A1: transfer de la un stand cu surplus
      for (const surplus of surplusStands) {
        if (surplus.transferableQty <= 0) continue
        if (surplus.stand.id === deficit.stand.id) continue

        const tc = transportCosts.find(
          t => t.from_location_id === surplus.stand.id &&
               t.to_location_id   === deficit.stand.id
        )
        if (!tc) continue

        const qty  = Math.min(deficit.neededQty, surplus.transferableQty)
        const cost = tc.fixed_cost + (qty * product.weight_kg * tc.cost_per_kg)

        options.push({
          type: 'transfer', fromLocation: surplus.stand, qty, cost,
          leadTime: tc.lead_time_days,
          reason: `Transfer de la ${surplus.stand.name} (surplus ${Math.round(surplus.daysRemaining)} zile). Cost: ${cost.toFixed(2)} RON.`,
        })
      }

      // Opțiunea A2: transfer de la un stand cu stoc mort
      // → dublu câștig: rezolvăm deficitul ȘI eliberăm marfa blocată
      for (const stale of staleStands) {
        if (stale.movableQty <= 0) continue
        if (stale.stand.id === deficit.stand.id) continue

        const tc = transportCosts.find(
          t => t.from_location_id === stale.stand.id &&
               t.to_location_id   === deficit.stand.id
        )
        if (!tc) continue

        const qty  = Math.min(deficit.neededQty, stale.movableQty)
        const cost = tc.fixed_cost + (qty * product.weight_kg * tc.cost_per_kg)

        options.push({
          type: 'transfer', fromLocation: stale.stand, qty, cost,
          leadTime: tc.lead_time_days,
          reason: `Transfer de la ${stale.stand.name} (stoc mort: ${stale.staleDays} zile fără vânzări). Cost: ${cost.toFixed(2)} RON.`,
        })
      }

      // Opțiunea A3: depozit central
      const warehouseStock    = allStock.find(
        s => s.location_id === warehouse.id && s.product_id === product.id
      )
      const warehouseAvailable = Number(warehouseStock?.quantity ?? 0)

      if (warehouseAvailable >= deficit.neededQty) {
        const tc = transportCosts.find(
          t => t.from_location_id === warehouse.id &&
               t.to_location_id   === deficit.stand.id
        )
        if (tc) {
          const qty  = deficit.neededQty
          const cost = tc.fixed_cost + (qty * product.weight_kg * tc.cost_per_kg)
          options.push({
            type: 'transfer', fromLocation: warehouse, qty, cost,
            leadTime: tc.lead_time_days,
            reason: `Depozit central (${warehouseAvailable} buc disponibile). Cost: ${cost.toFixed(2)} RON.`,
          })
        }
      }

      if (options.length === 0) continue

      const urgent = deficit.daysRemaining < 2
      const best   = urgent
        ? options.sort((a, b) => a.leadTime - b.leadTime)[0]
        : options.sort((a, b) => a.cost    - b.cost   )[0]

      const capNote = deficit.capAvailable < deficit.neededQty
        ? ` [cantitate limitată de capacitate stand: ${deficit.capAvailable} locuri libere]`
        : ''

      suggestions.push({
        product_id:       product.id,
        from_location_id: best.fromLocation?.id ?? null,
        to_location_id:   deficit.stand.id,
        suggested_qty:    best.qty,
        estimated_cost:   best.cost,
        status:           'pending',
        reason:
          `[${urgent ? 'URGENT' : 'NORMAL'}] ` +
          `${deficit.stand.name} va rămâne fără "${product.name}" în ` +
          `~${isFinite(deficit.daysRemaining) ? Math.round(deficit.daysRemaining) : '?'} zile. ` +
          best.reason + capNote,
      })
    }

    // ── 10. FLOW B — Stoc mort fără deficit corespondent ───────────────────────
    // Dacă avem stoc mort la un stand, dar niciun stand nu e în deficit,
    // sugerăm mutarea la standul care VINDE cel mai bine produsul respectiv.
    for (const stale of staleStands) {
      if (stale.movableQty <= 0) continue

      // Verificăm dacă stocul mort e deja acoperit de un transfer din Flow A
      const alreadyUsedAsSource = suggestions.some(
        s => s.product_id === product.id &&
             s.from_location_id === stale.stand.id
      )
      if (alreadyUsedAsSource) continue

      // Găsește cel mai bun destinatar: stand care vinde cel mai mult
      // produsul respectiv, NU e în deficit deja tratat, și are capacitate
      const candidates = stands
        .filter(s => s.id !== stale.stand.id)
        .map(s => {
          const velocity    = salesRates[`${s.id}-${product.id}`] || 0
          const tc          = transportCosts.find(
            t => t.from_location_id === stale.stand.id && t.to_location_id === s.id
          )
          const cap         = availableCapacity(s.id)
          const alreadyDest = suggestions.some(
            sg => sg.product_id === product.id && sg.to_location_id === s.id
          )
          return { stand: s, velocity, tc, cap, alreadyDest }
        })
        .filter(c =>
          c.velocity > 0 &&        // chiar vinde produsul
          c.tc != null  &&         // există rută de transport
          c.cap > 0     &&         // are loc
          !c.alreadyDest           // nu primește deja o sugestie pentru asta
        )
        .sort((a, b) => b.velocity - a.velocity)   // cel mai rapid mai întâi

      if (candidates.length === 0) continue

      const best     = candidates[0]
      const qty      = Math.min(stale.movableQty, best.cap, getSettings(best.stand.id).max_transfer_qty)
      const cost     = best.tc.fixed_cost + (qty * product.weight_kg * best.tc.cost_per_kg)

      if (qty <= 0) continue

      suggestions.push({
        product_id:       product.id,
        from_location_id: stale.stand.id,
        to_location_id:   best.stand.id,
        suggested_qty:    qty,
        estimated_cost:   cost,
        status:           'pending',
        reason:
          `[STOC-MORT] "${product.name}" la ${stale.stand.name} nu s-a vândut în ` +
          `${stale.staleDays} zile. Mutat la ${best.stand.name} ` +
          `(viteză vânzare: ${best.velocity.toFixed(2)} buc/zi). ` +
          `Cost: ${cost.toFixed(2)} RON.`,
      })
    }
  }

  // ── 11. Deduplicare (un singur rând per produs × destinație) ─────────────────
  const deduplicated = []
  const seen = new Set()
  for (const s of suggestions) {
    const key = `${s.product_id}-${s.to_location_id}`
    if (!seen.has(key)) {
      seen.add(key)
      deduplicated.push(s)
    }
  }

  if (deduplicated.length === 0) return []

  // ── 12. Fetch toate sugestiile pending existente ────────────────────────────
  // Cheia de deduplicare: produs × destinație (indiferent de sursă —
  // o sugestie pentru același produs la același stand e tot una, chiar dacă
  // sursa s-a schimbat între rulări)
  const { data: existingPending } = await supabase
    .from('reorder_suggestions')
    .select('*')
    .eq('status', 'pending')

  // Set de chei (product_id-to_location_id) deja acoperite de sugestii pending
  const existingDestKeys = new Set(
    (existingPending ?? []).map(s => `${s.product_id}-${s.to_location_id}`)
  )

  // ── 13. Adaugă DOAR sugestiile cu adevărat noi — nu atinge ce există deja ──
  // Logica: dacă există deja o sugestie pending pentru produsul X → standul Y,
  // nu creăm alta, indiferent dacă sursa recomandată s-a schimbat.
  // Sugestia veche rămâne activă până când userul o aprobă sau respinge.
  const trulyNew = deduplicated.filter(s => {
    const key = `${s.product_id}-${s.to_location_id}`
    return !existingDestKeys.has(key)
  })

  // Returnează toate pending (vechi + noi) ca să UI-ul afișeze tot
  if (trulyNew.length === 0) {
    return existingPending ?? []
  }

  const { data: inserted, error } = await supabase
    .from('reorder_suggestions')
    .insert(trulyNew)
    .select()

  if (error) throw new Error(`Eroare la salvarea sugestiilor: ${error.message}`)

  // Returnează sugestiile existente + cele nou inserate
  return [...(existingPending ?? []), ...(inserted ?? [])]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function calculateWeightedSalesRates(stands, products) {
  const rates = {}

  for (const days of DAYS_OPTIONS) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: sales } = await supabase
      .from('sales')
      .select('location_id, product_id, quantity')
      .gte('sold_at', since)

    for (const sale of sales ?? []) {
      const key = `${sale.location_id}-${sale.product_id}`
      if (!rates[key]) rates[key] = { weighted: 0 }
      rates[key].weighted += (Number(sale.quantity) / days) * WEIGHTS[days]
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
  return tc?.lead_time_days ?? 3
}