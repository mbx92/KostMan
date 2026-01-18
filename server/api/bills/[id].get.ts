import { db } from '../../utils/drizzle';
import { billings, billingDetails, rooms, tenants, payments } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { parseDecimal } from '../../utils/billing';

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

        // Fetch bill with related data
        const result = await db
            .select({
                bill: billings,
                room: rooms,
                tenant: tenants,
            })
            .from(billings)
            .leftJoin(rooms, eq(billings.roomId, rooms.id))
            .leftJoin(tenants, eq(billings.tenantId, tenants.id))
            .where(eq(billings.id, billId))
            .limit(1);

        if (!result.length) {
            throw createError({
                statusCode: 404,
                message: 'Bill not found',
            });
        }

        const { bill, room, tenant } = result[0];

        // Fetch billing details
        const details = await db
            .select()
            .from(billingDetails)
            .where(eq(billingDetails.billId, billId));

        // Fetch payments
        const billPayments = await db
            .select()
            .from(payments)
            .where(eq(payments.billId, billId));

        // Calculate total paid
        const totalPaid = billPayments.reduce(
            (sum, payment) => sum + parseDecimal(payment.paymentAmount),
            0
        );

        return {
            success: true,
            data: {
                ...bill,
                monthsCovered: parseDecimal(bill.monthsCovered),
                totalChargedAmount: parseDecimal(bill.totalChargedAmount),
                totalPaid,
                balance: parseDecimal(bill.totalChargedAmount) - totalPaid,
                room,
                tenant,
                details: details.map(detail => ({
                    ...detail,
                    itemQty: parseDecimal(detail.itemQty),
                    itemUnitPrice: parseDecimal(detail.itemUnitPrice),
                    itemSubAmount: parseDecimal(detail.itemSubAmount),
                    itemDiscount: parseDecimal(detail.itemDiscount),
                    itemTotalAmount: parseDecimal(detail.itemTotalAmount),
                })),
                payments: billPayments.map(payment => ({
                    ...payment,
                    paymentAmount: parseDecimal(payment.paymentAmount),
                })),
            },
        };
    } catch (error: any) {
        console.error('Error fetching bill:', error);

        // Re-throw HTTP errors
        if (error.statusCode) {
            throw error;
        }

        // Generic error
        throw createError({
            statusCode: 500,
            message: error.message || 'Failed to fetch bill',
        });
    }
});
