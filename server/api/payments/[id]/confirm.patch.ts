import { db } from '../../../utils/drizzle'
import { payments, rentBills, utilityBills } from '../../../database/schema'
import { eq } from 'drizzle-orm'
import { requireRole, Role } from '../../../utils/permissions'

interface BillToConfirm {
  billId: string
  billType: 'rent' | 'utility'
}

/**
 * PATCH /api/payments/[id]/confirm
 * Confirm a pending payment. Accepts billsToConfirm[] to optionally confirm paired bills too.
 * Creates a completed payment per confirmed bill, then deletes the original pending record.
 */
export default defineEventHandler(async (event) => {
  const userId = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]).id

  const paymentId = getRouterParam(event, 'id')
  if (!paymentId) {
    throw createError({ statusCode: 400, message: 'Payment ID required' })
  }

  const body = await readBody<{ billsToConfirm?: BillToConfirm[] }>(event)

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
    throw createError({ statusCode: 400, message: 'Payment is not pending' })
  }

  // Bills to confirm — default to just the original bill
  const billsToConfirm: BillToConfirm[] = body.billsToConfirm?.length
    ? body.billsToConfirm
    : [{ billId: payment.billId, billType: payment.billType }]

  const results = []

  for (const { billId, billType } of billsToConfirm) {
    const billTable = billType === 'rent' ? rentBills : utilityBills
    const bill = await db
      .select()
      .from(billTable)
      .where(eq(billTable.id, billId))
      .limit(1)
      .then(rows => rows[0])

    if (!bill || bill.isPaid) continue

    const currentPaidAmount = Number(bill.paidAmount || 0)
    const totalAmount = Number(bill.totalAmount)
    const remainingAmount = totalAmount - currentPaidAmount
    if (remainingAmount <= 0) continue

    const newPaidAmount = totalAmount // mark as fully paid
    const isNowFullyPaid = true

    // Create a completed payment record for this bill
    await db.insert(payments).values({
      billId,
      billType,
      amount: remainingAmount.toString(),
      paymentMethod: payment.paymentMethod,
      paymentDate: new Date(),
      status: 'completed',
      notes: payment.notes,
      recordedBy: userId,
    })

    // Update bill
    await db
      .update(billTable)
      .set({
        paidAmount: newPaidAmount.toString(),
        isPaid: isNowFullyPaid,
        paidAt: new Date(),
        paymentMethod: payment.paymentMethod,
      })
      .where(eq(billTable.id, billId))

    results.push({ billId, billType, paidAmount: newPaidAmount })
  }

  // Delete the original pending payment
  await db.delete(payments).where(eq(payments.id, paymentId))

  return { success: true, confirmed: results }
})

