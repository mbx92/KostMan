import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function ensureMigrationsTable(pool) {
  await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)
}

async function getMigrationState(pool) {
  const result = await pool.query(`
    select
      (select count(*)::int from drizzle.__drizzle_migrations) as migration_count,
      exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'users'
      ) as users_exists,
      exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'room_settings'
      ) as room_settings_exists
  `)

  return result.rows[0]
}

async function baselineLegacyDatabase(pool, migrationsFolder) {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json')
  const journal = JSON.parse(await fs.readFile(journalPath, 'utf8'))
  const state = await getMigrationState(pool)

  if (state.migration_count > 0 || !state.users_exists) {
    return
  }

  const baselineEntries = journal.entries.filter((entry) => {
    if (entry.tag === '0012_add_room_settings') {
      return state.room_settings_exists
    }

    return true
  })

  if (baselineEntries.length === 0) {
    return
  }

  console.log(`Baselining ${baselineEntries.length} existing migrations for legacy database...`)

  for (const entry of baselineEntries) {
    const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`)
    const sql = await fs.readFile(sqlPath)
    const hash = crypto.createHash('sha256').update(sql).digest('hex')

    await pool.query(
      'insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)',
      [hash, entry.when],
    )
  }
}

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

    await ensureMigrationsTable(pool)
    await baselineLegacyDatabase(pool, migrationsFolder)

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