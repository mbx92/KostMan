import { db } from '../../utils/drizzle';
import { billings } from '../../database/schema';
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

        // Only allow deleting draft bills
        if (existingBill[0].billStatus !== 'draft') {
            throw createError({
                statusCode: 400,
                message: 'Only draft bills can be deleted',
            });
        }

        // Delete bill (cascade will delete billing_details)
        await db.delete(billings).where(eq(billings.id, billId));

        return {
            success: true,
            message: 'Bill deleted successfully',
        };
    } catch (error: any) {
        console.error('Error deleting bill:', error);

        // Re-throw HTTP errors
        if (error.statusCode) {
            throw error;
        }

        // Generic error
        throw createError({
            statusCode: 500,
            message: error.message || 'Failed to delete bill',
        });
    }
});
