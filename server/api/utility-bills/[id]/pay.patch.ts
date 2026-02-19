import { requireRole, Role } from '../../../utils/permissions';
import { updateUtilityBillPaid } from '../../../services/utilityBillService';

export default defineEventHandler(async (event) => {
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
    }

    return await updateUtilityBillPaid(id);
});

