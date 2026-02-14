import { eq, sql } from 'drizzle-orm'
import { systemSettings } from '../../database/schema'
import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { z } from 'zod'

const updateDatabaseConfigSchema = z.object({
  development: z.string().url().optional(),
  staging: z.string().url().optional(),
  production: z.string().url().optional(),
})

export default defineEventHandler(async (event) => {
  // Only admin can update database config
  requireRole(event, [Role.ADMIN])

  const body = await readBody(event)
  const data = updateDatabaseConfigSchema.parse(body)

  const updates: Array<Promise<any>> = []

  // Update or create settings for each environment
  if (data.development !== undefined) {
    const configJson = JSON.stringify({
      name: 'Development',
      description: 'Development database environment',
      databaseUrl: data.development
    })
    updates.push(upsertSetting('db_config_development', configJson, 'Development database connection URL'))
  }

  if (data.staging !== undefined) {
    const configJson = JSON.stringify({
      name: 'Staging',
      description: 'Staging database environment',
      databaseUrl: data.staging
    })
    updates.push(upsertSetting('db_config_staging', configJson, 'Staging database connection URL'))
  }

  if (data.production !== undefined) {
    const configJson = JSON.stringify({
      name: 'Production',
      description: 'Production database environment',
      databaseUrl: data.production
    })
    updates.push(upsertSetting('db_config_production', configJson, 'Production database connection URL'))
  }

  await Promise.all(updates)

  return {
    success: true,
    message: 'Database configuration updated successfully',
    updatedEnvironments: Object.keys(data)
  }
})

async function upsertSetting(key: string, value: string, description: string) {
  const existing = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .then(rows => rows[0])

  if (existing) {
    return db
      .update(systemSettings)
      .set({ value, description })
      .where(eq(systemSettings.key, key))
  } else {
    return db
      .insert(systemSettings)
      .values({ key, value, description })
  }
}
