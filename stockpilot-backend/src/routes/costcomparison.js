import { Router } from 'express'
import supabase from '../config/supabase.js'

const router = Router()

// POST /api/cost-comparison
// Body: { product_id, to_location_id, quantity }
router.post('/', async (req, res) => {
  const { product_id, to_location_id, quantity } = req.body

  if (!product_id || !to_location_id || !quantity) {
    return res.status(400).json({ error: 'product_id, to_location_id și quantity sunt obligatorii' })
  }

  try {
    // 1. Ia produsul
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single()

    // 2. Ia locația destinație
    const { data: toLocation } = await supabase
      .from('locations')
      .select('*')
      .eq('id', to_location_id)
      .single()

    // 3. Ia toate stocurile pentru produsul respectiv
    const { data: stocks } = await supabase
      .from('stock')
      .select('*, locations(*)')
      .eq('product_id', product_id)
      .neq('location_id', to_location_id)

    // 4. Ia toate costurile de transport
    const { data: transportCosts } = await supabase
      .from('transport_costs')
      .select('*')
      .eq('to_location_id', to_location_id)

    const options = []

    // ── Opțiunea A: Transfer din alte standuri cu surplus ──
    for (const stock of stocks) {
      if (stock.locations?.type === 'warehouse') continue // depozitul e separat

      const availableForTransfer = stock.quantity - stock.safety_stock - 10
      if (availableForTransfer < quantity) continue

      const tc = transportCosts.find(t => t.from_location_id === stock.location_id)
      if (!tc) continue

      const transportCost = tc.fixed_cost + (quantity * product.weight_kg * tc.cost_per_kg)
      const totalCost = transportCost

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
          total: parseFloat(totalCost.toFixed(2)),
          per_unit: parseFloat((totalCost / quantity).toFixed(2)),
        },
        lead_time_days: tc.lead_time_days,
        total_cost: parseFloat(totalCost.toFixed(2)),
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

    // ── Opțiunea B: Comandă din depozit central ──
    const warehouse = stocks.find(s => s.locations?.type === 'warehouse')
    const warehouseTc = transportCosts.find(t => {
      const warehouseStock = stocks.find(s => s.locations?.type === 'warehouse')
      return warehouseStock && t.from_location_id === warehouseStock.location_id
    })

    if (warehouse && warehouseTc) {
      const transportCost = warehouseTc.fixed_cost +
        (quantity * product.weight_kg * warehouseTc.cost_per_kg)

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
        lead_time_days: warehouseTc.lead_time_days,
        total_cost: parseFloat(transportCost.toFixed(2)),
        pros: [
          'Stoc garantat disponibil',
          'Nu afectează alte standuri',
          'Sursă principală de aprovizionare',
        ],
        cons: [
          `Durează ${warehouseTc.lead_time_days} ${warehouseTc.lead_time_days === 1 ? 'zi' : 'zile'}`,
          'Cost transport mai mare pe distanță lungă',
        ],
      })
    }

    // ── Opțiunea C: Comandă de la furnizor ──
    const supplierLeadTime = 5
    const supplierTransportCost = quantity * product.weight_kg * 6.5 + 50
    const acquisitionCost = quantity * product.unit_price
    const totalSupplierCost = supplierTransportCost + acquisitionCost

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

    // Sortează după cost total
    options.sort((a, b) => a.total_cost - b.total_cost)

    // Marchează opțiunea recomandată (cea mai ieftină cu stoc suficient)
    const recommended = options.find(o =>
      o.type === 'supplier' ||
      (o.transferable_qty && o.transferable_qty >= quantity)
    )
    if (recommended) recommended.recommended = true

    res.json({
      product,
      to_location: toLocation,
      quantity,
      options,
      cheapest: options[0],
      fastest: [...options].sort((a, b) => a.lead_time_days - b.lead_time_days)[0],
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router