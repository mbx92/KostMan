import { eq, sql } from 'drizzle-orm'
import { globalSettings } from '../database/schema'
import { db } from './drizzle'

export const DEFAULT_WHATSAPP_DETAIL_FIELDS = [
  'property_name',
  'room_name',
  'tenant_name',
  'occupant_count',
  'rent_section',
  'utility_section',
  'grand_total',
  'payment_status',
] as const

export type WhatsAppDetailField = typeof DEFAULT_WHATSAPP_DETAIL_FIELDS[number]

export interface GlobalSettingsRecord {
  id: string
  userId: string
  appName: string | null
  costPerKwh: string | null
  waterFee: string | null
  trashFee: string | null
  whatsappDetailFields: WhatsAppDetailField[]
  createdAt: Date | null
  updatedAt: Date | null
}

interface GlobalSettingsWriteInput {
  appName?: string
  costPerKwh?: string
  waterFee?: string
  trashFee?: string
  whatsappDetailFields?: WhatsAppDetailField[]
}

function normalizeExistsValue(value: unknown) {
  return value === true || value === 't' || value === 'true' || value === 1
}

export function parseWhatsappDetailFields(value?: string | null) {
  if (!value) return [...DEFAULT_WHATSAPP_DETAIL_FIELDS]

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_WHATSAPP_DETAIL_FIELDS]
    }

    const filtered = parsed.filter((field): field is WhatsAppDetailField =>
      DEFAULT_WHATSAPP_DETAIL_FIELDS.includes(field as WhatsAppDetailField)
    )

    return filtered.length > 0 ? filtered : [...DEFAULT_WHATSAPP_DETAIL_FIELDS]
  } catch {
    return [...DEFAULT_WHATSAPP_DETAIL_FIELDS]
  }
}

async function hasWhatsappDetailFieldsColumn() {
  const result = await db.execute(sql`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'global_settings'
        and column_name = 'whatsapp_detail_fields'
    ) as "exists"
  `)

  const row = result.rows[0] as { exists?: unknown } | undefined
  return normalizeExistsValue(row?.exists)
}

function normalizeGlobalSettingsRow(row: Record<string, any> | undefined, hasWhatsappColumn: boolean) {
  if (!row) return undefined

  return {
    id: row.id,
    userId: row.userId ?? row.user_id,
    appName: row.appName ?? row.app_name ?? 'KostMan',
    costPerKwh: row.costPerKwh ?? row.cost_per_kwh ?? '1500',
    waterFee: row.waterFee ?? row.water_fee ?? '50000',
    trashFee: row.trashFee ?? row.trash_fee ?? '25000',
    whatsappDetailFields: parseWhatsappDetailFields(
      hasWhatsappColumn ? (row.whatsappDetailFields ?? row.whatsapp_detail_fields ?? null) : null
    ),
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
  } satisfies GlobalSettingsRecord
}

export async function getGlobalSettingsForUser(userId: string) {
  const hasWhatsappColumn = await hasWhatsappDetailFieldsColumn()

  if (hasWhatsappColumn) {
    const settings = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.userId, userId))
      .then(rows => rows[0])

    return normalizeGlobalSettingsRow(settings, true)
  }

  const result = await db.execute(sql`
    select
      id,
      user_id,
      app_name,
      cost_per_kwh,
      water_fee,
      trash_fee,
      created_at,
      updated_at
    from global_settings
    where user_id = ${userId}
    limit 1
  `)

  return normalizeGlobalSettingsRow(result.rows[0] as Record<string, any> | undefined, false)
}

export async function createGlobalSettingsForUser(userId: string, data: GlobalSettingsWriteInput) {
  const hasWhatsappColumn = await hasWhatsappDetailFieldsColumn()

  if (hasWhatsappColumn) {
    const [created] = await db
      .insert(globalSettings)
      .values({
        userId,
        appName: data.appName || 'KostMan',
        costPerKwh: data.costPerKwh || '1500',
        waterFee: data.waterFee || '50000',
        trashFee: data.trashFee || '25000',
        whatsappDetailFields: JSON.stringify(data.whatsappDetailFields || DEFAULT_WHATSAPP_DETAIL_FIELDS),
      })
      .returning()

    return normalizeGlobalSettingsRow(created, true)!
  }

  const result = await db.execute(sql`
    insert into global_settings (
      user_id,
      app_name,
      cost_per_kwh,
      water_fee,
      trash_fee
    )
    values (
      ${userId},
      ${data.appName || 'KostMan'},
      ${data.costPerKwh || '1500'},
      ${data.waterFee || '50000'},
      ${data.trashFee || '25000'}
    )
    returning
      id,
      user_id,
      app_name,
      cost_per_kwh,
      water_fee,
      trash_fee,
      created_at,
      updated_at
  `)

  return normalizeGlobalSettingsRow(result.rows[0] as Record<string, any> | undefined, false)!
}

export async function updateGlobalSettingsForUser(userId: string, data: GlobalSettingsWriteInput) {
  const hasWhatsappColumn = await hasWhatsappDetailFieldsColumn()

  if (hasWhatsappColumn) {
    const updateData: Record<string, string> = {}

    if (data.appName !== undefined) updateData.appName = data.appName
    if (data.costPerKwh !== undefined) updateData.costPerKwh = data.costPerKwh
    if (data.waterFee !== undefined) updateData.waterFee = data.waterFee
    if (data.trashFee !== undefined) updateData.trashFee = data.trashFee
    if (data.whatsappDetailFields !== undefined) {
      updateData.whatsappDetailFields = JSON.stringify(data.whatsappDetailFields)
    }

    const [updated] = await db
      .update(globalSettings)
      .set(updateData)
      .where(eq(globalSettings.userId, userId))
      .returning()

    return normalizeGlobalSettingsRow(updated, true)!
  }

  const assignments = []

  if (data.appName !== undefined) assignments.push(sql`app_name = ${data.appName}`)
  if (data.costPerKwh !== undefined) assignments.push(sql`cost_per_kwh = ${data.costPerKwh}`)
  if (data.waterFee !== undefined) assignments.push(sql`water_fee = ${data.waterFee}`)
  if (data.trashFee !== undefined) assignments.push(sql`trash_fee = ${data.trashFee}`)

  if (assignments.length === 0) {
    return getGlobalSettingsForUser(userId)
  }

  assignments.push(sql`updated_at = now()`)

  const result = await db.execute(sql`
    update global_settings
    set ${sql.join(assignments, sql`, `)}
    where user_id = ${userId}
    returning
      id,
      user_id,
      app_name,
      cost_per_kwh,
      water_fee,
      trash_fee,
      created_at,
      updated_at
  `)

  return normalizeGlobalSettingsRow(result.rows[0] as Record<string, any> | undefined, false)
}
