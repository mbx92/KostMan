import { eq, and } from 'drizzle-orm'
import { integrationSettings } from '../../../database/schema'
import { requireRole, Role } from '../../../utils/permissions'
import { db } from '../../../utils/drizzle'
import { encrypt } from '../../../utils/encryption'
import { z } from 'zod'

const updateIntegrationSchema = z.object({
  isEnabled: z.boolean().optional(),
  serverKey: z.string().optional(),
  clientKey: z.string().optional(),
  isProduction: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const userId = user.id

  const provider = getRouterParam(event, 'provider')
  if (!provider) {
    throw createError({ statusCode: 400, message: 'Provider is required' })
  }

  const body = await readBody(event)
  const data = updateIntegrationSchema.parse(body)

  // Check if integration exists
  let integration = await db
    .select()
    .from(integrationSettings)
    .where(
      and(
        eq(integrationSettings.userId, userId),
        eq(integrationSettings.provider, provider)
      )
    )
    .then(rows => rows[0])

  if (!integration) {
    // Create new integration
    const [newIntegration] = await db
      .insert(integrationSettings)
      .values({
        userId,
        provider,
        isEnabled: data.isEnabled ?? false,
        serverKey: data.serverKey ? encrypt(data.serverKey) : null,
        clientKey: data.clientKey || null,
        isProduction: data.isProduction ?? false,
      })
      .returning()
    return {
      ...newIntegration,
      serverKey: newIntegration.serverKey ? '***saved***' : null,
    }
  }

  // Update existing
  const updateData: any = {}
  if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled
  if (data.serverKey !== undefined) updateData.serverKey = data.serverKey ? encrypt(data.serverKey) : null
  if (data.clientKey !== undefined) updateData.clientKey = data.clientKey
  if (data.isProduction !== undefined) updateData.isProduction = data.isProduction

  const [updated] = await db
    .update(integrationSettings)
    .set(updateData)
    .where(
      and(
        eq(integrationSettings.userId, userId),
        eq(integrationSettings.provider, provider)
      )
    )
    .returning()

  return {
    ...updated,
    serverKey: updated.serverKey ? '***saved***' : null,
  }
})
