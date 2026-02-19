
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings, rooms, propertySettings } from '../../database/schema';
import { meterReadingSchema } from '../../validations/meter-reading';
import { eq } from 'drizzle-orm';
import { createUtilityBill, findUtilityBillByRoomAndPeriod, updateUtilityBill } from '../../services/utilityBillService';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    const body = await readBody(event);
    const validatedData = meterReadingSchema.parse(body);

    try {
        const result = await db.transaction(async (tx) => {
            // Upsert meter reading
            const meterResult = await tx.insert(meterReadings)
                .values({
                    ...validatedData,
                    recordedAt: new Date(),
                    recordedBy: user.id
                })
                .onConflictDoUpdate({
                    target: [meterReadings.roomId, meterReadings.period],
                    set: {
                        meterStart: validatedData.meterStart,
                        meterEnd: validatedData.meterEnd,
                        recordedAt: new Date(),
                        recordedBy: user.id,
                        updatedAt: new Date()
                    }
                })
                .returning();

            const meterReading = meterResult[0];

            // Auto-create or update associated utility bill
            const room = await tx.select()
                .from(rooms)
                .where(eq(rooms.id, validatedData.roomId))
                .limit(1);

            let utilityBill = null;

            if (room.length > 0) {
                const roomData = room[0];

                // Jangan buat/update utility bill jika kamar belum ada penghuni
                if (!roomData.tenantId) {
                    return { meterReading, utilityBill };
                }

                const propSettings = await tx.select()
                    .from(propertySettings)
                    .where(eq(propertySettings.propertyId, roomData.propertyId))
                    .limit(1);

                if (propSettings.length > 0) {
                    const settings = propSettings[0];
                    const trashFee = roomData.useTrashService ? Number(settings.trashFee) : 0;

                    const billInput = {
                        roomId: validatedData.roomId,
                        period: validatedData.period,
                        meterStart: validatedData.meterStart,
                        meterEnd: validatedData.meterEnd,
                        costPerKwh: Number(settings.costPerKwh),
                        waterFee: Number(settings.waterFee),
                        trashFee: trashFee,
                    };

                    // Check if a utility bill already exists for this room+period
                    const existingBill = await findUtilityBillByRoomAndPeriod(validatedData.roomId, validatedData.period, tx);

                    if (existingBill) {
                        utilityBill = await updateUtilityBill(existingBill.id, billInput, user, tx);
                    } else {
                        utilityBill = await createUtilityBill(billInput, user, tx);
                    }
                }
            }

            return { meterReading, utilityBill };
        });

        return result;
    } catch (error: any) {
        console.error('Meter reading upsert error:', error);

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


