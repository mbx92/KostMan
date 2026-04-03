import path from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run migrations')
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    const db = drizzle(pool)
    const migrationsFolder = path.resolve(__dirname, '../server/database/migrations')

    console.log('Running database migrations...')
    await migrate(db, { migrationsFolder })
    console.log('Database migrations completed')
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Migration startup failed')
  console.error(error)
  process.exit(1)
})