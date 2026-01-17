import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings } from '../../database/schema';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID param' });
    }

    const existing = await db.select().from(meterReadings).where(eq(meterReadings.id, id)).limit(1);
    if (!existing.length) {
        throw createError({ statusCode: 404, statusMessage: 'Meter reading not found' });
    }
    const reading = existing[0];

    // Permission check: "Delete reading (only owner and user that record it)"
    // Interpreting "owner" as the role Owner OR the specific user who recorded it?
    // "only owner AND user that record it" - phrasing is tricky.
    // Likely means: The Property Owner (Role.OWNER) OR The specific user (Role.STAFF/ADMIN?) who created it.
    // But usually owner can delete anything.
    // Let's assume Role.OWNER is always allowed.
    // And if not Owner role, then must be the recorder.

    const isRecorder = reading.recordedBy === user.id;
    const isOwner = user.role === Role.OWNER;
    const isAdmin = user.role === Role.ADMIN; // Admins usually can do everything

    if (!isOwner && !isAdmin && !isRecorder) {
        throw createError({ statusCode: 403, statusMessage: 'You are not authorized to delete this reading' });
    }

    await db.delete(meterReadings).where(eq(meterReadings.id, id));

    return { message: 'Meter reading deleted successfully' };
});
