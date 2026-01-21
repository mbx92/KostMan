/**
 * Fix migration conflicts - Drop problematic ENUM types
 * Run: tsx scripts/fix-migration.ts
 */
import 'dotenv/config'
import { db } from '../server/utils/drizzle'
import { sql } from 'drizzle-orm'

async function fixMigration() {
  console.log('🔧 Fixing migration conflicts...\n')

  const enumTypes = [
    'expense_category',
    'expense_type',
    'user_role',
    'room_status',
    'tenant_status',
    'payment_method'
  ]

  for (const enumType of enumTypes) {
    try {
      // Check if type exists
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = ${enumType}
        ) as exists
      `)
      
      const exists = (result.rows[0] as any)?.exists

      if (exists) {
        // Drop the type (CASCADE will drop dependent columns)
        await db.execute(sql.raw(`DROP TYPE IF EXISTS "${enumType}" CASCADE`))
        console.log(`✅ Dropped: ${enumType}`)
      }
    } catch (error: any) {
      console.log(`⚠️  Error with ${enumType}: ${error.message}`)
    }
  }

  console.log('\n🎉 Migration conflicts fixed!')
  console.log('💡 Now run: npm run db:migrate')
  process.exit(0)
}

fixMigration().catch((err) => {
  console.error('❌ Fix failed:', err)
  process.exit(1)
})
