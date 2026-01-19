import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { utilityBills, rooms, properties } from '../../database/schema';
import { utilityBillCreateSchema } from '../../validations/billing';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    const body = await readBody(event);
    const parseResult = utilityBillCreateSchema.safeParse(body);

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

    // Calculate costs - waterFee multiplied by occupant count
    const occupantCount = roomData.occupantCount || 1;
    const usageCost = (input.meterEnd - input.meterStart) * input.costPerKwh;
    const adjustedWaterFee = input.waterFee * occupantCount;
    const totalAmount = usageCost + adjustedWaterFee + input.trashFee + (input.additionalCost || 0);

    // Insert utility bill
    const newBill = await db.insert(utilityBills).values({
        roomId: input.roomId,
        tenantId: roomData.tenantId || null,
        period: input.period,
        meterStart: input.meterStart,
        meterEnd: input.meterEnd,
        costPerKwh: input.costPerKwh.toString(),
        usageCost: usageCost.toString(),
        waterFee: adjustedWaterFee.toString(), // Store adjusted water fee
        trashFee: input.trashFee.toString(),
        additionalCost: (input.additionalCost || 0).toString(),
        totalAmount: totalAmount.toString(),
        isPaid: false,
        generatedAt: new Date(),
    }).returning();

    return newBill[0];
});

