import supabase from '../config/supabase.js'

// ── Ferestre exclusive pentru rate ponderate ─────────────────────────────────
const WINDOWS = [
  { days: 30, from: 0,  to: 30, weight: 0.5 },
  { days: 30, from: 30, to: 60, weight: 0.3 },
  { days: 30, from: 60, to: 90, weight: 0.2 },
]
const LAST_SALE_LOOKBACK_DAYS = 730

export async function generateSuggestions() {
  const suggestions = []

  // ── 1. Fetch date ─────────────────────────────────────────────────────────
  const { data: stands }         = await supabase.from('locations').select('*').eq('type', 'stand')
  const { data: warehouse }      = await supabase.from('locations').select('*').eq('type', 'warehouse').limit(1).single()
  const { data: products }       = await supabase.from('products').select('*')
  const { data: allStock }       = await supabase.from('stock').select('*')
  const { data: transportCosts } = await supabase.from('transport_costs').select('*')
  const { data: allSettings }    = await supabase.from('location_settings').select('*')

  if (!warehouse) throw new Error('Depozitul central nu a fost găsit')

  // ── 2. Ultima vânzare per produs × stand + vânzări 30 zile ───────────────
  const lookbackDate = new Date(Date.now() - LAST_SALE_LOOKBACK_DAYS * 86400000).toISOString()
  const { data: recentSalesRaw } = await supabase
    .from('sales').select('location_id, product_id, sold_at, quantity')
    .gte('sold_at', lookbackDate).order('sold_at', { ascending: false })

  const lastSaleMap    = {}  // key → ISO ultima vânzare
  const last30DaySales = {}  // key → total unități 30 zile
  for (const sale of recentSalesRaw ?? []) {
    const key     = `${sale.location_id}-${sale.product_id}`
    const daysAgo = (Date.now() - new Date(sale.sold_at).getTime()) / 86400000
    if (!lastSaleMap[key]) lastSaleMap[key] = sale.sold_at
    if (daysAgo <= 30) {
      last30DaySales[key] = (last30DaySales[key] ?? 0) + Number(sale.quantity)
    }
  }

  // ── 3. Stoc total per stand (pentru capacitate) ───────────────────────────
  const totalStockPerStand = {}
  for (const s of allStock ?? []) {
    totalStockPerStand[s.location_id] = (totalStockPerStand[s.location_id] ?? 0) + Number(s.quantity)
  }

  // ── 4. Stoc depozit mutabil per produs ────────────────────────────────────
  const warehouseStockMutable = {}
  for (const s of allStock ?? []) {
    if (s.location_id === warehouse.id) {
      warehouseStockMutable[s.product_id] = Number(s.quantity)
    }
  }

  // ── 5. Helper settings ────────────────────────────────────────────────────
  const getSettings = (standId) => {
    const s = allSettings?.find(s => s.location_id === standId)
    return {
      lead_time_days:          s?.lead_time_days          ?? 2,
      safety_stock_multiplier: s?.safety_stock_multiplier ?? 1.0,
      reorder_threshold_days:  s?.reorder_threshold_days  ?? 14,
      surplus_threshold_days:  s?.surplus_threshold_days  ?? 100,
      max_transfer_qty:            s?.max_transfer_qty             ?? 200,
      min_transfer_qty:            s?.min_transfer_qty             ?? 5,
      auto_suggestions:            s?.auto_suggestions             ?? true,
      stale_days_threshold:        s?.stale_days_threshold        ?? 60,
      storage_capacity:            s?.storage_capacity            ?? 9999,
      // Raport maxim transport / valoare marfă (ex. 0.25 = transport ≤ 25% din valoarea mutată)
      // Sub acest prag transferul nu e rentabil economic
      max_transport_cost_ratio:    s?.max_transport_cost_ratio    ?? 0.25,
    }
  }

  // null = niciodată vândut; număr = zile de la ultima vânzare
  const daysSinceLastSale = (standId, productId) => {
    const lastSale = lastSaleMap[`${standId}-${productId}`]
    if (!lastSale) return null
    return Math.floor((Date.now() - new Date(lastSale).getTime()) / 86400000)
  }

  const hasEverBeenSold = (standId, productId) =>
    lastSaleMap[`${standId}-${productId}`] != null

  const availableCapacity = (standId) => {
    const settings = getSettings(standId)
    return Math.max(0, settings.storage_capacity - (totalStockPerStand[standId] ?? 0))
  }

  // ── Helper ROI transport ─────────────────────────────────────────────────
  // Returnează false dacă costul de transport depășește X% din valoarea mărfii mutate
  // Evită situații absurde: 38 RON transport pentru 1 buc de 15 RON
  const isWorthTransferring = (cost, qty, unitPrice, maxRatio) => {
    if (!cost || !qty || !unitPrice || unitPrice <= 0) return true  // nu putem evalua, permitem
    const merchandiseValue = qty * unitPrice
    return (cost / merchandiseValue) <= maxRatio
  }

  // ── 6. Rate de vânzare ponderate ──────────────────────────────────────────
  const salesRates = await calculateWeightedSalesRates()

  // ── 7. Identifică categorii per produs × stand ────────────────────────────
  for (const product of products) {
    const deficitStands    = []
    const surplusStands    = []
    const staleStands      = []
    const noTractionStands = []  // niciodată vândut la standul ăsta

    for (const stand of stands) {
      const settings = getSettings(stand.id)
      if (!settings.auto_suggestions) continue

      const stock = allStock.find(s => s.location_id === stand.id && s.product_id === product.id)
      if (!stock || Number(stock.quantity) === 0) continue

      const qty                  = Number(stock.quantity)
      const effectiveSafetyStock = Number(stock.safety_stock) * settings.safety_stock_multiplier
      const dailySales           = salesRates[`${stand.id}-${product.id}`] || 0
      const daysRemaining        = dailySales > 0 ? (qty - effectiveSafetyStock) / dailySales : Infinity
      const leadTime             = getLeadTime(warehouse.id, stand.id, transportCosts)
      const staleDays            = daysSinceLastSale(stand.id, product.id)
      const everSold             = hasEverBeenSold(stand.id, product.id)
      const capAvailable         = availableCapacity(stand.id)
      const soldLast30Days       = last30DaySales[`${stand.id}-${product.id}`] ?? 0
      const movableQty           = Math.min(
        Math.floor(qty - effectiveSafetyStock),
        settings.max_transfer_qty
      )

      // ── DEFICIT ───────────────────────────────────────────────────────────
      if (isFinite(daysRemaining) && daysRemaining < leadTime + settings.lead_time_days) {
        const neededQty = Math.min(
          Math.ceil(dailySales * (leadTime + settings.lead_time_days + settings.reorder_threshold_days)),
          settings.max_transfer_qty,
          capAvailable
        )
        if (neededQty >= settings.min_transfer_qty) {
          deficitStands.push({
            stand, stock, qty, dailySales, daysRemaining, leadTime,
            neededQty, capAvailable, settings, staleDays, soldLast30Days,
          })
        }
        continue
      }

      // ── FĂRĂ TRACȚIUNE — niciodată vândut, stoc > safety_stock ───────────
      if (!everSold && movableQty >= settings.min_transfer_qty) {
        noTractionStands.push({ stand, stock, qty, movableQty, settings })
        continue
      }

      // ── STOC MORT — a fost vândut cândva, dar a stagnat peste prag ────────
      if (everSold && staleDays !== null && staleDays >= settings.stale_days_threshold && movableQty >= settings.min_transfer_qty) {
        staleStands.push({
          stand, stock, qty, dailySales: 0, daysRemaining: Infinity,
          staleDays, movableQty, settings, soldLast30Days,
        })
        continue
      }

      // ── SURPLUS NORMAL ────────────────────────────────────────────────────
      if (isFinite(daysRemaining) && daysRemaining > settings.surplus_threshold_days) {
        const transferableQty = Math.min(
          Math.floor(qty - effectiveSafetyStock - (dailySales * 30)),
          settings.max_transfer_qty
        )
        if (transferableQty > 0) {
          surplusStands.push({ stand, stock, qty, dailySales, daysRemaining, transferableQty, settings })
        }
      }
    }

    // ── 8. FLOW A — Deficit ← sursă ──────────────────────────────────────────
    for (const deficit of deficitStands) {
      const options = []

      const tcWarehouseRef = transportCosts.find(
        t => t.from_location_id === warehouse.id && t.to_location_id === deficit.stand.id
      )
      const warehouseRefCost = tcWarehouseRef
        ? tcWarehouseRef.fixed_cost + (deficit.neededQty * product.weight_kg * tcWarehouseRef.cost_per_kg)
        : null

      // A1: surplus stand
      for (const surplus of surplusStands) {
        if (surplus.transferableQty <= 0 || surplus.stand.id === deficit.stand.id) continue
        const tc = transportCosts.find(
          t => t.from_location_id === surplus.stand.id && t.to_location_id === deficit.stand.id
        )
        if (!tc) continue
        const qty     = Math.min(deficit.neededQty, surplus.transferableQty)
        const cost    = tc.fixed_cost + (qty * product.weight_kg * tc.cost_per_kg)
        const savings = warehouseRefCost != null ? warehouseRefCost - cost : null
        options.push({
          type: 'surplus_stand', fromLocation: surplus.stand, qty, cost,
          leadTime: tc.lead_time_days, surplusDaysRemaining: Math.round(surplus.daysRemaining), savings,
          reason: buildReason('surplus', {
            sourceName: surplus.stand.name, sourceCity: surplus.stand.city, sourceQty: surplus.qty,
            surplus_days: Math.round(surplus.daysRemaining), destName: deficit.stand.name,
            qty, cost, leadTime: tc.lead_time_days, savings, warehouseRefCost,
          }),
        })
      }

      // A2: stoc mort stand
      for (const stale of staleStands) {
        if (stale.movableQty <= 0 || stale.stand.id === deficit.stand.id) continue
        const tc = transportCosts.find(
          t => t.from_location_id === stale.stand.id && t.to_location_id === deficit.stand.id
        )
        if (!tc) continue
        const qty     = Math.min(deficit.neededQty, stale.movableQty)
        const cost    = tc.fixed_cost + (qty * product.weight_kg * tc.cost_per_kg)
        const savings = warehouseRefCost != null ? warehouseRefCost - cost : null
        options.push({
          type: 'stale_stand', fromLocation: stale.stand, qty, cost,
          leadTime: tc.lead_time_days, staleDays: stale.staleDays, savings,
          reason: buildReason('stale_source', {
            sourceName: stale.stand.name, sourceCity: stale.stand.city, sourceQty: stale.qty,
            staleDays: stale.staleDays, destName: deficit.stand.name,
            qty, cost, leadTime: tc.lead_time_days, savings, warehouseRefCost,
          }),
        })
      }

      // A3: depozit central
      const warehouseAvailable = warehouseStockMutable[product.id] ?? 0
      if (warehouseAvailable >= deficit.neededQty && tcWarehouseRef) {
        const qty  = deficit.neededQty
        const cost = warehouseRefCost
        options.push({
          type: 'warehouse', fromLocation: warehouse, qty, cost,
          leadTime: tcWarehouseRef.lead_time_days, savings: 0,
          reason: buildReason('warehouse', {
            sourceName: warehouse.name, sourceCity: warehouse.city, sourceQty: warehouseAvailable,
            destName: deficit.stand.name, qty, cost, leadTime: tcWarehouseRef.lead_time_days,
          }),
        })
      }

      // A4: comandă furnizor
      if (options.length === 0) {
        suggestions.push({
          product_id: product.id, from_location_id: null, to_location_id: warehouse.id,
          suggested_qty: deficit.neededQty * Math.max(1, deficitStands.length),
          estimated_cost: null, status: 'pending',
          reason: buildReason('supplier', {
            destName: deficit.stand.name, productName: product.name,
            daysRemaining: Math.round(deficit.daysRemaining), dailySales: deficit.dailySales,
          }),
        })
        continue
      }

      // Filtrăm opțiunile care nu sunt rentabile economic
      // Excepție: dacă e CRITIC (daysLeft < 2) lăsăm toate opțiunile — e urgență, ROI e secundar
      const maxRatio   = deficit.settings.max_transport_cost_ratio
      const isCritic   = deficit.daysRemaining < 2
      const worthwhile = isCritic
        ? options
        : options.filter(o => isWorthTransferring(o.cost, o.qty, product.unit_price, maxRatio))

      // Dacă toate opțiunile sunt nerentabile, escaladăm la furnizor
      if (worthwhile.length === 0) {
        suggestions.push({
          product_id: product.id, from_location_id: null, to_location_id: warehouse.id,
          suggested_qty: deficit.neededQty * Math.max(1, deficitStands.length),
          estimated_cost: null, status: 'pending',
          reason: buildReason('supplier', {
            destName: deficit.stand.name, productName: product.name,
            daysRemaining: Math.round(deficit.daysRemaining), dailySales: deficit.dailySales,
            skippedOptions: options.length,
            skipReason: `transport depășea ${Math.round(maxRatio * 100)}% din valoarea mărfii`,
          }),
        })
        continue
      }

      const daysLeft   = deficit.daysRemaining
      const isUrgentDf = daysLeft < 5
      const best       = isCritic
        ? worthwhile.sort((a, b) => a.leadTime - b.leadTime)[0]
        : worthwhile.sort((a, b) => a.cost - b.cost)[0]

      if (best.fromLocation?.id === warehouse.id) {
        warehouseStockMutable[product.id] = (warehouseStockMutable[product.id] ?? 0) - best.qty
      }
      const usedSurplus = surplusStands.find(s => s.stand.id === best.fromLocation?.id)
      if (usedSurplus) usedSurplus.transferableQty -= best.qty

      const urgencyTag = isCritic ? '[CRITIC]' : isUrgentDf ? '[URGENT]' : '[NORMAL]'
      const capNote    = deficit.capAvailable < deficit.neededQty
        ? `cantitate limitată de capacitate stand (${deficit.capAvailable} locuri libere)` : null

      const transportCostRatio = best.cost && product.unit_price
        ? Math.round((best.cost / (best.qty * product.unit_price)) * 100)
        : null

      suggestions.push({
        product_id: product.id, from_location_id: best.fromLocation?.id ?? null,
        to_location_id: deficit.stand.id, suggested_qty: best.qty,
        estimated_cost: best.cost, status: 'pending',
        reason: buildReason('deficit', {
          urgencyTag, destName: deficit.stand.name, destCity: deficit.stand.city,
          productName: product.name, daysRemaining: Math.round(daysLeft),
          dailySales: deficit.dailySales, soldLast30Days: deficit.soldLast30Days,
          currentQty: deficit.qty, safetyStock: Number(deficit.stock.safety_stock),
          sourceReason: best.reason, savings: best.savings, capNote,
          allOptions: options.length, worthwhileOptions: worthwhile.length,
          chosenType: best.type, transportCostRatio,
        }),
      })
    }

    // ── 9. FLOW B — Stoc mort fără deficit ────────────────────────────────────
    for (const stale of staleStands) {
      if (stale.movableQty <= 0) continue
      const alreadySource = suggestions.some(
        s => s.product_id === product.id && s.from_location_id === stale.stand.id
      )
      if (alreadySource) continue

      const candidates = stands
        .filter(s => s.id !== stale.stand.id)
        .map(s => {
          const velocity     = salesRates[`${s.id}-${product.id}`] || 0
          const tc           = transportCosts.find(
            t => t.from_location_id === stale.stand.id && t.to_location_id === s.id
          )
          const destStock    = allStock.find(ds => ds.location_id === s.id && ds.product_id === product.id)
          const destSettings = getSettings(s.id)
          const destQty      = Number(destStock?.quantity ?? 0)
          const destSafety   = Number(destStock?.safety_stock ?? 0) * destSettings.safety_stock_multiplier
          const destDaysLeft = velocity > 0 ? (destQty - destSafety) / velocity : Infinity
          const cap          = availableCapacity(s.id)
          const alreadyDest  = suggestions.some(sg => sg.product_id === product.id && sg.to_location_id === s.id)
          const soldLast30   = last30DaySales[`${s.id}-${product.id}`] ?? 0
          return { stand: s, velocity, tc, cap, alreadyDest, destDaysLeft, destSettings, destQty, soldLast30 }
        })
        .filter(c =>
          c.velocity > 0 && c.tc != null && c.cap > 0 && !c.alreadyDest &&
          isFinite(c.destDaysLeft) && c.destDaysLeft < c.destSettings.surplus_threshold_days
        )
        .sort((a, b) => b.velocity - a.velocity)

      if (candidates.length === 0) continue

      const best = candidates[0]
      const qty  = Math.min(stale.movableQty, best.cap, best.destSettings.max_transfer_qty)
      const cost = best.tc.fixed_cost + (qty * product.weight_kg * best.tc.cost_per_kg)
      if (qty < stale.settings.min_transfer_qty) continue

      // Verificare rentabilitate: redistribuirea stocului mort nu e urgentă,
      // deci aplicăm pragul ROI strict
      const staleMaxRatio = stale.settings.max_transport_cost_ratio
      if (!isWorthTransferring(cost, qty, product.unit_price, staleMaxRatio)) continue

      suggestions.push({
        product_id: product.id, from_location_id: stale.stand.id, to_location_id: best.stand.id,
        suggested_qty: qty, estimated_cost: cost, status: 'pending',
        reason: buildReason('stale_redistribution', {
          sourceName: stale.stand.name, sourceCity: stale.stand.city, sourceQty: stale.qty,
          staleDays: stale.staleDays, staleThreshold: stale.settings.stale_days_threshold,
          destName: best.stand.name, destCity: best.stand.city,
          destVelocity: best.velocity, destQty: best.destQty,
          destDaysLeft: Math.round(best.destDaysLeft), soldLast30: best.soldLast30,
          qty, cost, leadTime: best.tc.lead_time_days, otherCandidates: candidates.length - 1,
        }),
      })
    }

    // ── 10. FLOW C — Stoc fără tracțiune → depozit ────────────────────────────
    // Produse cu stoc > safety_stock NICIODATĂ vândute la standul ăsta.
    // Decizie: le trimitem la depozit (nu la alt stand) pentru că:
    //   1. Nu avem dovezi că produsul funcționează la vreun stand
    //   2. Depozitul poate redistribui corect când apare un stand cu cerere dovedită
    //   3. Alternativ, poate fi returnat la furnizor
    for (const noTraction of noTractionStands) {
      const alreadyExists = suggestions.some(
        s => s.product_id === product.id
          && s.from_location_id === noTraction.stand.id
          && s.to_location_id === warehouse.id
      )
      if (alreadyExists) continue

      const tc = transportCosts.find(
        t => t.from_location_id === noTraction.stand.id && t.to_location_id === warehouse.id
      )
      if (!tc) continue

      const qty = noTraction.movableQty
      if (qty < noTraction.settings.min_transfer_qty) continue

      const cost = tc.fixed_cost + (qty * product.weight_kg * tc.cost_per_kg)

      // Verificare rentabilitate pentru returnare la depozit
      const noTrMaxRatio = noTraction.settings.max_transport_cost_ratio
      if (!isWorthTransferring(cost, qty, product.unit_price, noTrMaxRatio)) continue

      const transportCostRatioNt = product.unit_price
        ? Math.round((cost / (qty * product.unit_price)) * 100)
        : null

      // Produsul se vinde la alte standuri din rețea?
      const soldElsewhere = stands
        .filter(s => s.id !== noTraction.stand.id)
        .some(s => (salesRates[`${s.id}-${product.id}`] ?? 0) > 0)

      suggestions.push({
        product_id:       product.id,
        from_location_id: noTraction.stand.id,
        to_location_id:   warehouse.id,
        suggested_qty:    qty,
        estimated_cost:   cost,
        status:           'pending',
        reason: buildReason('no_traction', {
          sourceName:           noTraction.stand.name,
          sourceCity:           noTraction.stand.city,
          sourceQty:            noTraction.qty,
          movableQty:           qty,
          destName:             warehouse.name,
          cost,
          leadTime:             tc.lead_time_days,
          soldElsewhere,
          productName:          product.name,
          transportCostRatio:   transportCostRatioNt,
        }),
      })
    }
  }

  // ── 11. Deduplicare ──────────────────────────────────────────────────────────
  // Cheia include și from pentru a nu bloca sugestiile no_traction (to = warehouse)
  const deduplicated = []
  const seen = new Set()
  for (const s of suggestions) {
    const key = `${s.product_id}-${s.to_location_id}-${s.from_location_id ?? 'ext'}`
    if (!seen.has(key)) {
      seen.add(key)
      deduplicated.push(s)
    }
  }
  if (deduplicated.length === 0) return []

  // ── 12. Sincronizare cu pending existente ────────────────────────────────────
  // La fiecare re-rulare:
  //   • Sugestiile pending care NU mai apar în noul set → superseded
  //     (au fost filtrate de min_transfer_qty, ROI, situația s-a schimbat etc.)
  //   • Sugestiile din noul set care NU există deja → inserate ca pending
  //   • Sugestiile din noul set care EXISTĂ deja → lăsate neatinse (user le poate vedea)
  //
  // Rezultat: la fiecare rulare setul pending reflectă exact starea curentă

  const { data: existingPending } = await supabase
    .from('reorder_suggestions').select('*').eq('status', 'pending')

  const newKeySet = new Set(
    deduplicated.map(s => `${s.product_id}-${s.to_location_id}-${s.from_location_id ?? 'ext'}`)
  )

  // Sugestii care nu mai sunt valide — le supersedăm
  const toSupersede = (existingPending ?? []).filter(
    s => !newKeySet.has(`${s.product_id}-${s.to_location_id}-${s.from_location_id ?? 'ext'}`)
  )
  if (toSupersede.length > 0) {
    await supabase
      .from('reorder_suggestions')
      .update({ status: 'superseded' })
      .in('id', toSupersede.map(s => s.id))
  }

  // Sugestii rămase valide (nu supersede-uite)
  const survivingKeys = new Set(
    (existingPending ?? [])
      .filter(s => !toSupersede.some(sup => sup.id === s.id))
      .map(s => `${s.product_id}-${s.to_location_id}-${s.from_location_id ?? 'ext'}`)
  )

  // Sugestii noi care nu există deja
  const trulyNew = deduplicated.filter(
    s => !survivingKeys.has(`${s.product_id}-${s.to_location_id}-${s.from_location_id ?? 'ext'}`)
  )

  const surviving = (existingPending ?? []).filter(
    s => !toSupersede.some(sup => sup.id === s.id)
  )

  if (trulyNew.length === 0) return surviving

  const { data: inserted, error } = await supabase
    .from('reorder_suggestions').insert(trulyNew).select()

  if (error) throw new Error(`Eroare la salvarea sugestiilor: ${error.message}`)
  return [...surviving, ...(inserted ?? [])]
}

// ── Builder de reasons structurate ────────────────────────────────────────────
function buildReason(type, data) {
  try {
    return JSON.stringify({ type, ...data })
  } catch {
    return `[${type.toUpperCase()}] ${JSON.stringify(data)}`
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
async function calculateWeightedSalesRates() {
  const rates = {}
  const now   = Date.now()
  for (const window of WINDOWS) {
    const fromDate = new Date(now - window.to   * 86400000).toISOString()
    const toDate   = new Date(now - window.from * 86400000).toISOString()
    const { data: sales } = await supabase
      .from('sales').select('location_id, product_id, quantity')
      .gte('sold_at', fromDate).lt('sold_at', toDate)
    for (const sale of sales ?? []) {
      const key = `${sale.location_id}-${sale.product_id}`
      if (!rates[key]) rates[key] = { weighted: 0 }
      rates[key].weighted += (Number(sale.quantity) / window.days) * window.weight
    }
  }
  return Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, v.weighted]))
}

function getLeadTime(fromId, toId, transportCosts) {
  const tc = transportCosts.find(t => t.from_location_id === fromId && t.to_location_id === toId)
  return tc?.lead_time_days ?? 3
}