import dotenv from 'dotenv'
import pg from 'pg'

// Load .env file first
dotenv.config()

async function fixConfig() {
  const dbUrl = process.env.DATABASE_URL
  console.log('DATABASE_URL:', dbUrl ? dbUrl.substring(0, 50) + '...' : 'NOT SET')
  
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not set in .env file')
    process.exit(1)
  }
  
  const pool = new pg.Pool({ connectionString: dbUrl })
  
  try {
    // Check connection first
    const checkResult = await pool.query('SELECT current_database(), current_user')
    console.log(`\nConnected to: ${checkResult.rows[0].current_database} as ${checkResult.rows[0].current_user}\n`)
    
    // Get production config
    const result = await pool.query(
      `SELECT key, value FROM system_settings WHERE key = 'db_config_production'`
    )
    
    if (result.rows.length === 0) {
      console.log('No production config found in database')
      await pool.end()
      process.exit(0)
    }
    
    console.log('Raw value:', result.rows[0].value)
    
    let config
    try {
      config = JSON.parse(result.rows[0].value)
    } catch (e) {
      console.log('Value is not JSON, treating as plain string')
      config = { databaseUrl: result.rows[0].value, name: 'Production' }
    }
    
    console.log('\nCurrent Production Config:')
    console.log('  Name:', config.name)
    console.log('  URL:', config.databaseUrl)
    
    const dbName = config.databaseUrl.split('/').pop()?.split('?')[0]
    console.log('  Database Name:', dbName)
    
    // Check if it has the wrong case
    if (config.databaseUrl.includes('kostMan_prod')) {
      console.log('\n⚠️  ISSUE FOUND: URL has "kostMan_prod" (capital K)')
      console.log('   Actual database is "kostman_prod" (lowercase k)')
      console.log('\nFixing...')
      
      const fixedUrl = config.databaseUrl.replace('kostMan_prod', 'kostman_prod')
      const fixedConfig = { ...config, databaseUrl: fixedUrl }
      
      await pool.query(
        `UPDATE system_settings SET value = $1 WHERE key = 'db_config_production'`,
        [JSON.stringify(fixedConfig)]
      )
      
      console.log('✅ Fixed! URL now points to:', fixedUrl)
      console.log('\nYou can now switch to production environment from the UI.')
    } else {
      console.log('\n✅ Config looks good!')
    }
    
    await pool.end()
  } catch (error: any) {
    console.error('Error:', error.message)
    await pool.end()
    process.exit(1)
  }
}

fixConfig()
