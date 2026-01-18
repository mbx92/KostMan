import { db } from '../../../utils/drizzle';
import { billings, billingDetails } from '../../../database/schema';
import { updateBillPeriodSchema } from '../../../validations/billing';
import { eq, and } from 'drizzle-orm';
import { calculateMonthsCovered, calculateRentCharges, validateBillingPeriod } from '../../../utils/billing';

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
        const validatedData = updateBillPeriodSchema.parse(body);

        // Get existing bill
        const existingBill = await db.select().from(billings).where(eq(billings.id, billId)).limit(1);
        if (existingBill.length === 0) {
            throw createError({
                statusCode: 404,
                message: 'Bill not found',
            });
        }

        const bill = existingBill[0];

        // Cannot modify paid bills
        if (bill.billStatus === 'paid') {
            throw createError({
                statusCode: 400,
                message: 'Cannot modify period of a paid bill',
            });
        }

        // Validate new billing period (check for overlaps, excluding current bill)
        await validateBillingPeriod(
            bill.roomId,
            validatedData.periodStart,
            validatedData.periodEnd,
            billId
        );

        // Calculate new months covered
        const newMonthsCovered = calculateMonthsCovered(
            validatedData.periodStart,
            validatedData.periodEnd
        );

        // Recalculate rent charges
        const newRentCharges = await calculateRentCharges(bill.roomId, newMonthsCovered);

        // Start transaction
        await db.transaction(async (tx) => {
            // Find and update the rent billing detail
            const rentDetail = await tx
                .select()
                .from(billingDetails)
                .where(
                    and(
                        eq(billingDetails.billId, billId),
                        eq(billingDetails.itemType, 'rent')
                    )
                )
                .limit(1);

            if (rentDetail.length > 0) {
                // Update rent detail with new calculations
                await tx
                    .update(billingDetails)
                    .set({
                        itemName: newRentCharges.itemName,
                        itemQty: newRentCharges.itemQty.toString(),
                        itemUnitPrice: newRentCharges.itemUnitPrice.toString(),
                        itemSubAmount: newRentCharges.itemSubAmount.toString(),
                        itemTotalAmount: newRentCharges.itemTotalAmount.toString(),
                        updatedAt: new Date(),
                    })
                    .where(eq(billingDetails.id, rentDetail[0].id));
            }

            // Recalculate total bill amount
            const allDetails = await tx
                .select()
                .from(billingDetails)
                .where(eq(billingDetails.billId, billId));

            const newTotalAmount = allDetails.reduce(
                (sum, detail) => sum + Number(detail.itemTotalAmount),
                0
            );

            // Update bill with new period and total
            await tx
                .update(billings)
                .set({
                    periodStart: validatedData.periodStart,
                    periodEnd: validatedData.periodEnd,
                    monthsCovered: newMonthsCovered.toString(),
                    totalChargedAmount: newTotalAmount.toString(),
                    updatedAt: new Date(),
                })
                .where(eq(billings.id, billId));
        });

        // Fetch updated bill
        const updatedBill = await db.select().from(billings).where(eq(billings.id, billId)).limit(1);

        return {
            success: true,
            message: 'Bill period updated and rent charges recalculated successfully',
            data: updatedBill[0],
        };
    } catch (error: any) {
        if (error.name === 'ZodError') {
            throw createError({
                statusCode: 400,
                message: 'Validation error',
                data: error.errors,
            });
        }
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Failed to update bill period',
        });
    }
});
