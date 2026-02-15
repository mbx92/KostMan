import { drizzle } from 'drizzle-orm/node-postgres'
import pkg from 'pg'
const { Pool } = pkg
import { eq } from 'drizzle-orm'
import { systemSettings } from '../server/database/schema'
import dotenv from 'dotenv'

dotenv.config()

async function fixActiveEnvironment() {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env')
    process.exit(1)
  }

  console.log('🔧 Fixing active environment setting...')
  console.log('📊 Current DATABASE_URL:', databaseUrl.replace(/:[^:@]+@/, ':****@'))

  // Determine environment from database name
  const dbName = databaseUrl.match(/\/([^/?]+)(\?|$)/)?.[1]?.toLowerCase()
  console.log('📦 Connected database:', dbName)

  let targetEnv = 'development'
  if (dbName?.includes('staging')) {
    targetEnv = 'staging'
  } else if (dbName?.includes('prod')) {
    targetEnv = 'production'
  } else if (dbName?.includes('dev')) {
    targetEnv = 'development'
  }

  console.log('🎯 Target environment:', targetEnv)

  const pool = new Pool({
    connectionString: databaseUrl,
  })

  const db = drizzle(pool)

  try {
    // Check current setting
    const current = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'db_active_environment'))
      .then(rows => rows[0])

    console.log('📝 Current active environment in DB:', current?.value || 'NOT SET')

    if (current?.value === targetEnv) {
      console.log('✅ Already correct! No changes needed.')
    } else {
      // Update or insert
      if (current) {
        await db
          .update(systemSettings)
          .set({ 
            value: targetEnv,
            description: `Currently active database environment: ${targetEnv}`,
            updatedAt: new Date()
          })
          .where(eq(systemSettings.key, 'db_active_environment'))
        console.log(`✅ Updated: development → ${targetEnv}`)
      } else {
        await db
          .insert(systemSettings)
          .values({
            key: 'db_active_environment',
            value: targetEnv,
            description: `Currently active database environment: ${targetEnv}`
          })
        console.log(`✅ Created new setting: ${targetEnv}`)
      }

      console.log('🎉 Active environment fixed!')
    }
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

fixActiveEnvironment()
