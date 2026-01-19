import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rentBills, rooms, properties, propertySettings } from '../../database/schema';
import { rentBillGenerateSchema } from '../../validations/billing';
import { eq } from 'drizzle-orm';

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

    // Calculate totals - NO PRORATION (full monthly billing only)
    const monthsCovered = input.monthsCovered || 1;
    const roomPrice = Number(input.roomPrice) * monthsCovered;

    // For multi-month billing: include water + trash (exclude electricity/kWh)
    let waterFee = 0;
    let trashFee = 0;
    
    if (monthsCovered > 1) {
        // Get property settings for water/trash fees
        const propSettings = await db.select()
            .from(propertySettings)
            .where(eq(propertySettings.propertyId, roomData.propertyId))
            .limit(1);

        const occupantCount = roomData.occupantCount || 1;
        const baseWaterFee = propSettings.length > 0 ? Number(propSettings[0].waterFee) : 0;
        const baseTrashFee = propSettings.length > 0 ? Number(propSettings[0].trashFee) : 0;
        
        // Water fee multiplied by occupant count and months
        waterFee = baseWaterFee * occupantCount * monthsCovered;
        // Trash fee only if room uses trash service
        trashFee = roomData.useTrashService ? baseTrashFee * monthsCovered : 0;
    }

    const totalAmount = roomPrice + waterFee + trashFee;

    // Calculate periodEnd for multi-month
    let periodEnd = input.periodEnd;
    if (monthsCovered > 1 && !periodEnd) {
        const startDate = new Date(input.period + '-01');
        startDate.setMonth(startDate.getMonth() + monthsCovered - 1);
        periodEnd = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    }

    // Generate list of all months covered by this new bill
    const newBillMonths: string[] = [];
    const startDate = new Date(input.period + '-01');
    for (let i = 0; i < monthsCovered; i++) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        newBillMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // Check for overlapping rent bills
    const existingBills = await db.select().from(rentBills).where(eq(rentBills.roomId, input.roomId));
    
    for (const existingBill of existingBills) {
        // Generate months covered by existing bill
        const existingMonths: string[] = [];
        const existingStart = new Date(existingBill.period + '-01');
        const existingMonthsCovered = existingBill.monthsCovered || 1;
        for (let i = 0; i < existingMonthsCovered; i++) {
            const d = new Date(existingStart);
            d.setMonth(d.getMonth() + i);
            existingMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        // Check for overlap
        const overlap = newBillMonths.find(m => existingMonths.includes(m));
        if (overlap) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Conflict',
                message: `Rent bill untuk periode "${overlap}" pada kamar ini sudah ada. Hapus rent bill yang lama terlebih dahulu.`
            });
        }
    }

    // Insert rent bill
    const newBill = await db.insert(rentBills).values({
        roomId: input.roomId,
        tenantId: roomData.tenantId || null,
        period: input.period,
        periodEnd: periodEnd || null,
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
