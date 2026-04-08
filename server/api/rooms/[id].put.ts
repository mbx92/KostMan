
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { rooms, properties, rentBills, roomSettings } from '../../database/schema';
import { roomSchema } from '../../validations/room';
import { eq, and, ne } from 'drizzle-orm';
import { syncUnpaidUtilityBillsForRoom } from '../../services/utilityBillService';

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
    const { overrideSettings, costPerKwh, waterFee, trashFee, ...roomUpdates } = input;
    const effectiveTenantId = roomUpdates.tenantId !== undefined ? roomUpdates.tenantId : room.tenantId;
    const sameTenantContinues = !!room.tenantId && effectiveTenantId === room.tenantId;
    const shouldSyncUtilityBills = sameTenantContinues && (
        input.occupantCount !== undefined ||
        input.useTrashService !== undefined ||
        overrideSettings !== undefined ||
        costPerKwh !== undefined ||
        waterFee !== undefined ||
        trashFee !== undefined
    );

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
    const updatedRoom = await db.transaction(async (tx) => {
        const updated = await tx.update(rooms).set({
            ...roomUpdates,
            price: roomUpdates.price !== undefined ? roomUpdates.price.toString() : undefined,
            status: roomUpdates.status as any,
        }).where(eq(rooms.id, id)).returning();

        if (overrideSettings === true) {
            const existingSettings = await tx.select().from(roomSettings).where(eq(roomSettings.roomId, id)).limit(1);

            if (existingSettings.length > 0) {
                await tx.update(roomSettings).set({
                    costPerKwh: String(costPerKwh ?? 0),
                    waterFee: String(waterFee ?? 0),
                    trashFee: String(trashFee ?? 0),
                }).where(eq(roomSettings.roomId, id));
            } else {
                await tx.insert(roomSettings).values({
                    roomId: id,
                    costPerKwh: String(costPerKwh ?? 0),
                    waterFee: String(waterFee ?? 0),
                    trashFee: String(trashFee ?? 0),
                });
            }
        } else if (overrideSettings === false) {
            await tx.delete(roomSettings).where(eq(roomSettings.roomId, id));
        }

        if (shouldSyncUtilityBills) {
            await syncUnpaidUtilityBillsForRoom(id, user, tx);
        }

        return updated;
    });

    // 7. Auto-generate first rent bill when:
    //   - Room has a tenant (existing or newly assigned)
    //   - Room has a moveInDate (existing or newly set/changed)
    //   - No overlapping bill exists (checked below, prevents duplicates)
    const effectiveMoveInDate = roomUpdates.moveInDate !== undefined ? roomUpdates.moveInDate : room.moveInDate;
    const effectivePrice = roomUpdates.price ?? Number(room.price);

    // Trigger: has tenant + has moveInDate (any of these changed or already existed)
    const shouldAutoGenerateBill = !!effectiveTenantId && !!effectiveMoveInDate;

    if (shouldAutoGenerateBill && updatedRoom[0]) {
        try {
            const moveInDateStr = effectiveMoveInDate!;
            const startDate = new Date(moveInDateStr + 'T00:00:00');
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(endDate.getDate() - 1);

            const periodStartDate = moveInDateStr;
            const periodEndDate = endDate.toISOString().slice(0, 10);
            const dueDate = periodEndDate;
            const billingCycleDay = startDate.getDate();
            const period = moveInDateStr.slice(0, 7);

            // Check if a rent bill with overlapping dates already exists (avoid duplicates)
            const existingBills = await db.select()
                .from(rentBills)
                .where(eq(rentBills.roomId, id));

            const newStart = new Date(periodStartDate).getTime();
            const newEnd = new Date(periodEndDate).getTime();
            const hasOverlap = existingBills.some((b: any) => {
                const s = new Date(b.periodStartDate).getTime();
                const e = new Date(b.periodEndDate).getTime();
                return newStart <= e && newEnd >= s;
            });

            if (!hasOverlap) {
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
            } else {
                console.log(`[Auto-Bill] Skipped: overlapping bill exists for room ${updatedRoom[0].name}`);
            }
        } catch (error) {
            console.error('[Auto-Bill] Failed to create first rent bill:', error);
        }
    }

    return updatedRoom[0];
});
