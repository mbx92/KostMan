import crypto from 'crypto';
import { db } from '../../../utils/drizzle';
import { rentBills, utilityBills, integrationSettings } from '../../../database/schema';
import { eq, sql, and } from 'drizzle-orm';
import { decrypt } from '../../../utils/encryption';

interface MidtransNotification {
    transaction_status: string;
    status_code: string;
    signature_key: string;
    order_id: string;
    gross_amount: string;
    fraud_status?: string;
    payment_type?: string;
    transaction_time?: string;
    transaction_id?: string;
}

/**
 * POST /api/payments/midtrans/webhook
 * Handles payment notification from Midtrans
 */
export default defineEventHandler(async (event) => {
    const body = await readBody<MidtransNotification>(event);
    
    console.log('[Midtrans Webhook] Received notification:', JSON.stringify(body, null, 2));

    // Get Midtrans credentials from database
    // Note: For webhooks, we need at least one user's integration settings
    // In production, you might want to add userId to the order_id or use a global setting
    const midtransConfig = await db
        .select()
        .from(integrationSettings)
        .where(
            and(
                eq(integrationSettings.provider, 'midtrans'),
                eq(integrationSettings.isEnabled, true)
            )
        )
        .limit(1)
        .then(rows => rows[0]);

    if (!midtransConfig || !midtransConfig.serverKey) {
        console.error('[Midtrans Webhook] No Midtrans configuration found');
        throw createError({ statusCode: 500, statusMessage: 'Payment gateway not configured' });
    }

    const serverKey = decrypt(midtransConfig.serverKey);

    // Verify signature
    const signatureKey = body.signature_key;
    const orderId = body.order_id;
    const statusCode = body.status_code;
    const grossAmount = body.gross_amount;

    const expectedSignature = crypto
        .createHash('sha512')
        .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
        .digest('hex');

    if (signatureKey !== expectedSignature) {
        console.error('[Midtrans Webhook] Invalid signature');
        throw createError({ statusCode: 403, statusMessage: 'Invalid signature' });
    }

    // Parse order ID to get bill info
    // New format: R-{shortId}-{timestamp} or U-{shortId}-{timestamp}
    // Old format: RENT-{billId}-{timestamp} or UTILITY-{billId}-{timestamp}
    const orderParts = orderId.split('-');
    const typePrefix = orderParts[0].toUpperCase();
    const shortBillId = orderParts[1]; // First 8 chars of UUID
    
    // Determine bill type from prefix
    let billType: 'rent' | 'utility';
    if (typePrefix === 'R' || typePrefix === 'RENT') {
        billType = 'rent';
    } else if (typePrefix === 'U' || typePrefix === 'UTILITY') {
        billType = 'utility';
    } else {
        console.error('[Midtrans Webhook] Invalid order_id format:', orderId);
        throw createError({ statusCode: 400, statusMessage: 'Invalid order_id format' });
    }

    // Find bill by shortId prefix (using LIKE query)
    let billId: string | null = null;
    
    if (billType === 'rent') {
        const bills = await db.select({ id: rentBills.id })
            .from(rentBills)
            .where(sql`${rentBills.id}::text LIKE ${shortBillId + '%'}`)
            .limit(1);
        billId = bills[0]?.id || null;
    } else {
        const bills = await db.select({ id: utilityBills.id })
            .from(utilityBills)
            .where(sql`${utilityBills.id}::text LIKE ${shortBillId + '%'}`)
            .limit(1);
        billId = bills[0]?.id || null;
    }

    if (!billId) {
        console.error('[Midtrans Webhook] Bill not found for shortId:', shortBillId);
        throw createError({ statusCode: 404, statusMessage: 'Bill not found' });
    }

    // Check transaction status
    const transactionStatus = body.transaction_status;
    const fraudStatus = body.fraud_status;

    // Determine if payment is successful
    let isPaymentSuccess = false;

    if (transactionStatus === 'capture') {
        // For credit card transactions
        isPaymentSuccess = fraudStatus === 'accept';
    } else if (transactionStatus === 'settlement') {
        // For most payment methods after settlement
        isPaymentSuccess = true;
    }

    console.log(`[Midtrans Webhook] Transaction status: ${transactionStatus}, Fraud: ${fraudStatus}, Success: ${isPaymentSuccess}`);

    // Update bill status if payment is successful
    if (isPaymentSuccess) {
        try {
            if (billType === 'rent') {
                await db.update(rentBills)
                    .set({
                        isPaid: true,
                        paidAt: new Date(),
                    })
                    .where(eq(rentBills.id, billId));
                    
                console.log(`[Midtrans Webhook] Rent bill ${billId} marked as paid`);
            } else {
                await db.update(utilityBills)
                    .set({
                        isPaid: true,
                        paidAt: new Date(),
                    })
                    .where(eq(utilityBills.id, billId));
                    
                console.log(`[Midtrans Webhook] Utility bill ${billId} marked as paid`);
            }
        } catch (error) {
            console.error('[Midtrans Webhook] Database update error:', error);
            throw createError({ statusCode: 500, statusMessage: 'Failed to update bill status' });
        }
    }

    // Always return 200 OK to Midtrans
    return { status: 'OK', message: 'Notification received' };
});
