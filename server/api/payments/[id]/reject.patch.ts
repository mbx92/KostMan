import { db } from '../../../utils/drizzle'
import { payments, rentBills, utilityBills } from '../../../database/schema'
import { eq } from 'drizzle-orm'
import { requireRole, Role } from '../../../utils/permissions'

/**
 * PATCH /api/payments/[id]/reject
 * Reject a pending payment: delete it (no bill update since it was never counted)
 */
export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF])

  const paymentId = getRouterParam(event, 'id')
  if (!paymentId) {
    throw createError({ statusCode: 400, message: 'Payment ID required' })
  }

  const payment = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)
    .then(rows => rows[0])

  if (!payment) {
    throw createError({ statusCode: 404, message: 'Payment not found' })
  }

  if (payment.status !== 'pending') {
    throw createError({ statusCode: 400, message: 'Only pending payments can be rejected' })
  }

  await db.delete(payments).where(eq(payments.id, paymentId))

  return { success: true }
})
