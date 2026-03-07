import { Router } from 'express'
import supabase from '../config/supabase.js'
import { logAction } from '../services/audit.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// GET /api/products
router.get('/', async (req, res) => {
  const { category } = req.query

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
// FIX: după inserarea produsului, creăm automat rânduri de stoc (qty=0) pentru
//      toate locațiile existente, altfel produsul nu apare în pagina de stocuri.
router.post('/', async (req, res) => {
  const { name, sku, category, unit_price, weight_kg } = req.body

  // 1. Inserează produsul
  const { data: product, error: productError } = await supabase
    .from('products')
    .insert([{ name, sku, category, unit_price, weight_kg }])
    .select()
    .single()

  if (productError) return res.status(400).json({ error: productError.message })

  // 2. Fetch toate locațiile
  const { data: locations, error: locationsError } = await supabase
    .from('locations')
    .select('id')

  if (locationsError) {
    // Produsul a fost creat, dar nu am putut crea stocurile — logăm și continuăm
    console.error('Nu s-au putut fetcha locațiile pentru init stoc:', locationsError.message)
  } else if (locations && locations.length > 0) {
    // 3. Inserează rânduri de stoc qty=0 pentru fiecare locație
    //    safety_stock default = 5 (poate fi ajustat manual ulterior din pagina de stocuri)
    const stockRows = locations.map(loc => ({
      product_id:   product.id,
      location_id:  loc.id,
      quantity:     0,
      safety_stock: 5,
    }))

    const { error: stockError } = await supabase
      .from('stock')
      .insert(stockRows)

    if (stockError) {
      // Nu blocăm răspunsul — produsul există, doar stocul n-a fost inițializat
      console.error('Eroare la inițializarea stocului pentru produs nou:', stockError.message)
    }
  }

  await logAction({
    user: req.user,
    action: 'CREATE',
    entity: 'product',
    entityId: product.id,
    description: `Produs nou creat: ${product.name} (${product.sku})`,
    metadata: {
      name: product.name,
      sku: product.sku,
      category: product.category,
      locations_initialized: locations?.length ?? 0,
    },
    req,
  })

  res.status(201).json(product)
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

  // Șterge mai întâi rândurile de stoc (qty=0), altfel FK constraint va bloca
  await supabase.from('stock').delete().eq('product_id', id)

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