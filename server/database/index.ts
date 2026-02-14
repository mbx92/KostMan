import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

// Log database URL on startup for debugging
const databaseUrl = process.env.DATABASE_URL || ''
const dbName = databaseUrl.split('/').pop()?.split('?')[0] || 'unknown'
console.log(`[Database] Connecting to database: ${dbName}`)
console.log(`[Database] Full URL: ${databaseUrl.substring(0, 30)}...`)

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
})

// Log when pool is ready
pool.on('connect', (client) => {
    client.query('SELECT current_database(), current_user', (err, result) => {
        if (!err && result?.rows[0]) {
            console.log(`[Database] Connected to: ${result.rows[0].current_database} as ${result.rows[0].current_user}`)
        }
    })
})

export const db = drizzle(pool, { schema })

export * from './schema'
