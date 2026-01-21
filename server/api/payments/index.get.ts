import { db } from '../../utils/drizzle'
import { payments, users } from '../../database/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/payments
 * Get all payments with filters
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const billId = query.billId as string | undefined
  const billType = query.billType as 'rent' | 'utility' | undefined

  let whereConditions: any[] = []

  if (billId) {
    whereConditions.push(eq(payments.billId, billId))
  }

  if (billType) {
    whereConditions.push(eq(payments.billType, billType))
  }

  const results = await db
    .select({
      payment: payments,
      recordedBy: users,
    })
    .from(payments)
    .leftJoin(users, eq(payments.recordedBy, users.id))
    .where(whereConditions.length > 0 ? whereConditions[0] : undefined)
    .orderBy(desc(payments.paymentDate))

  return {
    payments: results.map(r => ({
      ...r.payment,
      recordedByName: r.recordedBy?.name,
    })),
  }
})
