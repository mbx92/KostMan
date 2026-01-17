import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { bills, rooms, tenants, properties, propertySettings } from '../../database/schema';
import { billGenerateSchema } from '../../validations/bill';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    const body = await readBody(event);
    const parseResult = billGenerateSchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.errors,
        });
    }

    const input = parseResult.data;

    // 1. Verify room exists and get room details
    const room = await db.select()
        .from(rooms)
        .where(eq(rooms.id, input.roomId))
        .limit(1);

    if (room.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Room not found' });
    }

    const roomData = room[0];

    // 2. Ownership verification (if not admin)
    if (user.role !== Role.ADMIN) {
        const property = await db.select()
            .from(properties)
            .where(eq(properties.id, roomData.propertyId))
            .limit(1);

        if (property.length === 0 || property[0].userId !== user.id) {
            throw createError({ statusCode: 403, statusMessage: 'Forbidden: You do not own this property' });
        }
    }

    // 3. Check if tenant already paid for this period
    // This prevents duplicate bills for the same tenant in the same period
    if (roomData.tenantId) {
        const existingBill = await db.select()
            .from(bills)
            .where(
                and(
                    eq(bills.tenantId, roomData.tenantId),
                    eq(bills.period, input.period),
                    eq(bills.isPaid, true)
                )
            )
            .limit(1);

        if (existingBill.length > 0) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Tenant has already paid for this period'
            });
        }
    }

    // 4. Calculate costs with proration support
    const monthsCovered = input.monthsCovered || 1;

    // Proration calculation for first month if moveInDate is mid-month
    let prorationFactor = 1; // Default: full month
    let isProrated = false;

    if (roomData.moveInDate) {
        const moveInDate = new Date(roomData.moveInDate);
        const billPeriodDate = new Date(input.period + '-01');

        // Check if this is the first billing period (same month as move-in)
        const isSameMonth = moveInDate.getFullYear() === billPeriodDate.getFullYear() &&
            moveInDate.getMonth() === billPeriodDate.getMonth();

        if (isSameMonth && moveInDate.getDate() > 1) {
            // Calculate proration factor
            const daysInMonth = new Date(billPeriodDate.getFullYear(), billPeriodDate.getMonth() + 1, 0).getDate();
            const daysOccupied = daysInMonth - moveInDate.getDate() + 1; // +1 to include move-in day
            prorationFactor = daysOccupied / daysInMonth;
            isProrated = true;
        }
    }

    // Apply proration to recurring charges (room price, water, trash)
    const roomPrice = parseFloat(roomData.price) * monthsCovered * prorationFactor;
    const usageCost = (input.meterEnd - input.meterStart) * input.costPerKwh; // Usage is not prorated
    const waterFee = input.waterFee * monthsCovered * prorationFactor;
    const trashFee = roomData.useTrashService ? input.trashFee * monthsCovered * prorationFactor : 0;
    const additionalCost = input.additionalCost || 0;
    const totalAmount = roomPrice + usageCost + waterFee + trashFee + additionalCost;

    // 5. Calculate periodEnd if multi-month
    let periodEnd = input.periodEnd;
    if (monthsCovered > 1 && !periodEnd) {
        const startDate = new Date(input.period + '-01');
        startDate.setMonth(startDate.getMonth() + monthsCovered - 1);
        periodEnd = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    }

    // 6. Insert bill
    const newBill = await db.insert(bills).values({
        roomId: input.roomId,
        tenantId: roomData.tenantId || null,
        period: input.period,
        periodEnd: periodEnd || null,
        monthsCovered: monthsCovered,
        meterStart: input.meterStart,
        meterEnd: input.meterEnd,
        costPerKwh: input.costPerKwh.toString(),
        roomPrice: roomPrice.toString(),
        usageCost: usageCost.toString(),
        waterFee: waterFee.toString(),
        trashFee: trashFee.toString(),
        additionalCost: additionalCost.toString(),
        totalAmount: totalAmount.toString(),
        isPaid: false,
        generatedAt: new Date(),
    }).returning();

    return newBill[0];
});
