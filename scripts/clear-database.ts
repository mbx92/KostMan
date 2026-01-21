/**
 * Clear all database tables EXCEPT users
 * Run: npx tsx scripts/clear-database.ts
 */
import 'dotenv/config'
import { db } from '../server/utils/drizzle'
import { sql } from 'drizzle-orm'

const tablesToClear = [
  // Bills first (depend on rooms/tenants)
  'utility_bills',
  'rent_bills',
  'meter_readings',
  
  // Expenses
  'expenses',
  'expense_categories',
  
  // Rooms (depend on properties/tenants)
  'rooms',
  
  // Tenants
  'tenants',
  
  // Property settings (depend on properties)
  'property_settings',
  
  // Properties (depend on users)
  'properties',
  
  // Settings & templates
  'global_settings',
  'integration_settings',
  'whatsapp_templates',
  
  // Logs & backups
  'system_logs',
  'system_settings',
  'backups',
]

async function clearDatabase() {
  console.log('🗑️  Clearing database (keeping users)...\n')

  for (const table of tablesToClear) {
    try {
      await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`))
      console.log(`✅ Cleared: ${table}`)
    } catch (error: any) {
      // Table might not exist
      console.log(`⚠️  Skipped: ${table} (${error.message?.slice(0, 50) || 'error'})`)
    }
  }

  console.log('\n🎉 Database cleared (users preserved)!')
  console.log('💡 Run npm run db:seed-full to repopulate with demo data.')
  process.exit(0)
}

clearDatabase().catch((err) => {
  console.error('❌ Clear failed:', err)
  process.exit(1)
})
