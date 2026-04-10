import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { tenants, rooms } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Parameter ID tidak ditemukan' });
    }

    const linkedRoom = await db.select({ id: rooms.id })
        .from(rooms)
        .where(eq(rooms.tenantId, id))
        .limit(1);

    if (linkedRoom.length > 0) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Penghuni masih terhubung ke kamar. Checkout penghuni dari kamar terlebih dahulu.',
        });
    }

    const result = await db.update(tenants)
        .set({ status: 'inactive' })
        .where(eq(tenants.id, id))
        .returning();

    if (!result.length) {
        throw createError({ statusCode: 404, statusMessage: 'Penghuni tidak ditemukan' });
    }

    return { message: 'Penghuni berhasil dinonaktifkan' };
});
