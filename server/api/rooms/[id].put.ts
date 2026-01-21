
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rooms, properties, rentBills } from '../../database/schema';
import { roomSchema } from '../../validations/room';
import { eq, and, ne } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // 1. Get Room ID
    const id = getRouterParam(event, 'id');
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'ID tidak ditemukan' });
    }

    // 2. Role Check
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    // 3. Validate Body
    const body = await readBody(event);
    const parseResult = roomSchema.partial().safeParse(body); // Partial for updates

    if (!parseResult.success) {
        throw createError({ statusCode: 400, statusMessage: 'Validation Error', data: parseResult.error.issues });
    }

    const input = parseResult.data;

    // 4. Ownership Verification
    const currentRoomResult = await db.select({
        room: rooms,
        property: properties
    })
        .from(rooms)
        .innerJoin(properties, eq(rooms.propertyId, properties.id))
        .where(eq(rooms.id, id))
        .limit(1);

    if (currentRoomResult.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Kamar tidak ditemukan' });
    }

    const { property, room } = currentRoomResult[0];

    if (user.role !== Role.ADMIN) {
        if (property.userId !== user.id) {
            throw createError({ statusCode: 403, statusMessage: 'Akses ditolak' });
        }
    }

    // 5. Check Uniqueness (if name is being updated)
    if (input.name) {
        const existing = await db.select().from(rooms).where(
            and(
                eq(rooms.propertyId, property.id),
                eq(rooms.name, input.name),
                ne(rooms.id, id) // Exclude self
            )
        ).limit(1);

        if (existing.length > 0) {
            throw createError({ statusCode: 409, statusMessage: 'Nama kamar sudah ada di properti ini' });
        }
    }

    // 6. Update
    const updatedRoom = await db.update(rooms).set({
        ...input,
        price: input.price ? input.price.toString() : undefined,
        status: input.status as any,
    }).where(eq(rooms.id, id)).returning();

    // 7. Auto-generate first rent bill if:
    //    - New moveInDate is being set (wasn't set before or changed)
    //    - tenantId is provided (either in input or existing)
    const effectiveMoveInDate = input.moveInDate ?? room.moveInDate;
    const effectiveTenantId = input.tenantId ?? room.tenantId;
    const effectivePrice = input.price ?? Number(room.price);

    // Only auto-generate if moveInDate is being newly set (wasn't set before)
    const isNewMoveIn = input.moveInDate && !room.moveInDate && effectiveTenantId;

    if (isNewMoveIn && updatedRoom[0]) {
        try {
            // Check if a rent bill already exists for this room starting from moveInDate
            const existingBills = await db.select()
                .from(rentBills)
                .where(eq(rentBills.roomId, id))
                .limit(1);

            if (existingBills.length === 0) {
                // No existing bills, create first one
                const moveInDateStr = input.moveInDate!;
                const startDate = new Date(moveInDateStr + 'T00:00:00');
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 1);
                endDate.setDate(endDate.getDate() - 1);

                const periodStartDate = moveInDateStr;
                const periodEndDate = endDate.toISOString().slice(0, 10);
                const dueDate = periodEndDate;
                const billingCycleDay = startDate.getDate();
                const period = moveInDateStr.slice(0, 7);

                const roomPrice = Number(effectivePrice);
                const totalAmount = roomPrice;

                await db.insert(rentBills).values({
                    roomId: id,
                    tenantId: effectiveTenantId,
                    periodStartDate: periodStartDate,
                    periodEndDate: periodEndDate,
                    dueDate: dueDate,
                    billingCycleDay: billingCycleDay,
                    period: period,
                    monthsCovered: 1,
                    roomPrice: roomPrice.toString(),
                    totalAmount: totalAmount.toString(),
                    isPaid: false,
                    generatedAt: new Date(),
                });

                console.log(`[Auto-Bill] Created first rent bill for room ${updatedRoom[0].name} (${periodStartDate} - ${periodEndDate})`);
            }
        } catch (error) {
            console.error('[Auto-Bill] Failed to create first rent bill:', error);
        }
    }

    return updatedRoom[0];
});
