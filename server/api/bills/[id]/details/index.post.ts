import { db } from '../../../../utils/drizzle';
import { billingDetails, billings } from '../../../../database/schema';
import { addBillingDetailSchema } from '../../../../validations/billing';
import { eq } from 'drizzle-orm';

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
        const validatedData = addBillingDetailSchema.parse(body);

        // Check if bill exists and is still draft
        const bill = await db.select().from(billings).where(eq(billings.id, billId)).limit(1);
        if (bill.length === 0) {
            throw createError({
                statusCode: 404,
                message: 'Bill not found',
            });
        }

        if (bill[0].billStatus === 'paid') {
            throw createError({
                statusCode: 400,
                message: 'Cannot modify billing details of a paid bill',
            });
        }

        // Calculate amounts
        const subAmount = validatedData.itemQty * validatedData.itemUnitPrice;
        const totalAmount = subAmount - (validatedData.itemDiscount || 0);

        // Insert new billing detail
        const [newDetail] = await db.insert(billingDetails).values({
            billId,
            itemType: validatedData.itemType,
            itemName: validatedData.itemName,
            itemQty: validatedData.itemQty.toString(),
            itemUnitPrice: validatedData.itemUnitPrice.toString(),
            itemSubAmount: subAmount.toString(),
            itemDiscount: (validatedData.itemDiscount || 0).toString(),
            itemTotalAmount: totalAmount.toString(),
            notes: validatedData.notes,
        }).returning();

        // Recalculate total bill amount
        const allDetails = await db.select().from(billingDetails).where(eq(billingDetails.billId, billId));
        const newTotalAmount = allDetails.reduce((sum, detail) => sum + Number(detail.itemTotalAmount), 0);

        // Update bill total
        await db.update(billings)
            .set({
                totalChargedAmount: newTotalAmount.toString(),
                updatedAt: new Date()
            })
            .where(eq(billings.id, billId));

        return {
            success: true,
            message: 'Billing detail added successfully',
            data: newDetail,
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
            message: error.message || 'Failed to add billing detail',
        });
    }
});
