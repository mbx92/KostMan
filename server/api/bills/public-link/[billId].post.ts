import { requireRole, Role } from '../../../utils/permissions'
import { db } from '../../../utils/drizzle'
import { rentBills, utilityBills, rooms } from '../../../database/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

/**
 * POST /api/bills/public-link/[billId]
 * Generate a public access token for a bill
 * Support both single bill (billId + billType) or combined (roomId + period)
 */
export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])

  const billId = getRouterParam(event, 'billId')
  const body = await readBody<{ billType?: 'rent' | 'utility'; roomId?: string; period?: string }>(event)

  // Support combined bills (roomId + period)
  if (body.roomId && body.period) {
    // Verify room exists
    const room = await db.select().from(rooms).where(eq(rooms.id, body.roomId)).limit(1)
    
    if (!room || room.length === 0) {
      throw createError({ statusCode: 404, message: 'Room not found' })
    }

    // Generate token for combined view
    const tokenData = `${body.roomId}:${body.period}`
    const token = Buffer.from(tokenData).toString('base64url')

    return {
      token,
      publicUrl: `${getRequestURL(event).origin}/invoice/${token}`
    }
  }

  // Original single bill logic
  if (!billId || !body.billType) {
    throw createError({ statusCode: 400, message: 'billId and billType required (or roomId and period)' })
  }

  // Verify bill exists
  const table = body.billType === 'rent' ? rentBills : utilityBills
  const bill = await db.select().from(table).where(eq(table.id, billId)).limit(1)

  if (!bill || bill.length === 0) {
    throw createError({ statusCode: 404, message: 'Bill not found' })
  }

  // Generate unique token (we'll use billId + billType encoded)
  const tokenData = `${billId}:${body.billType}`
  const token = Buffer.from(tokenData).toString('base64url')

  return {
    token,
    publicUrl: `${getRequestURL(event).origin}/invoice/${token}`
  }
})
