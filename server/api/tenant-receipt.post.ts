import { db } from '../utils/drizzle';
import { rentBills, utilityBills } from '../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // Get tenant from session
    const authHeader = getHeader(event, 'authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        });
    }

    const token = authHeader.substring(7);
    let session: any;
    
    try {
        session = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch (e) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid token',
        });
    }

    const body = await readBody(event);
    const billId = body.billId;
    const billType = body.billType as 'rent' | 'utility';

    if (!billId || !billType) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing billId or billType',
        });
    }

    // Verify the bill belongs to this tenant
    if (billType === 'rent') {
        const bill = await db.select()
            .from(rentBills)
            .where(eq(rentBills.id, billId))
            .limit(1);

        if (bill.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Bill not found',
            });
        }

        if (bill[0].tenantId !== session.tenantId) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden: This bill does not belong to you',
            });
        }
    } else {
        const bill = await db.select()
            .from(utilityBills)
            .where(eq(utilityBills.id, billId))
            .limit(1);

        if (bill.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Bill not found',
            });
        }

        if (bill[0].tenantId !== session.tenantId) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden: This bill does not belong to you',
            });
        }
    }

    // Generate public link token in format: billId:billType:timestamp
    const timestamp = Date.now();
    const tokenData = `${billId}:${billType}:${timestamp}`;
    const publicToken = Buffer.from(tokenData).toString('base64url');

    // Get base URL from request headers
    const headers = getHeaders(event);
    const protocol = headers['x-forwarded-proto'] || 'http';
    const host = headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const publicUrl = `${baseUrl}/invoice/${publicToken}`;

    return {
        success: true,
        token: publicToken,
        publicUrl,
    };
});
