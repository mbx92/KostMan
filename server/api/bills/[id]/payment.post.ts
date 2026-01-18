import { db } from '../../../utils/drizzle';
import { billings, payments } from '../../../database/schema';
import { recordPaymentSchema } from '../../../validations/billing';
import { eq } from 'drizzle-orm';
import { parseDecimal } from '../../../utils/billing';

export default defineEventHandler(async (event) => {
    try {
        // Check authentication
        if (!event.context.user) {
            throw createError({
                statusCode: 401,
                message: 'Unauthorized',
            });
        }

        // Get bill ID from route params
        const billId = getRouterParam(event, 'id');
        if (!billId) {
            throw createError({
                statusCode: 400,
                message: 'Bill ID is required',
            });
        }

        // Parse and validate request body
        const body = await readBody(event);
        const validatedData = recordPaymentSchema.parse(body);

        // Check if bill exists
        const existingBill = await db
            .select()
            .from(billings)
            .where(eq(billings.id, billId))
            .limit(1);

        if (!existingBill.length) {
            throw createError({
                statusCode: 404,
                message: 'Bill not found',
            });
        }

        const bill = existingBill[0];

        // Get existing payments
        const existingPayments = await db
            .select()
            .from(payments)
            .where(eq(payments.billId, billId));

        const totalPaid = existingPayments.reduce(
            (sum, payment) => sum + parseDecimal(payment.paymentAmount),
            0
        );

        const totalCharged = parseDecimal(bill.totalChargedAmount);
        const balance = totalCharged - totalPaid;

        // Validate payment amount
        if (validatedData.paymentAmount > balance) {
            throw createError({
                statusCode: 400,
                message: `Payment amount exceeds balance. Balance: ${balance}`,
            });
        }

        // Start transaction
        const result = await db.transaction(async (tx) => {
            // Insert payment record
            const [payment] = await tx
                .insert(payments)
                .values({
                    billId,
                    paymentMethod: validatedData.paymentMethod,
                    paymentAmount: validatedData.paymentAmount.toString(),
                    paymentDate: validatedData.paymentDate,
                    paymentProof: validatedData.paymentProof,
                    processedBy: event.context.user.id,
                    notes: validatedData.notes,
                })
                .returning();

            // Calculate new total paid
            const newTotalPaid = totalPaid + validatedData.paymentAmount;

            // Update bill status if fully paid
            let updatedBill = bill;
            if (newTotalPaid >= totalCharged) {
                [updatedBill] = await tx
                    .update(billings)
                    .set({
                        billStatus: 'paid',
                        updatedAt: new Date(),
                    })
                    .where(eq(billings.id, billId))
                    .returning();
            } else if (bill.billStatus === 'draft') {
                // If still draft, mark as unpaid when first payment is made
                [updatedBill] = await tx
                    .update(billings)
                    .set({
                        billStatus: 'unpaid',
                        updatedAt: new Date(),
                    })
                    .where(eq(billings.id, billId))
                    .returning();
            }

            return {
                payment,
                bill: updatedBill,
            };
        });

        return {
            success: true,
            message: 'Payment recorded successfully',
            data: {
                payment: {
                    ...result.payment,
                    paymentAmount: parseDecimal(result.payment.paymentAmount),
                },
                bill: result.bill,
            },
        };
    } catch (error: any) {
        console.error('Error recording payment:', error);

        // Handle validation errors
        if (error.name === 'ZodError') {
            throw createError({
                statusCode: 400,
                message: 'Validation error',
                data: error.errors,
            });
        }

        // Re-throw HTTP errors
        if (error.statusCode) {
            throw error;
        }

        // Generic error
        throw createError({
            statusCode: 500,
            message: error.message || 'Failed to record payment',
        });
    }
});
