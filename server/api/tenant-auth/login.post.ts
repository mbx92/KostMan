import { db } from '../../utils/drizzle';
import { tenants } from '../../database/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const loginSchema = z.object({
    contact: z.string().min(10, 'Nomor HP minimal 10 digit'),
    pin: z.string().length(4, 'PIN harus 4 digit'),
});

/**
 * Generate default PIN from phone number (last 4 digits)
 */
function getDefaultPin(contact: string): string {
    // Remove all non-digit characters
    const digits = contact.replace(/\D/g, '');
    // Get last 4 digits
    return digits.slice(-4);
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Validation Error',
            data: parseResult.error.issues,
        });
    }

    const { contact, pin } = parseResult.data;

    // Find tenant by contact
    const tenant = await db.select()
        .from(tenants)
        .where(eq(tenants.contact, contact))
        .limit(1);

    if (tenant.length === 0) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Nomor HP tidak ditemukan',
        });
    }

    const tenantData = tenant[0];

    // Check if tenant is active
    if (tenantData.status !== 'active') {
        throw createError({
            statusCode: 403,
            statusMessage: 'Akun tidak aktif. Hubungi pengelola kost.',
        });
    }

    let isValidPin = false;
    let isDefaultPin = true;

    // If no PIN set yet, use default PIN (last 4 digits of phone)
    if (!tenantData.pin) {
        const defaultPin = getDefaultPin(contact);
        isValidPin = pin === defaultPin;
        isDefaultPin = true;

        // Set the default PIN (hashed) for future logins
        if (isValidPin) {
            const hashedPin = await bcrypt.hash(defaultPin, 10);
            await db.update(tenants)
                .set({ 
                    pin: hashedPin,
                    isDefaultPin: true 
                })
                .where(eq(tenants.id, tenantData.id));
        }
    } else {
        // Verify PIN
        isValidPin = await bcrypt.compare(pin, tenantData.pin);
        isDefaultPin = tenantData.isDefaultPin ?? true;
    }

    if (!isValidPin) {
        throw createError({
            statusCode: 401,
            statusMessage: 'PIN salah',
        });
    }

    // Create session token (simplified - just tenant ID + timestamp)
    const sessionToken = Buffer.from(
        JSON.stringify({
            tenantId: tenantData.id,
            contact: tenantData.contact,
            name: tenantData.name,
            isDefaultPin,
            loginAt: new Date().toISOString(),
        })
    ).toString('base64');

    return {
        success: true,
        token: sessionToken,
        tenant: {
            id: tenantData.id,
            name: tenantData.name,
            contact: tenantData.contact,
        },
        isDefaultPin,
    };
});
