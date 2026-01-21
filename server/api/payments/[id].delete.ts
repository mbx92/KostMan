import { db } from '../../utils/drizzle'
import { payments, rentBills, utilityBills } from '../../database/schema'
import { eq } from 'drizzle-orm'

/**
 * DELETE /api/payments/:id
 * Delete a payment and update bill's paid amount
 */
export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const paymentId = getRouterParam(event, 'id')
  if (!paymentId) {
    throw createError({ statusCode: 400, message: 'Payment ID is required' })
  }

  // Get payment details
  const payment = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)
    .then(rows => rows[0])

  if (!payment) {
    throw createError({ statusCode: 404, message: 'Payment not found' })
  }

  // Get bill
  const billTable = payment.billType === 'rent' ? rentBills : utilityBills
  const bill = await db
    .select()
    .from(billTable)
    .where(eq(billTable.id, payment.billId))
    .limit(1)
    .then(rows => rows[0])

  if (!bill) {
    throw createError({ statusCode: 404, message: 'Bill not found' })
  }

  // Calculate new paid amount after removing this payment
  const currentPaidAmount = Number(bill.paidAmount || 0)
  const paymentAmount = Number(payment.amount)
  const newPaidAmount = Math.max(0, currentPaidAmount - paymentAmount)
  const totalAmount = Number(bill.totalAmount)
  const isStillFullyPaid = newPaidAmount >= totalAmount

  // Delete payment
  await db.delete(payments).where(eq(payments.id, paymentId))

  // Update bill
  await db
    .update(billTable)
    .set({
      paidAmount: newPaidAmount.toString(),
      isPaid: isStillFullyPaid,
      paidAt: isStillFullyPaid ? bill.paidAt : null,
    })
    .where(eq(billTable.id, payment.billId))

  return {
    success: true,
    message: 'Payment deleted successfully',
    billStatus: {
      totalAmount,
      paidAmount: newPaidAmount,
      remainingAmount: totalAmount - newPaidAmount,
      isPaid: isStillFullyPaid,
    },
  }
})
