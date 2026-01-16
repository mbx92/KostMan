import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings } from '../../database/schema';
import { meterReadingUpdateSchema } from '../../validations/meter-reading';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID param' });
    }

    const body = await readBody(event);
    const validatedData = meterReadingUpdateSchema.parse(body);

    // If both start and end are provided, validator checks relation.
    // If only one is provided, we might need to check against db value to ensure consistency?
    // Implementation plan constraint: CHECK(meterEnd >= meterStart)
    // For now, relying on simple schema validation. Complex cross-row validation (patching one field while checking another in DB) might be good but maybe overkill for MVP unless critical.
    // Let's check if we need to enforce DB check. The validation schema handles if both provided.
    // Ideally patch might need to fetch existing to validate constraint if only one field changes.
    // I'll add a quick fetch and validate.

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

    const result = await db.update(meterReadings)
        .set({
            ...validatedData,
            updatedAt: new Date()
        })
        .where(eq(meterReadings.id, id))
        .returning();

    return result[0];
});
