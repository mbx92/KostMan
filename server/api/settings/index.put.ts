import { requireRole, Role } from '../../utils/permissions'
import { z } from 'zod'
import {
  DEFAULT_WHATSAPP_DETAIL_FIELDS,
  createGlobalSettingsForUser,
  getGlobalSettingsForUser,
  updateGlobalSettingsForUser,
} from '../../utils/global-settings'

const whatsappDetailFieldSchema = z.enum(DEFAULT_WHATSAPP_DETAIL_FIELDS)

const updateSettingsSchema = z.object({
  appName: z.string().min(1).max(255).optional(),
  costPerKwh: z.union([z.string(), z.number()]).refine(
    (val) => Number(val) >= 0,
    { message: 'Cost per kWh cannot be negative' }
  ).optional(),
  waterFee: z.union([z.string(), z.number()]).refine(
    (val) => Number(val) >= 0,
    { message: 'Water fee cannot be negative' }
  ).optional(),
  trashFee: z.union([z.string(), z.number()]).refine(
    (val) => Number(val) >= 0,
    { message: 'Trash fee cannot be negative' }
  ).optional(),
  whatsappDetailFields: z.array(whatsappDetailFieldSchema)
    .min(1, 'Minimal satu item detail tagihan harus dipilih')
    .optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const userId = user.id

  const body = await readBody(event)
  const data = updateSettingsSchema.parse(body)

  // Ensure settings exist
  let settings = await getGlobalSettingsForUser(userId)

  if (!settings) {
    // Create with provided values
    return createGlobalSettingsForUser(userId, {
      appName: data.appName || 'KostMan',
      costPerKwh: String(data.costPerKwh || '1500'),
      waterFee: String(data.waterFee || '50000'),
      trashFee: String(data.trashFee || '25000'),
      whatsappDetailFields: data.whatsappDetailFields || [...DEFAULT_WHATSAPP_DETAIL_FIELDS],
    })
  }

  return updateGlobalSettingsForUser(userId, {
    appName: data.appName,
    costPerKwh: data.costPerKwh !== undefined ? String(data.costPerKwh) : undefined,
    waterFee: data.waterFee !== undefined ? String(data.waterFee) : undefined,
    trashFee: data.trashFee !== undefined ? String(data.trashFee) : undefined,
    whatsappDetailFields: data.whatsappDetailFields,
  })
})
