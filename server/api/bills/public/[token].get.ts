import { db } from '../../../utils/drizzle'
import { rentBills, utilityBills, rooms, tenants, properties, integrationSettings } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'

async function getMidtransEnabled(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const result = await db.select({ isEnabled: integrationSettings.isEnabled })
    .from(integrationSettings)
    .where(and(
      eq(integrationSettings.userId, userId),
      eq(integrationSettings.provider, 'midtrans'),
      eq(integrationSettings.isEnabled, true)
    ))
    .limit(1)
  return result.length > 0
}

/**
 * GET /api/bills/public/[token]
 * Get bill details from public token (no auth required)
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, message: 'Token required' })
  }

  try {
    // Decode token
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')

    // Check for dual bill ID format: {rentBillId}+{utilBillId} (cross-period combined)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (decoded.includes('+')) {
      const dualParts = decoded.split('+')
      if (dualParts.length === 2 && UUID_REGEX.test(dualParts[0]) && UUID_REGEX.test(dualParts[1])) {
        const [rentBillId, utilBillId] = dualParts

        const [rentResult, utilityResult] = await Promise.all([
          db.select({ bill: rentBills, room: rooms, tenant: tenants, property: properties })
            .from(rentBills)
            .leftJoin(rooms, eq(rentBills.roomId, rooms.id))
            .leftJoin(tenants, eq(rentBills.tenantId, tenants.id))
            .leftJoin(properties, eq(rooms.propertyId, properties.id))
            .where(eq(rentBills.id, rentBillId))
            .limit(1),
          db.select({ bill: utilityBills, room: rooms, tenant: tenants, property: properties })
            .from(utilityBills)
            .leftJoin(rooms, eq(utilityBills.roomId, rooms.id))
            .leftJoin(tenants, eq(utilityBills.tenantId, tenants.id))
            .leftJoin(properties, eq(rooms.propertyId, properties.id))
            .where(eq(utilityBills.id, utilBillId))
            .limit(1),
        ])

        if (rentResult.length === 0 && utilityResult.length === 0) {
          throw createError({ statusCode: 404, message: 'Bills not found' })
        }

        const combinedProperty = rentResult?.[0]?.property || utilityResult?.[0]?.property
        const midtransEnabled = await getMidtransEnabled(combinedProperty?.userId)

        return {
          billType: 'combined',
          rentBill: rentResult?.[0]?.bill || null,
          utilityBill: utilityResult?.[0]?.bill || null,
          room: rentResult?.[0]?.room || utilityResult?.[0]?.room,
          tenant: rentResult?.[0]?.tenant || utilityResult?.[0]?.tenant,
          property: combinedProperty,
          midtransEnabled,
        }
      }
    }

    const parts = decoded.split(':')
    
    // Support both single bill and combined (roomId:period format)
    // Check if it's combined format: parts.length === 2 and second part looks like period (YYYY-MM)
    if (parts.length === 2 && parts[1].match(/^\d{4}-\d{2}$/)) {
      // New format: roomId:period (for combined bills)
      const [roomId, period] = parts
      
      // Fetch both rent and utility bills for this room/period
      const [rentResult, utilityResult] = await Promise.all([
        db.select({
          bill: rentBills,
          room: rooms,
          tenant: tenants,
          property: properties,
        })
          .from(rentBills)
          .leftJoin(rooms, eq(rentBills.roomId, rooms.id))
          .leftJoin(tenants, eq(rentBills.tenantId, tenants.id))
          .leftJoin(properties, eq(rooms.propertyId, properties.id))
          .where(and(eq(rentBills.roomId, roomId), eq(rentBills.period, period)))
          .limit(1),
        
        db.select({
          bill: utilityBills,
          room: rooms,
          tenant: tenants,
          property: properties,
        })
          .from(utilityBills)
          .leftJoin(rooms, eq(utilityBills.roomId, rooms.id))
          .leftJoin(tenants, eq(utilityBills.tenantId, tenants.id))
          .leftJoin(properties, eq(rooms.propertyId, properties.id))
          .where(and(eq(utilityBills.roomId, roomId), eq(utilityBills.period, period)))
          .limit(1)
      ])

      if ((!rentResult || rentResult.length === 0) && (!utilityResult || utilityResult.length === 0)) {
        throw createError({ statusCode: 404, message: 'Bills not found' })
      }

      const combinedProperty = rentResult?.[0]?.property || utilityResult?.[0]?.property
      const midtransEnabled = await getMidtransEnabled(combinedProperty?.userId)

      return {
        billType: 'combined',
        rentBill: rentResult?.[0]?.bill || null,
        utilityBill: utilityResult?.[0]?.bill || null,
        room: rentResult?.[0]?.room || utilityResult?.[0]?.room,
        tenant: rentResult?.[0]?.tenant || utilityResult?.[0]?.tenant,
        property: combinedProperty,
        midtransEnabled,
      }
    }
    
    // Old format: billId:billType:timestamp
    const [billId, billType] = parts

    if (!billId || !billType) {
      throw createError({ statusCode: 400, message: 'Invalid token format' })
    }

    // Fetch bill with related data
    if (billType === 'rent') {
      const result = await db.select({
        bill: rentBills,
        room: rooms,
        tenant: tenants,
        property: properties,
      })
        .from(rentBills)
        .leftJoin(rooms, eq(rentBills.roomId, rooms.id))
        .leftJoin(tenants, eq(rentBills.tenantId, tenants.id))
        .leftJoin(properties, eq(rooms.propertyId, properties.id))
        .where(eq(rentBills.id, billId))
        .limit(1)

      if (!result || result.length === 0) {
        throw createError({ statusCode: 404, message: 'Bill not found' })
      }

      const midtransEnabled = await getMidtransEnabled(result[0].property?.userId)

      return {
        billType: 'rent',
        bill: result[0].bill,
        room: result[0].room,
        tenant: result[0].tenant,
        property: result[0].property,
        midtransEnabled,
      }
    } else if (billType === 'utility') {
      const result = await db.select({
        bill: utilityBills,
        room: rooms,
        tenant: tenants,
        property: properties,
      })
        .from(utilityBills)
        .leftJoin(rooms, eq(utilityBills.roomId, rooms.id))
        .leftJoin(tenants, eq(utilityBills.tenantId, tenants.id))
        .leftJoin(properties, eq(rooms.propertyId, properties.id))
        .where(eq(utilityBills.id, billId))
        .limit(1)

      if (!result || result.length === 0) {
        throw createError({ statusCode: 404, message: 'Bill not found' })
      }

      const midtransEnabled = await getMidtransEnabled(result[0].property?.userId)

      return {
        billType: 'utility',
        bill: result[0].bill,
        room: result[0].room,
        tenant: result[0].tenant,
        property: result[0].property,
        midtransEnabled,
      }
    } else {
      throw createError({ statusCode: 400, message: 'Invalid bill type' })
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({ statusCode: 400, message: 'Invalid token' })
  }
})
