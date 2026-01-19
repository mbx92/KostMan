import { db } from '../server/utils/drizzle'
import { sql } from 'drizzle-orm'
import { config } from 'dotenv'

// Load .env
config()

/**
 * Migration: Increase server_key column length for encrypted data
 */
async function runMigration() {
  console.log('🔄 Running migration: Increase server_key column length...')

  try {
    // Check if integration_settings table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'integration_settings'
      );
    `)

    if (!tableExists.rows[0]?.exists) {
      console.log('⚠️  Table integration_settings does not exist. Skipping migration.')
      process.exit(0)
    }

    // Alter column length
    await db.execute(sql`
      ALTER TABLE integration_settings 
      ALTER COLUMN server_key TYPE VARCHAR(500);
    `)

    console.log('✅ Migration completed successfully!')
    console.log('   Column server_key increased to VARCHAR(500)')

  } catch (error: any) {
    if (error.message?.includes('already exists') || error.code === '42701') {
      console.log('⚠️  Migration already applied or column already correct length')
    } else {
      console.error('❌ Migration failed:', error.message)
      throw error
    }
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
