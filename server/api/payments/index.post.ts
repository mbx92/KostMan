import { db } from '../../utils/drizzle'
import { payments, rentBills, utilityBills } from '../../database/schema'
import { eq, sql } from 'drizzle-orm'

interface CreatePaymentInput {
  billId: string
  billType: 'rent' | 'utility'
  amount: number
  paymentMethod: 'cash' | 'transfer' | 'credit_card' | 'debit_card' | 'e_wallet' | 'other'
  paymentDate: string
  notes?: string
}

/**
 * POST /api/payments
 * Record a new payment (supports partial payments)
 */
export default defineEventHandler(async (event) => {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody<CreatePaymentInput>(event)

  // Validate input
  if (!body.billId || !body.billType || !body.amount || !body.paymentMethod || !body.paymentDate) {
    throw createError({
      statusCode: 400,
      message: 'billId, billType, amount, paymentMethod, and paymentDate are required',
    })
  }

  if (body.amount <= 0) {
    throw createError({
      statusCode: 400,
      message: 'Payment amount must be greater than 0',
    })
  }

  // Get bill to check total and current paid amount
  const billTable = body.billType === 'rent' ? rentBills : utilityBills
  const bill = await db
    .select()
    .from(billTable)
    .where(eq(billTable.id, body.billId))
    .limit(1)
    .then(rows => rows[0])

  if (!bill) {
    throw createError({ statusCode: 404, message: 'Bill not found' })
  }

  if (bill.isPaid) {
    throw createError({ statusCode: 400, message: 'Bill is already fully paid' })
  }

  const totalAmount = Number(bill.totalAmount)
  const currentPaidAmount = Number(bill.paidAmount || 0)
  const remainingAmount = totalAmount - currentPaidAmount

  if (body.amount > remainingAmount) {
    throw createError({
      statusCode: 400,
      message: `Payment amount (${body.amount}) exceeds remaining balance (${remainingAmount})`,
    })
  }

  // Insert payment record
  const newPayment = await db
    .insert(payments)
    .values({
      billId: body.billId,
      billType: body.billType,
      amount: body.amount.toString(),
      paymentMethod: body.paymentMethod,
      paymentDate: new Date(body.paymentDate),
      notes: body.notes,
      recordedBy: userId,
      status: 'completed',
    })
    .returning()

  // Update bill's paidAmount
  const newPaidAmount = currentPaidAmount + body.amount
  const isNowFullyPaid = newPaidAmount >= totalAmount

  await db
    .update(billTable)
    .set({
      paidAmount: newPaidAmount.toString(),
      isPaid: isNowFullyPaid,
      paidAt: isNowFullyPaid ? new Date() : null,
      paymentMethod: isNowFullyPaid ? body.paymentMethod : bill.paymentMethod,
    })
    .where(eq(billTable.id, body.billId))

  return {
    success: true,
    payment: newPayment[0],
    billStatus: {
      totalAmount,
      paidAmount: newPaidAmount,
      remainingAmount: totalAmount - newPaidAmount,
      isPaid: isNowFullyPaid,
    },
  }
})
