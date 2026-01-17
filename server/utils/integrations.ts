import { eq, and } from 'drizzle-orm'
import { integrationSettings } from '../database/schema'
import { db } from './drizzle'
import { decrypt } from './encryption'

/**
 * Helper function to get decrypted integration settings
 * This should only be used server-side for payment processing
 */
export async function getDecryptedIntegration(userId: number, provider: string) {
  const integration = await db
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
    return null
  }

  return {
    ...integration,
    serverKey: integration.serverKey ? decrypt(integration.serverKey) : null,
  }
}
