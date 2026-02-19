import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings, rooms, propertySettings } from '../../database/schema';
import { meterReadingSchema } from '../../validations/meter-reading';
import { eq, and } from 'drizzle-orm';
import { createUtilityBill } from '../../services/utilityBillService';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    const body = await readBody(event);
    const validatedData = meterReadingSchema.parse(body);

    // Check for existing meter reading for this room and period
    const existingReading = await db.select()
        .from(meterReadings)
        .where(and(
            eq(meterReadings.roomId, validatedData.roomId),
            eq(meterReadings.period, validatedData.period)
        ))
        .limit(1);

    if (existingReading.length > 0) {
        throw createError({
            statusCode: 409,
            statusMessage: 'Conflict',
            message: `Meter reading untuk periode "${validatedData.period}" pada kamar ini sudah ada. Hapus data lama jika ingin mengubah.`
        });
    }

    try {
        const result = await db.transaction(async (tx) => {
            // Insert meter reading
            const meterResult = await tx.insert(meterReadings).values({
                ...validatedData,
                recordedAt: new Date(),
                recordedBy: user.id
            }).returning();

            const meterReading = meterResult[0];

            // Auto-create utility bill from meter reading
            const room = await tx.select()
                .from(rooms)
                .where(eq(rooms.id, validatedData.roomId))
                .limit(1);

            let utilityBill = null;

            if (room.length > 0) {
                const roomData = room[0];

                const propSettings = await tx.select()
                    .from(propertySettings)
                    .where(eq(propertySettings.propertyId, roomData.propertyId))
                    .limit(1);

                if (propSettings.length > 0) {
                    const settings = propSettings[0];
                    const trashFee = roomData.useTrashService ? Number(settings.trashFee) : 0;

                    utilityBill = await createUtilityBill({
                        roomId: validatedData.roomId,
                        period: validatedData.period,
                        meterStart: validatedData.meterStart,
                        meterEnd: validatedData.meterEnd,
                        costPerKwh: Number(settings.costPerKwh),
                        waterFee: Number(settings.waterFee),
                        trashFee: trashFee,
                    }, user, tx);
                }
            }

            return { meterReading, utilityBill };
        });

        return result;
    } catch (error: any) {
        console.error('Meter reading insert error:', error);

        // Re-throw H3 errors (createError) as-is
        if (error.statusCode) {
            throw error;
        }

        const isDuplicate =
            error?.code === '23505' ||
            (error?.message && typeof error.message === 'string' && (
                error.message.toLowerCase().includes('unique') ||
                error.message.toLowerCase().includes('duplicate')
            )) ||
            String(error).toLowerCase().includes('unique constraint');

        if (isDuplicate) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Conflict',
                message: `Meter reading untuk periode "${validatedData.period}" pada kamar ini sudah ada (mungkin di sampah/deleted). Hapus permanen data lama jika ingin input ulang.`
            });
        }

        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: 'Gagal menyimpan meter reading. Terjadi kesalahan server.'
        });
    }
});


