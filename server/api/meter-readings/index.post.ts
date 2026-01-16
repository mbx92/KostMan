import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings } from '../../database/schema';
import { meterReadingSchema } from '../../validations/meter-reading';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    const body = await readBody(event);
    const validatedData = meterReadingSchema.parse(body);

    const result = await db.insert(meterReadings).values({
        ...validatedData,
        recordedAt: new Date(),
        recorderBy: user.id
    }).returning();

    return result[0];
});
