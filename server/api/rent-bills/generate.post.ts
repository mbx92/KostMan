import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rentBills, rooms, properties, propertySettings } from '../../database/schema';
import { rentBillGenerateSchema } from '../../validations/billing';
import { eq, and, or, lte, gte } from 'drizzle-orm';

/**
 * Helper: Calculate period end date (start + monthsCovered, inclusive)
 * Note: End date is inclusive (last day tenant can stay)
 * For 3 months from Feb 18: Feb 18 + 3 months = May 18 (90 days inclusive)
 * Next period will start on May 19
 */
function calculatePeriodEndDate(startDateStr: string, monthsCovered: number = 1): string {
    const [year, month, day] = startDateStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + monthsCovered);
    // Don't subtract 1 day - end date is the last day tenant can stay
    return endDate.toISOString().split('T')[0];
}

/**
 * Helper: Extract billing cycle day from a date
 */
function extractBillingCycleDay(dateStr: string | null): number {
    if (!dateStr) return 1; // Default to 1st of month
    return new Date(dateStr).getDate();
}

/**
 * Helper: Generate legacy period string (YYYY-MM) from date
 */
function generateLegacyPeriod(dateStr: string): string {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Helper: Check if two date ranges overlap
 */
function dateRangesOverlap(
    start1: string, end1: string,
    start2: string, end2: string
): boolean {
    const s1 = new Date(start1).getTime();
    const e1 = new Date(end1).getTime();
    const s2 = new Date(start2).getTime();
    const e2 = new Date(end2).getTime();

    return s1 <= e2 && e1 >= s2;
}

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    const body = await readBody(event);
    const parseResult = rentBillGenerateSchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const input = parseResult.data;

    // Verify room exists
    const room = await db.select()
        .from(rooms)
        .where(eq(rooms.id, input.roomId))
        .limit(1);

    if (room.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Room not found' });
    }

    const roomData = room[0];

    // Ownership verification
    if (user.role !== Role.ADMIN) {
        const property = await db.select()
            .from(properties)
            .where(eq(properties.id, roomData.propertyId))
            .limit(1);

        if (property.length === 0 || property[0].userId !== user.id) {
            throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
        }
    }

    // Calculate dates
    const monthsCovered = input.monthsCovered || 1;
    const periodStartDate = input.periodStartDate;
    const periodEndDate = input.periodEndDate || calculatePeriodEndDate(periodStartDate, monthsCovered);
    const dueDate = input.dueDate || periodEndDate;
    const billingCycleDay = extractBillingCycleDay(roomData.moveInDate);
    
    // Legacy period for backward compatibility
    const period = generateLegacyPeriod(periodStartDate);

    // Calculate totals
    const roomPrice = Number(input.roomPrice) * monthsCovered;

    // Get property settings for water/trash fees
    const propSettings = await db.select()
        .from(propertySettings)
        .where(eq(propertySettings.propertyId, roomData.propertyId))
        .limit(1);

    const occupantCount = roomData.occupantCount || 1;
    const baseWaterFee = propSettings.length > 0 ? Number(propSettings[0].waterFee) : 0;
    const baseTrashFee = propSettings.length > 0 ? Number(propSettings[0].trashFee) : 0;
    
    // Water fee multiplied by occupant count and months
    const waterFee = baseWaterFee * occupantCount * monthsCovered;
    // Trash fee only if room uses trash service
    const trashFee = roomData.useTrashService ? baseTrashFee * monthsCovered : 0;

    const totalAmount = roomPrice + waterFee + trashFee;

    // Check for overlapping rent bills using date ranges
    const existingBills = await db.select().from(rentBills).where(eq(rentBills.roomId, input.roomId));
    
    for (const existingBill of existingBills) {
        const existingStart = existingBill.periodStartDate;
        const existingEnd = existingBill.periodEndDate;
        
        if (dateRangesOverlap(periodStartDate, periodEndDate, existingStart, existingEnd)) {
            const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { 
                day: 'numeric', month: 'short', year: 'numeric' 
            });
            throw createError({
                statusCode: 409,
                statusMessage: 'Conflict',
                message: `Rent bill untuk periode "${formatDate(existingStart)} - ${formatDate(existingEnd)}" sudah ada dan overlap dengan periode yang diminta. Hapus rent bill yang lama terlebih dahulu.`
            });
        }
    }

    // Insert rent bill with date-based fields
    const newBill = await db.insert(rentBills).values({
        roomId: input.roomId,
        tenantId: roomData.tenantId || null,
        
        // Date-based fields (primary)
        periodStartDate: periodStartDate,
        periodEndDate: periodEndDate,
        dueDate: dueDate,
        billingCycleDay: billingCycleDay,
        
        // Legacy fields (for backward compatibility)
        period: period,
        periodEnd: null, // No longer used for multi-month tracking
        
        monthsCovered: monthsCovered,
        roomPrice: roomPrice.toString(),
        waterFee: waterFee.toString(),
        trashFee: trashFee.toString(),
        totalAmount: totalAmount.toString(),
        isPaid: false,
        generatedAt: new Date(),
    }).returning();

    return newBill[0];
});
