import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings } from '../../database/schema';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER]);

    const query = getQuery(event);
    const roomId = query.roomId as string | undefined;

    if (roomId) {
        return await db.select().from(meterReadings).where(eq(meterReadings.roomId, roomId));
    }

    // Optional: if no roomId provided, maybe return all readings? Or enforce roomId?
    // Implementation plan says: /api/meter-readings?roomId=:id -> List readings by room
    // I will return empty or throw error if roomId is missing for safety, or allow listing all if useful.
    // Let's allow listing all for now but usually its paginated. 
    // Given the prompt "List readings by room", implying filtration is key.

    return await db.select().from(meterReadings);
});
