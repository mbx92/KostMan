import {
    users,
    properties,
    expenses,
    whatsappTemplates,
    payments,
    meterReadings,
    systemLogs,
    backups,
    globalSettings,
    integrationSettings,
    expenseCategories
} from '../../database/schema';
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { eq, count } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    const currentUser = requireRole(event, [Role.ADMIN, Role.OWNER]);

    const id = getRouterParam(event, 'id');
    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing ID parameter',
        });
    }

    if (id === currentUser.id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Cannot delete yourself',
        });
    }

    // Check target user role
    const targetUser = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (targetUser.length === 0) {
        throw createError({
            statusCode: 404,
            statusMessage: 'User not found',
        });
    }

    const userToDelete = targetUser[0];

    // Restriction: Cannot delete Owner
    if (userToDelete.role === Role.OWNER) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Cannot delete an Owner account',
        });
    }

    // Restriction: Only Owner can delete Admin
    if (userToDelete.role === Role.ADMIN && currentUser.role !== Role.OWNER) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Insufficient permissions to delete an Admin',
        });
    }

    // Run in transaction to ensure data integrity
    await db.transaction(async (tx) => {
        // 1. Check for critical dependencies (Blocking)
        // If user owns properties, expenses, or custom templates, we can't safely delete them automatically.
        const [propertyCount] = await tx.select({ value: count() }).from(properties).where(eq(properties.userId, id));
        if (propertyCount.value > 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Cannot delete user: User owns properties. Please reassign or delete them first.',
            });
        }

        const [expenseCount] = await tx.select({ value: count() }).from(expenses).where(eq(expenses.userId, id));
        if (expenseCount.value > 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Cannot delete user: User has recorded expenses. Please remove them first.',
            });
        }

        const [templateCount] = await tx.select({ value: count() }).from(whatsappTemplates).where(eq(whatsappTemplates.userId, id));
        if (templateCount.value > 0) {
            // We can potentially cascade delete these, but better to be safe for now
            throw createError({
                statusCode: 400,
                statusMessage: 'Cannot delete user: User has custom WhatsApp templates.',
            });
        }

        // 2. Unlink/Anonymize history records (Safe to nullify)
        // detailed logs, payments, etc. should be preserved but unlinked from the deleted user
        await tx.update(payments).set({ recordedBy: null }).where(eq(payments.recordedBy, id));
        await tx.update(meterReadings).set({ recordedBy: null }).where(eq(meterReadings.recordedBy, id));
        await tx.update(systemLogs).set({ userId: null }).where(eq(systemLogs.userId, id));
        await tx.update(backups).set({ createdBy: null }).where(eq(backups.createdBy, id));

        // 3. Delete user-specific configuration (Cascade)
        // These are 1:1 or strict ownership records that naturally disappear with the user
        await tx.delete(globalSettings).where(eq(globalSettings.userId, id));
        await tx.delete(integrationSettings).where(eq(integrationSettings.userId, id));
        await tx.delete(expenseCategories).where(eq(expenseCategories.userId, id));

        // 4. Finally delete the user
        await tx.delete(users).where(eq(users.id, id));
    });

    return { success: true, id };
});
