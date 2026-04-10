import { and, eq } from 'drizzle-orm'
import { payments, utilityBills } from '../../../database/schema'
import { db } from '../../../utils/drizzle'
import { requireRole, Role } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN, Role.OWNER])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const existing = await db.select().from(utilityBills).where(eq(utilityBills.id, id)).limit(1)
  if (!existing.length) {
    throw createError({ statusCode: 404, statusMessage: 'Utility bill not found' })
  }

  if (!existing[0].isPaid) {
    throw createError({ statusCode: 400, statusMessage: 'Bill is already unpaid' })
  }

  const result = await db.transaction(async (tx) => {
    const relatedPayments = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.billId, id), eq(payments.billType, 'utility')))

    if (relatedPayments.length > 0) {
      await tx.delete(payments).where(and(eq(payments.billId, id), eq(payments.billType, 'utility')))
    }

    const reopened = await tx
      .update(utilityBills)
      .set({
        isPaid: false,
        paidAmount: '0',
        paymentMethod: null,
        paidAt: null,
      })
      .where(eq(utilityBills.id, id))
      .returning()

    return {
      bill: reopened[0],
      deletedPayments: relatedPayments.length,
    }
  })

  return {
    success: true,
    message: 'Utility bill reopened successfully',
    ...result,
  }
})