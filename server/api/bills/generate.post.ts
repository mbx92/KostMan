import { db } from '../../utils/drizzle';
import { billings, billingDetails, rooms, tenants } from '../../database/schema';
import { generateBillSchema } from '../../validations/billing';
import {
    calculateMonthsCovered,
    generateBillingCode,
    calculateRentCharges,
    calculateUtilityCharges,
    validateBillingPeriod,
    parseDecimal,
} from '../../utils/billing';
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

        // Parse and validate request body
        const body = await readBody(event);
        const validatedData = generateBillSchema.parse(body);

        const {
            roomId,
            tenantId,
            periodStart,
            periodEnd,
            notes,
            additionalCharges = [],
            includeRent = true,
            includeUtility = true,
        } = validatedData;

        // Validate room exists
        const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
        if (!room.length) {
            throw createError({
                statusCode: 404,
                message: 'Room not found',
            });
        }

        // Validate tenant exists
        const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
        if (!tenant.length) {
            throw createError({
                statusCode: 404,
                message: 'Tenant not found',
            });
        }

        // Validate billing period (no overlaps)
        await validateBillingPeriod(roomId, periodStart, periodEnd);

        // Calculate months covered
        const monthsCovered = calculateMonthsCovered(periodStart, periodEnd);

        // Generate billing code
        const billingCode = await generateBillingCode(periodStart);

        // Calculate rent charges (only if includeRent is true)
        let rentCharges = null;
        if (includeRent) {
            rentCharges = await calculateRentCharges(roomId, monthsCovered);
        }

        // Calculate utility charges (only if includeUtility is true)
        const utilityCharges = includeUtility
            ? await calculateUtilityCharges(roomId, periodStart, periodEnd)
            : [];

        // Prepare all billing details
        const allDetails = [
            ...(rentCharges ? [rentCharges] : []),
            ...utilityCharges,
            ...additionalCharges.map(charge => {
                const itemType = charge.itemType || 'others';
                return {
                    itemType: itemType as 'rent' | 'utility' | 'others',
                    itemName: charge.itemName,
                    itemQty: charge.itemQty,
                    itemUnitPrice: charge.itemUnitPrice,
                    itemSubAmount: charge.itemQty * charge.itemUnitPrice,
                    itemDiscount: charge.itemDiscount || 0,
                    itemTotalAmount: (charge.itemQty * charge.itemUnitPrice) - (charge.itemDiscount || 0),
                    notes: charge.notes,
                };
            }),
        ];

        // Calculate total charged amount
        const totalChargedAmount = allDetails.reduce(
            (sum, detail) => sum + detail.itemTotalAmount,
            0
        );

        // Start database transaction
        const result = await db.transaction(async (tx) => {
            // Insert billing record
            const [bill] = await tx
                .insert(billings)
                .values({
                    roomId,
                    tenantId,
                    billingCode,
                    billStatus: 'draft',
                    periodStart,
                    periodEnd,
                    monthsCovered: monthsCovered.toString(),
                    notes,
                    totalChargedAmount: totalChargedAmount.toString(),
                    generatedBy: event.context.user.id,
                })
                .returning();

            // Insert billing details
            const detailsToInsert = allDetails.map(detail => ({
                billId: bill.id,
                itemType: detail.itemType,
                itemName: detail.itemName,
                itemQty: detail.itemQty.toString(),
                itemUnitPrice: detail.itemUnitPrice.toString(),
                itemSubAmount: detail.itemSubAmount.toString(),
                itemDiscount: detail.itemDiscount.toString(),
                itemTotalAmount: detail.itemTotalAmount.toString(),
                notes: detail.notes,
            }));

            const insertedDetails = await tx
                .insert(billingDetails)
                .values(detailsToInsert)
                .returning();

            return {
                bill,
                details: insertedDetails,
            };
        });

        // Return success response
        return {
            success: true,
            message: 'Bill generated successfully',
            data: {
                ...result.bill,
                monthsCovered: parseDecimal(result.bill.monthsCovered),
                totalChargedAmount: parseDecimal(result.bill.totalChargedAmount),
                details: result.details.map(detail => ({
                    ...detail,
                    itemQty: parseDecimal(detail.itemQty),
                    itemUnitPrice: parseDecimal(detail.itemUnitPrice),
                    itemSubAmount: parseDecimal(detail.itemSubAmount),
                    itemDiscount: parseDecimal(detail.itemDiscount),
                    itemTotalAmount: parseDecimal(detail.itemTotalAmount),
                })),
            },
        };
    } catch (error: any) {
        console.error('Error generating bill:', error);

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
            message: error.message || 'Failed to generate bill',
        });
    }
});
