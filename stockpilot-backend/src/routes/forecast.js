import { Router } from 'express'
import supabase from '../config/supabase.js'

const router = Router()

// GET /api/forecast?location_id=2&product_id=5
router.get('/', async (req, res) => {
  const { location_id, product_id } = req.query

  try {
    // 1. Ia stocurile curente
    let stockQuery = supabase
      .from('stock')
      .select('*, products(*), locations(*)')

    if (location_id) stockQuery = stockQuery.eq('location_id', location_id)
    if (product_id)  stockQuery = stockQuery.eq('product_id', product_id)

    const { data: stocks, error: stockError } = await stockQuery
    if (stockError) return res.status(500).json({ error: stockError.message })

    // 2. Ia vânzările din ultimele 90 zile
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    let salesQuery = supabase
      .from('sales')
      .select('location_id, product_id, quantity, sold_at')
      .gte('sold_at', since90)

    if (location_id) salesQuery = salesQuery.eq('location_id', location_id)
    if (product_id)  salesQuery = salesQuery.eq('product_id', product_id)

    const { data: sales, error: salesError } = await salesQuery
    if (salesError) return res.status(500).json({ error: salesError.message })

    // 3. Calculează forecast pentru fiecare stoc
    const forecasts = stocks.map(stock => {
      const key = `${stock.location_id}-${stock.product_id}`

      const salesLast90 = sales.filter(s =>
        s.location_id === stock.location_id &&
        s.product_id === stock.product_id
      )
      const salesLast60 = salesLast90.filter(s => s.sold_at >= since60)
      const salesLast30 = salesLast90.filter(s => s.sold_at >= since30)

      const sum = arr => arr.reduce((s, i) => s + i.quantity, 0)

      const avg90 = sum(salesLast90) / 90
      const avg60 = sum(salesLast60) / 60
      const avg30 = sum(salesLast30) / 30

      // Weighted moving average — zilele recente au mai multă greutate
      const weightedAvg = (avg30 * 0.5) + (avg60 * 0.3) + (avg90 * 0.2)
      const dailyRate = Math.max(weightedAvg, 0.01) // minim 0.01 ca să nu împărțim la 0

      const availableStock = stock.quantity - stock.safety_stock
      const daysUntilStockout = availableStock > 0
        ? Math.floor(availableStock / dailyRate)
        : 0

      // Generează puncte de proiecție zilnică pentru 90 zile
      const projectionPoints = []
      for (let day = 0; day <= 90; day++) {
        const projectedQty = Math.max(
          stock.quantity - (dailyRate * day),
          0
        )
        projectionPoints.push({
          day,
          date: new Date(Date.now() + day * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0],
          projected_stock: Math.round(projectedQty),
          safety_stock: stock.safety_stock,
        })
      }

      return {
        location_id: stock.location_id,
        product_id: stock.product_id,
        location_name: stock.locations?.name,
        location_city: stock.locations?.city,
        product_name: stock.products?.name,
        product_sku: stock.products?.sku,
        product_category: stock.products?.category,
        current_stock: stock.quantity,
        safety_stock: stock.safety_stock,
        daily_rate: parseFloat(dailyRate.toFixed(2)),
        avg_daily_30: parseFloat(avg30.toFixed(2)),
        avg_daily_60: parseFloat(avg60.toFixed(2)),
        avg_daily_90: parseFloat(avg90.toFixed(2)),
        days_until_stockout: daysUntilStockout,
        stockout_date: new Date(Date.now() + daysUntilStockout * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0],
        forecast_30: Math.max(Math.round(stock.quantity - dailyRate * 30), 0),
        forecast_60: Math.max(Math.round(stock.quantity - dailyRate * 60), 0),
        forecast_90: Math.max(Math.round(stock.quantity - dailyRate * 90), 0),
        projection: projectionPoints,
        risk_level:
          daysUntilStockout <= 7  ? 'critical' :
          daysUntilStockout <= 20 ? 'warning' :
          daysUntilStockout <= 45 ? 'normal' : 'safe',
      }
    })

    // Sortează după risc — cele mai critice primele
    const riskOrder = { critical: 0, warning: 1, normal: 2, safe: 3 }
    forecasts.sort((a, b) => riskOrder[a.risk_level] - riskOrder[b.risk_level])

    res.json(forecasts)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router