import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'

import locationsRouter  from './routes/locations.js'
import productsRouter   from './routes/products.js'
import stockRouter      from './routes/stock.js'
import salesRouter      from './routes/sales.js'
import movementsRouter  from './routes/movements.js'
import suggestionsRouter from './routes/suggestions.js'
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'
import forecastRouter from './routes/forecast.js'
import costComparisonRouter from './routes/costcomparison.js'
import notificationsRouter from './routes/notifications.js'
import exportRouter from './routes/export.js'
import auditRouter from './routes/audit.js'
import settingsRouter from './routes/settings.js'

dotenv.config()

const app = express()

// Middleware global
app.use(helmet())
app.use(cors())
app.use(express.json())

// Rute
app.use('/api/auth', authRouter)
app.use('/api/locations',   locationsRouter)
app.use('/api/products',    productsRouter)
app.use('/api/stock',       stockRouter)
app.use('/api/sales',       salesRouter)
app.use('/api/movements',   movementsRouter)
app.use('/api/suggestions', suggestionsRouter)
app.use('/api/users', usersRouter)
app.use('/api/forecast', forecastRouter)
app.use('/api/cost-comparison', costComparisonRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/export', exportRouter)
app.use('/api/audit', auditRouter)
app.use('/api/settings', settingsRouter)


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() })
})

// Handler erori globale
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))