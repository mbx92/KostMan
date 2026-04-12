import { requireRole, Role } from '../../utils/permissions'
import {
  DEFAULT_WHATSAPP_DETAIL_FIELDS,
  createGlobalSettingsForUser,
  getGlobalSettingsForUser,
} from '../../utils/global-settings'

export default defineEventHandler(async (event) => {
  const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])
  const userId = user.id

  // Get or create settings for user
  let settings = await getGlobalSettingsForUser(userId)

  // If no settings exist, create default ones
  if (!settings) {
    settings = await createGlobalSettingsForUser(userId, {
      appName: 'KostMan',
      costPerKwh: '1500',
      waterFee: '50000',
      trashFee: '25000',
      whatsappDetailFields: [...DEFAULT_WHATSAPP_DETAIL_FIELDS],
    })
  }

  return settings
})
