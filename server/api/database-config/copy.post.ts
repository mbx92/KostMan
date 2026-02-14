import { requireRole, Role } from '../../utils/permissions'
import { z } from 'zod'
import pg from 'pg'
import { db } from '../../utils/drizzle'

const copyDatabaseSchema = z.object({
  sourceDb: z.string().min(1, 'Source database name is required'),
  targetDb: z.string().min(1, 'Target database name is required'),
  sourceUrl: z.string().url('Invalid source database URL').optional(),
  targetUrl: z.string().url('Invalid target database URL').optional(),
  forceDisconnect: z.boolean().optional().default(true),
})

export default defineEventHandler(async (event) => {
  // Only admin can copy database
  requireRole(event, [Role.ADMIN])

  const body = await readBody(event)
  const { sourceDb, targetDb, sourceUrl, targetUrl, forceDisconnect } = copyDatabaseSchema.parse(body)

  let adminClient: pg.Client | null = null

  try {
    // Parse connection details from URLs or use DATABASE_URL
    const sourceDbUrl = sourceUrl || process.env.DATABASE_URL
    const parsedSource = parsePostgresUrl(sourceDbUrl!)
    
    if (!parsedSource) {
      throw createError({
        statusCode: 400,
        message: 'Invalid source database URL'
      })
    }

    // For target, we'll use same host but different database name
    const targetDbUrl = targetUrl || sourceDbUrl
    const parsedTarget = parsePostgresUrl(targetDbUrl!)
    
    if (!parsedTarget) {
      throw createError({
        statusCode: 400,
        message: 'Invalid target database URL'
      })
    }

    // Admin connection to postgres database for creating/dropping databases
    const adminConfig = {
      user: parsedTarget.user,
      password: parsedTarget.password,
      host: parsedTarget.host,
      port: parseInt(parsedTarget.port),
      database: 'postgres'
    }

    adminClient = new pg.Client(adminConfig)
    await adminClient.connect()

    if (forceDisconnect) {
      // Step 1: Force terminate ALL connections to source database
      console.log(`Force terminating all connections to source database: ${sourceDb}`)
      const terminateResult = await adminClient.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [sourceDb])
      
      console.log(`Terminated ${terminateResult.rowCount} connections`)
      
      // Wait a bit for connections to fully terminate
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Step 2: Terminate existing connections to target database
    console.log(`Terminating connections to target database: ${targetDb}`)
    try {
      await adminClient.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [targetDb])
    } catch (err) {
      // Database might not exist yet
      console.log('No existing connections to target')
    }

    // Step 3: Drop target database if exists
    console.log(`Dropping database if exists: ${targetDb}`)
    await adminClient.query(`DROP DATABASE IF EXISTS "${targetDb}"`)

    // Step 4: Create target database with template
    console.log(`Creating new database: ${targetDb} as copy of ${sourceDb}`)
    
    try {
      await adminClient.query(`CREATE DATABASE "${targetDb}" WITH TEMPLATE "${sourceDb}" OWNER "${parsedTarget.user}"`)
      
      await adminClient.end()
      adminClient = null

      return {
        success: true,
        message: `Database copied successfully from ${sourceDb} to ${targetDb}`,
        sourceDatabase: sourceDb,
        targetDatabase: targetDb,
        method: 'template',
        note: 'Database copied successfully. You may need to restart the server to reconnect.'
      }
    } catch (copyError: any) {
      console.error('Copy error:', copyError.message)
      
      // If still failing, provide helpful message
      throw createError({
        statusCode: 500,
        message: `Failed to copy database: ${copyError.message}. Try restarting the server first to close all connections, then retry.`
      })
    }
  } catch (error: any) {
    console.error('Database copy error:', error)
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to copy database'
    
    if (error.message?.includes('already exists')) {
      errorMessage = `Database ${targetDb} could not be dropped. Please ensure no active connections exist.`
    } else if (error.message?.includes('does not exist')) {
      errorMessage = `Source database ${sourceDb} does not exist or you don't have permission to access it.`
    } else if (error.message?.includes('permission')) {
      errorMessage = 'Permission denied. Ensure database user has CREATEDB privilege.'
    }

    throw createError({
      statusCode: 500,
      message: errorMessage
    })
  } finally {
    // Clean up connections
    if (adminClient) {
      try {
        await adminClient.end()
      } catch (err) {
        console.error('Error closing admin client:', err)
      }
    }
  }
})

function parsePostgresUrl(url: string) {
  try {
    const parsed = new URL(url)
    return {
      user: parsed.username,
      password: parsed.password,
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.substring(1) // remove leading /
    }
  } catch {
    return null
  }
}
