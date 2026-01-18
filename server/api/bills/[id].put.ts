import { db } from '../../utils/drizzle';
import { billings } from '../../database/schema';
import { updateBillSchema } from '../../validations/billing';
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
        const validatedData = updateBillSchema.parse(body);

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

        // Prevent updating paid bills
        if (existingBill[0].billStatus === 'paid' && validatedData.billStatus !== 'paid') {
            throw createError({
                statusCode: 400,
                message: 'Cannot modify a paid bill',
            });
        }

        // Update bill
        const [updatedBill] = await db
            .update(billings)
            .set({
                ...validatedData,
                updatedAt: new Date(),
            })
            .where(eq(billings.id, billId))
            .returning();

        return {
            success: true,
            message: 'Bill updated successfully',
            data: updatedBill,
        };
    } catch (error: any) {
        console.error('Error updating bill:', error);

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
            message: error.message || 'Failed to update bill',
        });
    }
});
