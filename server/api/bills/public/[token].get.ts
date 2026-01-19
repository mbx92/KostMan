import { db } from '../../../utils/drizzle'
import { rentBills, utilityBills, rooms, tenants, properties } from '../../../database/schema'
import { eq, and } from 'drizzle-orm'

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

      return {
        billType: 'combined',
        rentBill: rentResult?.[0]?.bill || null,
        utilityBill: utilityResult?.[0]?.bill || null,
        room: rentResult?.[0]?.room || utilityResult?.[0]?.room,
        tenant: rentResult?.[0]?.tenant || utilityResult?.[0]?.tenant,
        property: rentResult?.[0]?.property || utilityResult?.[0]?.property,
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

      return {
        billType: 'rent',
        bill: result[0].bill,
        room: result[0].room,
        tenant: result[0].tenant,
        property: result[0].property,
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

      return {
        billType: 'utility',
        bill: result[0].bill,
        room: result[0].room,
        tenant: result[0].tenant,
        property: result[0].property,
      }
    } else {
      throw createError({ statusCode: 400, message: 'Invalid bill type' })
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({ statusCode: 400, message: 'Invalid token' })
  }
})
