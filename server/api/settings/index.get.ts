import { eq } from 'drizzle-orm'
import { globalSettings } from '../../database/schema'
import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'

export default defineEventHandler(async (event) => {
  const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const userId = user.id

  // Get or create settings for user
  let settings = await db
    .select()
    .from(globalSettings)
    .where(eq(globalSettings.userId, userId))
    .then(rows => rows[0])

  // If no settings exist, create default ones
  if (!settings) {
    const [newSettings] = await db
      .insert(globalSettings)
      .values({
        userId,
        appName: 'KostMan',
        costPerKwh: '1500',
        waterFee: '50000',
        trashFee: '25000',
      })
      .returning()
    settings = newSettings
  }

  return settings
})
