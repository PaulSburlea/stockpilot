import { Router } from 'express'
import supabase from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.post('/', async (req, res) => {
  const { product_id, to_location_id, quantity } = req.body

  if (!product_id || !to_location_id || !quantity) {
    return res.status(400).json({ error: 'product_id, to_location_id și quantity sunt obligatorii' })
  }

  try {
    const { data: product } = await supabase
      .from('products').select('*').eq('id', product_id).single()

    const { data: toLocation } = await supabase
      .from('locations').select('*').eq('id', to_location_id).single()

    const { data: stocks } = await supabase
      .from('stock').select('*, locations(*)').eq('product_id', product_id).neq('location_id', to_location_id)

    const { data: transportCosts } = await supabase
      .from('transport_costs').select('*').eq('to_location_id', to_location_id)

    // FIX: citim setările pentru locația destinație + toate sursele
    const { data: allSettings } = await supabase
      .from('location_settings').select('*')

    const getSettings = (locationId) => {
      const s = allSettings?.find(s => s.location_id === locationId)
      return {
        lead_time_days:      s?.lead_time_days      ?? 2,
        max_transfer_qty:    s?.max_transfer_qty     ?? 100,
        storage_capacity:    s?.storage_capacity     ?? 9999,
        safety_stock_multiplier: s?.safety_stock_multiplier ?? 1.0,
      }
    }

    // FIX: calculăm stocul total curent la destinație pentru verificarea capacității
    const { data: destStockRows } = await supabase
      .from('stock').select('quantity').eq('location_id', to_location_id)

    const destCurrentTotal = (destStockRows ?? []).reduce((sum, r) => sum + Number(r.quantity), 0)
    const destSettings     = getSettings(to_location_id)
    const destAvailableCap = Math.max(0, destSettings.storage_capacity - destCurrentTotal)

    // Avertizare dacă cantitatea cerută depășește capacitatea disponibilă
    const capacityWarning = destAvailableCap < quantity
      ? `Atenție: standul destinație are loc pentru ${destAvailableCap} buc (capacitate ${destSettings.storage_capacity}, ocupat ${destCurrentTotal}).`
      : null

    const options = []

    // ── Opțiunea A: Transfer din alte standuri cu surplus ──
    for (const stock of stocks) {
      if (stock.locations?.type === 'warehouse') continue

      const srcSettings = getSettings(stock.location_id)
      const effectiveSafetyStock = stock.safety_stock * srcSettings.safety_stock_multiplier

      // FIX: folosim safety_stock_multiplier din setări, nu hardcodat -10
      const availableForTransfer = Math.min(
        stock.quantity - effectiveSafetyStock - 10,
        srcSettings.max_transfer_qty   // FIX: respectă max_transfer_qty al sursei
      )
      if (availableForTransfer < quantity) continue

      const tc = transportCosts.find(t => t.from_location_id === stock.location_id)
      if (!tc) continue

      const transportCost = tc.fixed_cost + (quantity * product.weight_kg * tc.cost_per_kg)

      options.push({
        type: 'transfer',
        label: `Transfer din ${stock.locations.city}`,
        from_location_id: stock.location_id,
        from_location_name: stock.locations.name,
        from_city: stock.locations.city,
        available_stock: stock.quantity,
        transferable_qty: Math.floor(availableForTransfer),
        quantity,
        costs: {
          fixed: tc.fixed_cost,
          variable: parseFloat((quantity * product.weight_kg * tc.cost_per_kg).toFixed(2)),
          total: parseFloat(transportCost.toFixed(2)),
          per_unit: parseFloat((transportCost / quantity).toFixed(2)),
        },
        lead_time_days: tc.lead_time_days,
        total_cost: parseFloat(transportCost.toFixed(2)),
        pros: [
          'Valorifică stoc existent',
          'Nu implică achiziție nouă',
          tc.lead_time_days === 1 ? 'Livrare rapidă (1 zi)' : null,
        ].filter(Boolean),
        cons: [
          'Reduce stocul altei locații',
          tc.lead_time_days > 1 ? `Durează ${tc.lead_time_days} zile` : null,
        ].filter(Boolean),
      })
    }

    // ── Opțiunea A': Transfer din standuri cu stoc mort ──
// (surse care nu vând produsul — prioritate mai mică ca preț, dar valorifică stocul blocat)
    const { data: lastSalesForStale } = await supabase
      .from('sales')
      .select('location_id, sold_at')
      .eq('product_id', product_id)
      .order('sold_at', { ascending: false })

    const lastSaleByLocation = {}
    for (const s of lastSalesForStale ?? []) {
      if (!lastSaleByLocation[s.location_id]) lastSaleByLocation[s.location_id] = s.sold_at
    }

    for (const stock of stocks) {
      if (stock.locations?.type === 'warehouse') continue

      const srcSettings  = getSettings(stock.location_id)
      const threshold    = allSettings?.find(s => s.location_id === stock.location_id)?.stale_days_threshold ?? 60
      const lastSale     = lastSaleByLocation[stock.location_id]
      const daysSinceSale = lastSale
        ? Math.floor((Date.now() - new Date(lastSale).getTime()) / 86400000)
        : 9999

      // Nu e stoc mort → sărim (e tratat în opțiunea A)
      if (daysSinceSale < threshold) continue

      const effectiveSafetyStock  = stock.safety_stock * srcSettings.safety_stock_multiplier
      const availableFromStale    = Math.min(
        Math.floor(stock.quantity - effectiveSafetyStock),
        srcSettings.max_transfer_qty
      )
      if (availableFromStale < quantity) continue

      const tc = transportCosts.find(t => t.from_location_id === stock.location_id)
      if (!tc) continue

      // Verificăm să nu fi adăugat deja această sursă la opțiunea A
      const alreadyAdded = options.some(o => o.from_location_id === stock.location_id)
      if (alreadyAdded) continue

      const transportCost = tc.fixed_cost + (quantity * product.weight_kg * tc.cost_per_kg)

      options.push({
        type: 'transfer',
        label: `Transfer din ${stock.locations.city} (stoc blocat)`,
        from_location_id: stock.location_id,
        from_location_name: stock.locations.name,
        from_city: stock.locations.city,
        available_stock: stock.quantity,
        transferable_qty: availableFromStale,
        stale_days: daysSinceSale,   // info extra pentru UI
        quantity,
        costs: {
          fixed: tc.fixed_cost,
          variable: parseFloat((quantity * product.weight_kg * tc.cost_per_kg).toFixed(2)),
          total: parseFloat(transportCost.toFixed(2)),
          per_unit: parseFloat((transportCost / quantity).toFixed(2)),
        },
        lead_time_days: tc.lead_time_days,
        total_cost: parseFloat(transportCost.toFixed(2)),
        pros: [
          'Valorifică stoc blocat — dublu câștig',
          'Nu implică achiziție nouă',
          `Eliberează spațiu la ${stock.locations.name}`,
        ],
        cons: [
          `Produs nevândut ${daysSinceSale === 9999 ? 'niciodată' : `în ${daysSinceSale} zile`} la sursă`,
          tc.lead_time_days > 1 ? `Durează ${tc.lead_time_days} zile` : null,
        ].filter(Boolean),
      })
    }

    // ── Opțiunea B: Comandă din depozit central ──
    const warehouse   = stocks.find(s => s.locations?.type === 'warehouse')
    const warehouseTc = warehouse
      ? transportCosts.find(t => t.from_location_id === warehouse.location_id)
      : null

    if (warehouse && warehouseTc) {
      const transportCost = warehouseTc.fixed_cost +
        (quantity * product.weight_kg * warehouseTc.cost_per_kg)

      // FIX: lead_time_days din setările depozitului, nu doar din transport_costs
      const whSettings  = getSettings(warehouse.location_id)
      const effectiveLT = Math.max(warehouseTc.lead_time_days, whSettings.lead_time_days)

      options.push({
        type: 'warehouse',
        label: 'Comandă din depozit central',
        from_location_id: warehouse.location_id,
        from_location_name: warehouse.locations.name,
        from_city: warehouse.locations.city,
        available_stock: warehouse.quantity,
        transferable_qty: warehouse.quantity - warehouse.safety_stock,
        quantity,
        costs: {
          fixed: warehouseTc.fixed_cost,
          variable: parseFloat((quantity * product.weight_kg * warehouseTc.cost_per_kg).toFixed(2)),
          total: parseFloat(transportCost.toFixed(2)),
          per_unit: parseFloat((transportCost / quantity).toFixed(2)),
        },
        lead_time_days: effectiveLT,
        total_cost: parseFloat(transportCost.toFixed(2)),
        pros: [
          'Stoc garantat disponibil',
          'Nu afectează alte standuri',
          'Sursă principală de aprovizionare',
        ],
        cons: [
          `Durează ${effectiveLT} ${effectiveLT === 1 ? 'zi' : 'zile'}`,
          'Cost transport mai mare pe distanță lungă',
        ],
      })
    }

    // ── Opțiunea C: Comandă de la furnizor ──
    const supplierLeadTime      = 5
    const supplierTransportCost = quantity * product.weight_kg * 6.5 + 50
    const acquisitionCost       = quantity * product.unit_price
    const totalSupplierCost     = supplierTransportCost + acquisitionCost

    options.push({
      type: 'supplier',
      label: 'Comandă de la furnizor',
      from_location_id: null,
      from_location_name: 'Furnizor extern',
      from_city: null,
      available_stock: null,
      transferable_qty: null,
      quantity,
      costs: {
        acquisition: parseFloat(acquisitionCost.toFixed(2)),
        fixed: 50,
        variable: parseFloat((quantity * product.weight_kg * 6.5).toFixed(2)),
        total: parseFloat(totalSupplierCost.toFixed(2)),
        per_unit: parseFloat((totalSupplierCost / quantity).toFixed(2)),
      },
      lead_time_days: supplierLeadTime,
      total_cost: parseFloat(totalSupplierCost.toFixed(2)),
      pros: [
        'Stoc proaspăt, fără a afecta rețeaua',
        'Cantitate nelimitată',
        'Reface și stocul depozitului',
      ],
      cons: [
        `Lead time mai lung (${supplierLeadTime} zile)`,
        'Cost de achiziție suplimentar',
        'Necesită aprobare buget',
      ],
    })

    options.sort((a, b) => a.total_cost - b.total_cost)

    const recommended = options.find(o =>
      o.type === 'supplier' || (o.transferable_qty && o.transferable_qty >= quantity)
    )
    if (recommended) recommended.recommended = true

    res.json({
      product,
      to_location: toLocation,
      quantity,
      options,
      cheapest: options[0],
      fastest: [...options].sort((a, b) => a.lead_time_days - b.lead_time_days)[0],
      // FIX: avertizare capacitate returnată și la nivel de răspuns
      capacity_warning: capacityWarning,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router