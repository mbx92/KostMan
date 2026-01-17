import { eq } from 'drizzle-orm'
import { globalSettings } from '../../database/schema'
import { requireRole, Role } from '../../utils/permissions'
import { db } from '../../utils/drizzle'
import { z } from 'zod'

const updateSettingsSchema = z.object({
  appName: z.string().min(1).max(255).optional(),
  costPerKwh: z.union([z.string(), z.number()]).optional(),
  waterFee: z.union([z.string(), z.number()]).optional(),
  trashFee: z.union([z.string(), z.number()]).optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const userId = user.id

  const body = await readBody(event)
  const data = updateSettingsSchema.parse(body)

  // Ensure settings exist
  let settings = await db
    .select()
    .from(globalSettings)
    .where(eq(globalSettings.userId, userId))
    .then(rows => rows[0])

  if (!settings) {
    // Create with provided values
    const [newSettings] = await db
      .insert(globalSettings)
      .values({
        userId,
        appName: data.appName || 'KostMan',
        costPerKwh: String(data.costPerKwh || '1500'),
        waterFee: String(data.waterFee || '50000'),
        trashFee: String(data.trashFee || '25000'),
      })
      .returning()
    return newSettings
  }

  // Update existing settings
  const updateData: any = {}
  if (data.appName !== undefined) updateData.appName = data.appName
  if (data.costPerKwh !== undefined) updateData.costPerKwh = String(data.costPerKwh)
  if (data.waterFee !== undefined) updateData.waterFee = String(data.waterFee)
  if (data.trashFee !== undefined) updateData.trashFee = String(data.trashFee)

  const [updated] = await db
    .update(globalSettings)
    .set(updateData)
    .where(eq(globalSettings.userId, userId))
    .returning()

  return updated
})
