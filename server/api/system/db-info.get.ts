import { db } from '../../utils/drizzle'
import { sql } from 'drizzle-orm'

/**
 * Endpoint to check current database connection info
 * Useful for debugging which database is actually connected
 */
export default defineEventHandler(async (event) => {
  try {
    // Query current database info
    const result = await db.execute(sql`
      SELECT 
        current_database() as database_name,
        current_user as user_name,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        version() as pg_version
    `)

    const dbInfo = result.rows[0] as any

    // Also get some basic stats
    const statsResult = await db.execute(sql`
      SELECT 
        (SELECT count(*) FROM users) as user_count,
        (SELECT count(*) FROM properties) as property_count,
        (SELECT count(*) FROM tenants) as tenant_count
    `)

    const stats = statsResult.rows[0] as any

    return {
      success: true,
      connection: {
        database: dbInfo.database_name,
        user: dbInfo.user_name,
        host: dbInfo.server_ip,
        port: dbInfo.server_port,
        postgresql_version: dbInfo.pg_version?.split(' ')[1]
      },
      statistics: {
        users: parseInt(stats.user_count || '0'),
        properties: parseInt(stats.property_count || '0'),
        tenants: parseInt(stats.tenant_count || '0')
      },
      environment: {
        node_env: process.env.NODE_ENV,
        database_url_configured: !!process.env.DATABASE_URL,
        database_from_url: process.env.DATABASE_URL?.split('/').pop()?.split('?')[0]
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      database_url_configured: !!process.env.DATABASE_URL,
      database_from_url: process.env.DATABASE_URL?.split('/').pop()?.split('?')[0]
    }
  }
})
