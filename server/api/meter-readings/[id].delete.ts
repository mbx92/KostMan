import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { meterReadings } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { findUtilityBillByRoomAndPeriod, deleteUtilityBill } from '../../services/utilityBillService';

function getPreviousPeriod(period: string) {
    const [year, month] = period.split('-').map(Number);
    const previous = new Date(year, month - 2, 1);
    return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

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

    const isRecorder = reading.recordedBy === user.id;
    const isOwner = user.role === Role.OWNER;
    const isAdmin = user.role === Role.ADMIN;

    if (!isOwner && !isAdmin && !isRecorder) {
        throw createError({ statusCode: 403, statusMessage: 'You are not authorized to delete this reading' });
    }

    // Check if associated utility bill exists and is paid
    const associatedBill = await findUtilityBillByRoomAndPeriod(reading.roomId, getPreviousPeriod(reading.period));

    if (associatedBill && associatedBill.isPaid) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Cannot delete meter reading because the associated utility bill is already paid',
        });
    }

    // Delete both in a transaction
    await db.transaction(async (tx) => {
        if (associatedBill) {
            await deleteUtilityBill(associatedBill.id, user, tx);
        }
        await tx.delete(meterReadings).where(eq(meterReadings.id, id));
    });

    return { message: 'Meter reading and associated utility bill deleted successfully' };
});


