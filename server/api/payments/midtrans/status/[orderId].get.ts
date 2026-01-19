import { requireRole, Role } from '../../../../utils/permissions';
import { db } from '../../../../utils/drizzle';
import { integrationSettings } from '../../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '../../../../utils/encryption';

/**
 * GET /api/payments/midtrans/status/[orderId]
 * Check payment status from Midtrans API
 */
export default defineEventHandler(async (event) => {
    const user = requireRole(event, [Role.ADMIN, Role.OWNER, Role.STAFF]);
    
    const orderId = getRouterParam(event, 'orderId');
    
    if (!orderId) {
        throw createError({ statusCode: 400, statusMessage: 'orderId is required' });
    }

    // Get user's Midtrans configuration from database
    const midtransConfig = await db
        .select()
        .from(integrationSettings)
        .where(
            and(
                eq(integrationSettings.userId, user.id),
                eq(integrationSettings.provider, 'midtrans'),
                eq(integrationSettings.isEnabled, true)
            )
        )
        .then(rows => rows[0]);

    if (!midtransConfig || !midtransConfig.serverKey) {
        throw createError({ 
            statusCode: 400, 
            statusMessage: 'Midtrans integration not configured. Please configure in Settings.' 
        });
    }

    const serverKey = decrypt(midtransConfig.serverKey);
    const isProduction = midtransConfig.isProduction;
    const apiUrl = isProduction 
        ? 'https://api.midtrans.com/v2' 
        : 'https://api.sandbox.midtrans.com/v2';

    const authString = Buffer.from(`${serverKey}:`).toString('base64');
    
    try {
        const response = await $fetch<any>(`${apiUrl}/${orderId}/status`, {
            headers: {
                'Authorization': `Basic ${authString}`,
            },
        });

        return {
            success: true,
            orderId,
            transactionStatus: response.transaction_status,
            paymentType: response.payment_type,
            grossAmount: response.gross_amount,
            transactionTime: response.transaction_time,
            fraudStatus: response.fraud_status,
        };
    } catch (error: any) {
        if (error?.status === 404) {
            return {
                success: false,
                orderId,
                transactionStatus: 'not_found',
                message: 'Transaction not found',
            };
        }
        
        console.error('Midtrans status check error:', error?.data || error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to check payment status',
        });
    }
});
