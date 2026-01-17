import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings } from '../../database/schema';
import { meterReadingSchema } from '../../validations/meter-reading';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

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
        const result = await db.insert(meterReadings).values({
            ...validatedData,
            recordedAt: new Date(),
            recordedBy: user.id
        }).returning();

        return result[0];
    } catch (error: any) {
        // Log the error for debugging
        console.error('Meter reading insert error:', error);
        
        // Robust check for unique constraint violation
        // Check both object properties and string representation
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
