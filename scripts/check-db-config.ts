import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { systemSettings } from '../server/database/schema'
import { eq } from 'drizzle-orm'

async function checkConfig() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL)
  console.log('\nChecking database configurations...\n')
  
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  })
  
  const db = drizzle(pool, { schema: { systemSettings } })
  
  try {
    const configs = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'db_config_production'))
  
  if (configs.length > 0) {
    const config = JSON.parse(configs[0].value)
    console.log('Production Config:', config)
    console.log('\nDatabase Name in URL:', config.databaseUrl.split('/').pop()?.split('?')[0])
    
    // Check if it has the wrong case
    if (config.databaseUrl.includes('kostMan_prod')) {
      console.log('\n⚠️  ISSUE FOUND: URL has "kostMan_prod" (capital K)')
      console.log('   Actual database is "kostman_prod" (lowercase k)')
      console.log('\nFixing...')
      
      const fixedUrl = config.databaseUrl.replace('kostMan_prod', 'kostman_prod')
      const fixedConfig = { ...config, databaseUrl: fixedUrl }
      
      await db.update(systemSettings)
        .set({ value: JSON.stringify(fixedConfig) })
        .where(eq(systemSettings.key, 'db_config_production'))
      
      console.log('✅ Fixed! URL now points to:', fixedUrl)
    } else {
      console.log('\n✅ Config looks good!')
    }
  } else {
    console.log('No production config found in database')
  }
  
  await pool.end()
  process.exit(0)
}

checkConfig().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
