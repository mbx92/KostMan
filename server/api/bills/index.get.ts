import { db } from '../../utils/drizzle';
import { billings, billingDetails, rooms, tenants } from '../../database/schema';
import { queryBillsSchema } from '../../validations/billing';
import { eq, and, gte, lte } from 'drizzle-orm';
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

        // Parse and validate query parameters
        const query = getQuery(event);
        const validatedQuery = queryBillsSchema.parse(query);

        // Build where conditions
        const conditions = [];

        if (validatedQuery.roomId) {
            conditions.push(eq(billings.roomId, validatedQuery.roomId));
        }

        if (validatedQuery.tenantId) {
            conditions.push(eq(billings.tenantId, validatedQuery.tenantId));
        }

        if (validatedQuery.billStatus) {
            conditions.push(eq(billings.billStatus, validatedQuery.billStatus));
        }

        if (validatedQuery.periodStart) {
            conditions.push(gte(billings.periodStart, validatedQuery.periodStart));
        }

        if (validatedQuery.periodEnd) {
            conditions.push(lte(billings.periodEnd, validatedQuery.periodEnd));
        }

        // Fetch bills with related data
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const bills = await db
            .select({
                bill: billings,
                room: rooms,
                tenant: tenants,
            })
            .from(billings)
            .leftJoin(rooms, eq(billings.roomId, rooms.id))
            .leftJoin(tenants, eq(billings.tenantId, tenants.id))
            .where(whereClause)
            .orderBy(billings.createdAt);

        // Fetch details for each bill
        const billsWithDetails = await Promise.all(
            bills.map(async ({ bill, room, tenant }) => {
                const details = await db
                    .select()
                    .from(billingDetails)
                    .where(eq(billingDetails.billId, bill.id));

                return {
                    ...bill,
                    monthsCovered: parseDecimal(bill.monthsCovered),
                    totalChargedAmount: parseDecimal(bill.totalChargedAmount),
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
                };
            })
        );

        return {
            success: true,
            data: billsWithDetails,
        };
    } catch (error: any) {
        console.error('Error fetching bills:', error);

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
            message: error.message || 'Failed to fetch bills',
        });
    }
});
