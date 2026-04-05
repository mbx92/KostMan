import { requireRole, Role } from '../../../utils/permissions';
import { updateUtilityBillPaid } from '../../../services/utilityBillService';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);
    const id = getRouterParam(event, 'id');
    const body = await readBody<{ paymentMethod?: 'cash' | 'transfer' }>(event).catch(() => ({}));
    const paymentMethod = body.paymentMethod ?? 'cash';

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
    }

    if (!['cash', 'transfer'].includes(paymentMethod)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid payment method' });
    }

    return await updateUtilityBillPaid(id, paymentMethod);
});

