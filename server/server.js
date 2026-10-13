import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createPrismaClient } from './src/db.js'
import { createApi } from './src/api.js'

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Set DATABASE_URL and JWT_SECRET in server/.env before starting the API.')
  process.exit(1)
}

const prisma = createPrismaClient()
const app = express()
const port = Number(process.env.PORT) || 5000
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

app.disable('x-powered-by')
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: clientOrigin, credentials: true }))
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a little before trying again.' },
})

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api', createApi(prisma, loginLimiter))
app.use((error, _req, res, _next) => {
  console.error('API request failed.')
  if (error.code === 'P2025') return res.status(404).json({ error: 'The requested record was not found.' })
  if (error.code === 'P2003') return res.status(400).json({ error: 'This change conflicts with related records.' })
  return res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

const server = app.listen(port, () => console.log(`API listening on http://localhost:${port}`))

async function shutdown() {
  server.close()
  await prisma.$disconnect()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
