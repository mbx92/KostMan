import { requireRole, Role } from '../../../utils/permissions';
import { deleteUtilityBill } from '../../../services/utilityBillService';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);
    const id = getRouterParam(event, 'id');

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID' });
    }

    return await deleteUtilityBill(id, user);
});

