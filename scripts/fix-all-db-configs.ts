import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

async function fixAllConfigs() {
  const dbUrl = process.env.DATABASE_URL
  const pool = new pg.Pool({ connectionString: dbUrl })
  
  try {
    const checkResult = await pool.query('SELECT current_database()')
    console.log(`Connected to: ${checkResult.rows[0].current_database}\n`)
    
    // Get all db_config_* settings
    const result = await pool.query(
      `SELECT key, value FROM system_settings WHERE key LIKE 'db_config_%'`
    )
    
    console.log(`Found ${result.rows.length} database configurations:\n`)
    
    for (const row of result.rows) {
      console.log(`\n📍 ${row.key}:`)
      console.log(`   Current value: ${row.value}`)
      
      let config
      try {
        config = JSON.parse(row.value)
        // Already JSON, check if it has the right structure
        if (!config.name || !config.databaseUrl) {
          throw new Error('Invalid structure')
        }
      } catch (e) {
        // Convert plain string URL to proper JSON
        const envName = row.key.replace('db_config_', '')
        const capitalizedName = envName.charAt(0).toUpperCase() + envName.slice(1)
        
        config = {
          name: capitalizedName,
          description: `${capitalizedName} database environment`,
          databaseUrl: row.value
        }
        
        console.log(`   ⚠️  Converting to JSON format...`)
      }
      
      // Fix database name case if needed
      if (config.databaseUrl.includes('kostMan_')) {
        const oldUrl = config.databaseUrl
        config.databaseUrl = config.databaseUrl.replace('kostMan_', 'kostman_')
        console.log(`   ⚠️  Fixed database name: kostMan_* → kostman_*`)
      }
      
      // Update in database
      await pool.query(
        `UPDATE system_settings SET value = $1 WHERE key = $2`,
        [JSON.stringify(config), row.key]
      )
      
      console.log(`   ✅ Updated:`, JSON.stringify(config, null, 2).split('\n').map((l, i) => i === 0 ? l : '      ' + l).join('\n'))
    }
    
    // Check active environment
    const activeResult = await pool.query(
      `SELECT value FROM system_settings WHERE key = 'db_active_environment'`
    )
    
    if (activeResult.rows.length > 0) {
      console.log(`\n🎯 Active Environment: ${activeResult.rows[0].value}`)
    }
    
    console.log('\n✅ All configurations fixed!')
    await pool.end()
  } catch (error: any) {
    console.error('Error:', error.message)
    await pool.end()
    process.exit(1)
  }
}

fixAllConfigs()
