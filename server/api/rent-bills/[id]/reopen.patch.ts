import { and, eq } from 'drizzle-orm'
import { rentBills, payments } from '../../../database/schema'
import { db } from '../../../utils/drizzle'
import { requireRole, Role } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN, Role.OWNER])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const existing = await db.select().from(rentBills).where(eq(rentBills.id, id)).limit(1)
  if (!existing.length) {
    throw createError({ statusCode: 404, statusMessage: 'Rent bill not found' })
  }

  if (!existing[0].isPaid) {
    throw createError({ statusCode: 400, statusMessage: 'Bill is already unpaid' })
  }

  const result = await db.transaction(async (tx) => {
    const relatedPayments = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.billId, id), eq(payments.billType, 'rent')))

    if (relatedPayments.length > 0) {
      await tx.delete(payments).where(and(eq(payments.billId, id), eq(payments.billType, 'rent')))
    }

    const reopened = await tx
      .update(rentBills)
      .set({
        isPaid: false,
        paidAmount: '0',
        paymentMethod: null,
        paidAt: null,
      })
      .where(eq(rentBills.id, id))
      .returning()

    return {
      bill: reopened[0],
      deletedPayments: relatedPayments.length,
    }
  })

  return {
    success: true,
    message: 'Rent bill reopened successfully',
    ...result,
  }
})