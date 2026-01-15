import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { bills } from '../../database/schema';

export default defineEventHandler(async (event) => {
    // Staff can manage payment, so they need access to bills
    requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);

    // For now, return all bills. 
    // In a real implementation with tenant isolation, we would filter based on the user's assigned property.
    const allBills = await db.select().from(bills);

    return allBills;
});
