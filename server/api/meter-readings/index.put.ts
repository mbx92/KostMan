
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings } from '../../database/schema';
import { meterReadingSchema } from '../../validations/meter-reading';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    const body = await readBody(event);
    const validatedData = meterReadingSchema.parse(body);

    try {
        // Upsert strategy: On Conflict, Update.
        // However, Drizzle ORM's `onConflictDoUpdate` is the cleanest way if database supports it.
        // Since we have a unique constraint on (roomId, period), we can use it.

        const result = await db.insert(meterReadings)
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

        return result[0];
    } catch (error: any) {
        console.error('Meter reading upsert error:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error',
            message: 'Gagal update meter reading. Terjadi kesalahan server.'
        });
    }
});
