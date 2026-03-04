import { Router } from 'express'
import supabase from '../config/supabase.js'
import { logAction } from '../services/audit.js'

const router = Router()

// GET /api/products
router.get('/', async (req, res) => {
  const { category } = req.query  // filtrare opțională după categorie

  let query = supabase.from('products').select('*').order('category')
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/products/:id — produs + stoc în toate locațiile
router.get('/:id', async (req, res) => {
  const { id } = req.params

  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return res.status(404).json({ error: 'Product not found' })

  const { data: stock } = await supabase
    .from('stock')
    .select('*, locations(*)')
    .eq('product_id', id)

  res.json({ ...product, stock_by_location: stock })
})

// POST /api/products — adaugă produs nou
router.post('/', async (req, res) => {
  const { name, sku, category, unit_price, weight_kg } = req.body

  const { data, error } = await supabase
    .from('products')
    .insert([{ name, sku, category, unit_price, weight_kg }])
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  await logAction({
    user: req.user,
    action: 'CREATE',
    entity: 'product',
    entityId: data.id,
    description: `Produs nou creat: ${data.name} (${data.sku})`,
    metadata: { name: data.name, sku: data.sku, category: data.category },
    req,
  })
  res.status(201).json(data)
})

// PUT /api/products/:id — editează produs
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { name, sku, category, unit_price, weight_kg } = req.body

  const { data, error } = await supabase
    .from('products')
    .update({ name, sku, category, unit_price, weight_kg })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  await logAction({
    user: req.user,
    action: 'UPDATE',
    entity: 'product',
    entityId: Number(id),
    description: `Produs actualizat: ${data.name}`,
    metadata: req.body,
    req,
  })
  res.json(data)
})

// DELETE /api/products/:id — șterge produs
router.delete('/:id', async (req, res) => {
  const { id } = req.params

  // Verifică dacă are stoc activ înainte să ștergi
  const { data: stockExists } = await supabase
    .from('stock')
    .select('id, quantity')
    .eq('product_id', id)
    .gt('quantity', 0)
    .limit(1)

  if (stockExists && stockExists.length > 0) {
    return res.status(400).json({
      error: 'Nu poți șterge un produs cu stoc activ. Setează stocul la 0 mai întâi.'
    })
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) return res.status(400).json({ error: error.message })
  await logAction({
    user: req.user,
    action: 'DELETE',
    entity: 'product',
    entityId: Number(id),
    description: `Produs șters: ID ${id}`,
    req,
  })
  res.json({ success: true })
})

export default router