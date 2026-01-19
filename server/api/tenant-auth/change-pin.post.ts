import { db } from '../../utils/drizzle';
import { tenants } from '../../database/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const changePinSchema = z.object({
    oldPin: z.string().length(4, 'PIN lama harus 4 digit'),
    newPin: z.string().length(4, 'PIN baru harus 4 digit'),
});

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
    const parseResult = changePinSchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const { oldPin, newPin } = parseResult.data;

    // Validate new PIN is different from old PIN
    if (oldPin === newPin) {
        throw createError({
            statusCode: 400,
            statusMessage: 'PIN baru harus berbeda dari PIN lama',
        });
    }

    // Get tenant from database
    const tenant = await db.select()
        .from(tenants)
        .where(eq(tenants.id, session.tenantId))
        .limit(1);

    if (tenant.length === 0) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Tenant not found',
        });
    }

    const tenantData = tenant[0];

    // Verify old PIN
    if (!tenantData.pin) {
        throw createError({
            statusCode: 400,
            statusMessage: 'No PIN set',
        });
    }

    const isValidOldPin = await bcrypt.compare(oldPin, tenantData.pin);
    if (!isValidOldPin) {
        throw createError({
            statusCode: 401,
            statusMessage: 'PIN lama salah',
        });
    }

    // Hash new PIN
    const hashedNewPin = await bcrypt.hash(newPin, 10);

    // Update PIN
    await db.update(tenants)
        .set({
            pin: hashedNewPin,
            isDefaultPin: false,
            pinChangedAt: new Date(),
        })
        .where(eq(tenants.id, session.tenantId));

    return {
        success: true,
        message: 'PIN berhasil diubah',
    };
});
