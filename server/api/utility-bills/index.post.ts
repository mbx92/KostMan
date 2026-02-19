import { requireRole, Role } from '../../utils/permissions';
import { utilityBillCreateSchema } from '../../validations/billing';
import { createUtilityBill } from '../../services/utilityBillService';

export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER]);

    const body = await readBody(event);
    const parseResult = utilityBillCreateSchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const newBill = await createUtilityBill(parseResult.data, user);

    return newBill;
});

