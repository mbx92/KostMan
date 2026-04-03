import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings, rooms } from '../../database/schema';
import { meterReadingUpdateSchema } from '../../validations/meter-reading';
import { eq } from 'drizzle-orm';
import { findUtilityBillByRoomAndPeriod, resolveRoomUtilitySettings, updateUtilityBill } from '../../services/utilityBillService';
import { autoGenerateRentBill } from '../../utils/rentBillService';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID param' });
    }

    const body = await readBody(event);
    const validatedData = meterReadingUpdateSchema.parse(body);

    // Fetch existing reading
    const existing = await db.select().from(meterReadings).where(eq(meterReadings.id, id)).limit(1);
    if (!existing.length) {
        throw createError({ statusCode: 404, statusMessage: 'Meter reading not found' });
    }
    const current = existing[0];

    const newStart = validatedData.meterStart ?? current.meterStart;
    const newEnd = validatedData.meterEnd ?? current.meterEnd;

    if (newEnd < newStart) {
        throw createError({ statusCode: 400, statusMessage: 'Meter end must be greater than or equal to meter start' });
    }

    try {
        const result = await db.transaction(async (tx) => {
            // Update meter reading
            const meterResult = await tx.update(meterReadings)
                .set({
                    ...validatedData,
                    updatedAt: new Date()
                })
                .where(eq(meterReadings.id, id))
                .returning();

            const meterReading = meterResult[0];

            // Sync associated utility bill
            let utilityBill = null;
            const existingBill = await findUtilityBillByRoomAndPeriod(current.roomId, current.period, tx);

            if (existingBill) {
                // Get room and property settings for recalculation
                const room = await tx.select()
                    .from(rooms)
                    .where(eq(rooms.id, current.roomId))
                    .limit(1);

                if (room.length > 0) {
                    const roomData = room[0];

                    const resolvedSettings = await resolveRoomUtilitySettings(current.roomId, tx);
                    const trashFee = roomData.useTrashService ? resolvedSettings.trashFee : 0;

                    utilityBill = await updateUtilityBill(existingBill.id, {
                        roomId: current.roomId,
                        period: current.period,
                        meterStart: newStart,
                        meterEnd: newEnd,
                        costPerKwh: resolvedSettings.costPerKwh,
                        waterFee: resolvedSettings.waterFee,
                        trashFee,
                    }, user, tx);
                }
            }

            // Auto-generate rent bill for this billing cycle (if not already exists)
            const rentBill = await autoGenerateRentBill(current.roomId, current.period, tx);

            return { meterReading, utilityBill, rentBill };
        });

        return result;
    } catch (error: any) {
        console.error('Meter reading patch error:', error);

        // Re-throw H3 errors (createError) as-is
        if (error.statusCode) {
            throw error;
        }

        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: 'Gagal update meter reading. Terjadi kesalahan server.'
        });
    }
});
