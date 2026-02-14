import { eq, sql } from 'drizzle-orm'
import { systemSettings } from '../../database/schema'
import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'

export default defineEventHandler(async (event) => {
  // Only admin can view database config
  requireRole(event, [Role.ADMIN])

  // Get all database-related settings
  const dbSettings = await db
    .select()
    .from(systemSettings)
    .where(
      sql`${systemSettings.key} LIKE 'db_%'`
    )

  // Parse settings into structured format
  const config: {
    activeEnvironment: string
    environments: {
      development?: { url: string; masked: string }
      staging?: { url: string; masked: string }
      production?: { url: string; masked: string }
    }
  } = {
    activeEnvironment: 'development',
    environments: {}
  }

  for (const setting of dbSettings) {
    if (setting.key === 'db_active_environment') {
      config.activeEnvironment = setting.value
    } else if (setting.key === 'db_config_development') {
      const dbUrl = extractDatabaseUrl(setting.value)
      config.environments.development = {
        url: dbUrl,
        masked: maskDatabaseUrl(dbUrl)
      }
    } else if (setting.key === 'db_config_staging') {
      const dbUrl = extractDatabaseUrl(setting.value)
      config.environments.staging = {
        url: dbUrl,
        masked: maskDatabaseUrl(dbUrl)
      }
    } else if (setting.key === 'db_config_production') {
      const dbUrl = extractDatabaseUrl(setting.value)
      config.environments.production = {
        url: dbUrl,
        masked: maskDatabaseUrl(dbUrl)
      }
    }
  }

  // If no settings exist, use current DATABASE_URL as development
  if (!config.environments.development && process.env.DATABASE_URL) {
    config.environments.development = {
      url: process.env.DATABASE_URL,
      masked: maskDatabaseUrl(process.env.DATABASE_URL)
    }
  }

  return config
})

function extractDatabaseUrl(value: string): string {
  if (!value) return ''
  
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(value)
    return parsed.databaseUrl || value
  } catch {
    // If not JSON, treat as plain URL string
    return value
  }
}

function maskDatabaseUrl(url: string): string {
  if (!url) return ''
  
  try {
    const parsed = new URL(url)
    const password = parsed.password
    
    if (password) {
      // Mask password but show first and last char
      const masked = password.length > 2 
        ? password[0] + '*'.repeat(password.length - 2) + password[password.length - 1]
        : '*'.repeat(password.length)
      
      parsed.password = masked
    }
    
    return parsed.toString()
  } catch {
    // If URL parsing fails, just mask the whole thing partially
    return url.substring(0, 15) + '***' + url.substring(url.length - 10)
  }
}
