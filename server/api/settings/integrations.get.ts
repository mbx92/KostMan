import { eq } from 'drizzle-orm'
import { integrationSettings } from '../../database/schema'
import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'

export default defineEventHandler(async (event) => {
  const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const userId = user.id

  // Get all integration settings for user
  const integrations = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.userId, userId))

  // Return as object keyed by provider
  const result: Record<string, any> = {}
  for (const integration of integrations) {
    result[integration.provider] = {
      ...integration,
      serverKey: integration.serverKey ? '***hidden***' : null, // Don't expose keys in GET
      clientKey: integration.clientKey || null,
    }
  }

  return result
})
