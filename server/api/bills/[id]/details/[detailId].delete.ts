import { db } from '../../../../utils/drizzle';
import { billingDetails, billings } from '../../../../database/schema';
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
                message: 'Cannot delete billing details of a paid bill',
            });
        }

        // Delete billing detail
        await db.delete(billingDetails).where(eq(billingDetails.id, detailId));

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
            message: 'Billing detail deleted successfully',
        };
    } catch (error: any) {
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Failed to delete billing detail',
        });
    }
});
