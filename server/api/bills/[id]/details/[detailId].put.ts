import { db } from '../../../../utils/drizzle';
import { billingDetails, billings } from '../../../../database/schema';
import { updateBillingDetailSchema } from '../../../../validations/billing';
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

        // Get detail ID from route params
        const detailId = getRouterParam(event, 'detailId');
        if (!detailId) {
            throw createError({
                statusCode: 400,
                message: 'Detail ID is required',
            });
        }

        // Parse and validate request body
        const body = await readBody(event);
        const validatedData = updateBillingDetailSchema.parse(body);

        // Get existing detail
        const existingDetail = await db.select().from(billingDetails).where(eq(billingDetails.id, detailId)).limit(1);
        if (existingDetail.length === 0) {
            throw createError({
                statusCode: 404,
                message: 'Billing detail not found',
            });
        }

        const detail = existingDetail[0];

        // Check if associated bill is paid
        const bill = await db.select().from(billings).where(eq(billings.id, detail.billId)).limit(1);
        if (bill.length > 0 && bill[0].billStatus === 'paid') {
            throw createError({
                statusCode: 400,
                message: 'Cannot modify billing details of a paid bill',
            });
        }

        // Prevent updating qty and price for rent items
        if (detail.itemType === 'rent') {
            if (validatedData.itemQty !== undefined || validatedData.itemUnitPrice !== undefined) {
                throw createError({
                    statusCode: 400,
                    message: 'Cannot modify quantity or unit price of rent items. Use "Edit Period" to change rent charges.',
                });
            }
        }

        // Prepare update data
        const updateData: any = {};

        if (validatedData.itemName !== undefined) updateData.itemName = validatedData.itemName;
        if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;

        // Recalculate amounts if qty, price, or discount changed
        const newQty = validatedData.itemQty ?? Number(detail.itemQty);
        const newPrice = validatedData.itemUnitPrice ?? Number(detail.itemUnitPrice);
        const newDiscount = validatedData.itemDiscount ?? Number(detail.itemDiscount);

        if (validatedData.itemQty !== undefined) updateData.itemQty = newQty.toString();
        if (validatedData.itemUnitPrice !== undefined) updateData.itemUnitPrice = newPrice.toString();
        if (validatedData.itemDiscount !== undefined) updateData.itemDiscount = newDiscount.toString();

        // Calculate new amounts
        const subAmount = newQty * newPrice;
        const totalAmount = subAmount - newDiscount;

        updateData.itemSubAmount = subAmount.toString();
        updateData.itemTotalAmount = totalAmount.toString();
        updateData.updatedAt = new Date();

        // Update billing detail
        const [updatedDetail] = await db.update(billingDetails)
            .set(updateData)
            .where(eq(billingDetails.id, detailId))
            .returning();

        // Recalculate total bill amount
        const allDetails = await db.select().from(billingDetails).where(eq(billingDetails.billId, detail.billId));
        const newTotalAmount = allDetails.reduce((sum, d) => sum + Number(d.itemTotalAmount), 0);

        // Update bill total
        await db.update(billings)
            .set({
                totalChargedAmount: newTotalAmount.toString(),
                updatedAt: new Date()
            })
            .where(eq(billings.id, detail.billId));

        return {
            success: true,
            message: 'Billing detail updated successfully',
            data: updatedDetail,
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
            message: error.message || 'Failed to update billing detail',
        });
    }
});
