import { eq } from 'drizzle-orm'
import { systemSettings } from '../../database/schema'
import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { z } from 'zod'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const switchEnvironmentSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
})

export default defineEventHandler(async (event) => {
  // Only admin can switch database environment
  requireRole(event, [Role.ADMIN])

  const body = await readBody(event)
  const { environment } = switchEnvironmentSchema.parse(body)

  // Check if the target environment has a database URL configured
  const targetConfigKey = `db_config_${environment}`
  const targetConfig = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, targetConfigKey))
    .then(rows => rows[0])

  if (!targetConfig || !targetConfig.value) {
    throw createError({
      statusCode: 400,
      message: `No database URL configured for ${environment} environment. Please configure it first.`
    })
  }

  // Parse the config value (it's stored as JSON)
  let newDatabaseUrl: string
  try {
    const configData = JSON.parse(targetConfig.value)
    newDatabaseUrl = configData.databaseUrl
  } catch (e) {
    // Fallback: if it's not JSON, treat it as plain URL string
    newDatabaseUrl = targetConfig.value
  }

  if (!newDatabaseUrl) {
    throw createError({
      statusCode: 400,
      message: `Invalid database configuration for ${environment} environment.`
    })
  }

  // Update or create the active environment setting
  const activeEnvSetting = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'db_active_environment'))
    .then(rows => rows[0])

  if (activeEnvSetting) {
    await db
      .update(systemSettings)
      .set({ 
        value: environment,
        description: `Currently active database environment: ${environment}`
      })
      .where(eq(systemSettings.key, 'db_active_environment'))
  } else {
    await db
      .insert(systemSettings)
      .values({
        key: 'db_active_environment',
        value: environment,
        description: `Currently active database environment: ${environment}`
      })
  }

  // Update .env file with new DATABASE_URL
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = await readFile(envPath, 'utf-8')
    
    // Replace DATABASE_URL line
    const updatedEnvContent = envContent.replace(
      /DATABASE_URL=.*/,
      `DATABASE_URL="${newDatabaseUrl}"`
    )
    
    await writeFile(envPath, updatedEnvContent, 'utf-8')
    
    console.log(`[Database Config] Updated .env file with ${environment} database URL`)
  } catch (error) {
    console.error('[Database Config] Failed to update .env file:', error)
    // Continue anyway, user can manually update .env
  }

  return {
    success: true,
    message: `Database environment switched to ${environment}`,
    activeEnvironment: environment,
    databaseUrl: maskDatabaseUrl(newDatabaseUrl),
    note: 'Server restart is REQUIRED for changes to take effect. The .env file has been updated automatically.'
  }
})

function maskDatabaseUrl(url: string): string {
  if (!url) return ''
  
  try {
    const parsed = new URL(url)
    const password = parsed.password
    
    if (password) {
      const masked = password.length > 2 
        ? password[0] + '*'.repeat(password.length - 2) + password[password.length - 1]
        : '*'.repeat(password.length)
      
      parsed.password = masked
    }
    
    return parsed.toString()
  } catch {
    return url.substring(0, 15) + '***' + url.substring(url.length - 10)
  }
}

