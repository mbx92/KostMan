import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

async function fixDevConfig() {
  const dbUrl = process.env.DATABASE_URL
  const pool = new pg.Pool({ connectionString: dbUrl })
  
  try {
    // Fix development config to point to kostMan_dev (capital K)
    const devConfig = {
      name: "Development",
      description: "Development database environment",
      databaseUrl: "postgresql://mbx:nopassword123!@10.100.10.5:5432/kostMan_dev"
    }
    
    await pool.query(
      `UPDATE system_settings SET value = $1 WHERE key = 'db_config_development'`,
      [JSON.stringify(devConfig)]
    )
    
    console.log('✅ Fixed development config to point to kostMan_dev (capital K)\n')
    
    // Show all configs
    const result = await pool.query(
      `SELECT key, value FROM system_settings WHERE key LIKE 'db_config_%' ORDER BY key`
    )
    
    console.log('Current Database Configurations:')
    console.log('================================\n')
    
    for (const row of result.rows) {
      const config = JSON.parse(row.value)
      const dbName = config.databaseUrl.split('/').pop()?.split('?')[0]
      console.log(`${row.key}:`)
      console.log(`  Database: ${dbName}`)
      console.log(`  Full URL: ${config.databaseUrl}\n`)
    }
    
    await pool.end()
  } catch (error: any) {
    console.error('Error:', error.message)
    await pool.end()
    process.exit(1)
  }
}

fixDevConfig()
