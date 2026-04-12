import { requireRole, Role } from '../../../utils/permissions'
import { db } from '../../../utils/drizzle'
import { rentBills, utilityBills, rooms } from '../../../database/schema'
import { eq } from 'drizzle-orm'
import { createPublicInvoiceShortLink } from '../../../utils/public-links'

/**
 * POST /api/bills/public-link/[billId]
 * Generate a public access token for a bill
 * Support both single bill (billId + billType) or combined (roomId + period)
 */
export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])

  const buildFallbackUrl = (token: string) => `${getRequestURL(event).origin}/invoice/${token}`

  const billId = getRouterParam(event, 'billId')
  const body = await readBody<{ billType?: 'rent' | 'utility'; roomId?: string; period?: string; rentBillId?: string; utilBillId?: string }>(event)

  // Support dual bill ID combined token (cross-period: rentBillId + utilBillId)
  if (body.rentBillId && body.utilBillId) {
    const [rentResult, utilResult] = await Promise.all([
      db.select({ id: rentBills.id }).from(rentBills).where(eq(rentBills.id, body.rentBillId)).limit(1),
      db.select({ id: utilityBills.id }).from(utilityBills).where(eq(utilityBills.id, body.utilBillId)).limit(1),
    ])

    if (rentResult.length === 0 && utilResult.length === 0) {
      throw createError({ statusCode: 404, message: 'Bills not found' })
    }

    const tokenData = `${body.rentBillId}+${body.utilBillId}`
    const token = Buffer.from(tokenData).toString('base64url')
    let publicUrl = buildFallbackUrl(token)

    try {
      const shortLink = await createPublicInvoiceShortLink(event, token)
      publicUrl = shortLink.publicUrl
    } catch (error) {
      console.error('Failed to create short invoice link:', error)
    }

    return {
      token,
      publicUrl
    }
  }

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
    let publicUrl = buildFallbackUrl(token)

    try {
      const shortLink = await createPublicInvoiceShortLink(event, token)
      publicUrl = shortLink.publicUrl
    } catch (error) {
      console.error('Failed to create short invoice link:', error)
    }

    return {
      token,
      publicUrl
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
  let publicUrl = buildFallbackUrl(token)

  try {
    const shortLink = await createPublicInvoiceShortLink(event, token)
    publicUrl = shortLink.publicUrl
  } catch (error) {
    console.error('Failed to create short invoice link:', error)
  }

  return {
    token,
    publicUrl
  }
})
