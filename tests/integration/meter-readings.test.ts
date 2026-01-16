
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users, properties, rooms, meterReadings } from '../../server/database/schema';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { eq } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

interface LoginResponse {
    token: string;
}

describe('Meter Reading Integration', async () => {

    await setup({
        server: true
    });

    const timestamp = Date.now();
    const adminUser = {
        email: `meter_admin_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Meter Admin',
        role: 'admin'
    };
    const ownerUser = {
        email: `meter_owner_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Meter Owner',
        role: 'owner'
    };

    let adminToken: string;
    let ownerToken: string;
    let propertyId: string;
    let roomId: string;
    let readingId: string;

    beforeAll(async () => {
        try {
            const hashedPassword = await bcrypt.hash('Password123!', 10);

            await db.insert(users).values({ name: adminUser.name, email: adminUser.email, password: hashedPassword, role: 'admin' });
            await db.insert(users).values({ name: ownerUser.name, email: ownerUser.email, password: hashedPassword, role: 'owner' });

            const loginAdmin = await $fetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email: adminUser.email, password: adminUser.password } });
            adminToken = loginAdmin.token;

            const loginOwner = await $fetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email: ownerUser.email, password: ownerUser.password } });
            ownerToken = loginOwner.token;

            // Create Property & Room for testing
            // We need query to get user ID for property creation? No, API uses logged in user.
            // But for tests usually easier to use API if it works.
            const propRes = await $fetch<any>('/api/properties', {
                method: 'POST',
                body: { name: 'Meter Test Prop', address: '123 Test', costPerKwh: 1000, waterFee: 1000, trashFee: 1000 },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            propertyId = propRes.id;

            const roomRes = await $fetch<any>('/api/rooms', {
                method: 'POST',
                body: { propertyId, name: 'Room 101', price: 1000000 },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            roomId = roomRes.id;

        } catch (err) {
            console.error('Setup failed', err);
            throw err;
        }
    });

    afterAll(async () => {
        try {
            if (readingId) await db.delete(meterReadings).where(eq(meterReadings.id, readingId));
            if (roomId) await db.delete(rooms).where(eq(rooms.id, roomId));
            if (propertyId) await db.delete(properties).where(eq(properties.id, propertyId));
            await db.delete(users).where(eq(users.email, adminUser.email));
            await db.delete(users).where(eq(users.email, ownerUser.email));
            await pool.end();
        } catch (e) {
            console.error('Cleanup failed', e);
        }
    });

    it('POST /api/meter-readings - Owner can record reading', async () => {
        const readingData = {
            roomId,
            period: '2026-01',
            meterStart: 100,
            meterEnd: 200
        };

        const res = await $fetch<any>('/api/meter-readings', {
            method: 'POST',
            body: readingData,
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res).toHaveProperty('id');
        expect(res.meterStart).toBe(100);
        expect(res.meterEnd).toBe(200);
        readingId = res.id;
    });

    it('GET /api/meter-readings/:id - Can retreive reading', async () => {
        const res = await $fetch<any>(`/api/meter-readings/${readingId}`, {
            headers: { Cookie: `auth_token=${ownerToken}` }
        });
        expect(res.id).toBe(readingId);
        expect(res.meterEnd).toBe(200);
    });

    it('PATCH /api/meter-readings/:id - Can update reading', async () => {
        const res = await $fetch<any>(`/api/meter-readings/${readingId}`, {
            method: 'PATCH',
            body: { meterEnd: 250 },
            headers: { Cookie: `auth_token=${ownerToken}` }
        });
        expect(res.meterEnd).toBe(250);
    });

    it('PATCH /api/meter-readings/:id - Validation prevents bad data', async () => {
        try {
            await $fetch(`/api/meter-readings/${readingId}`, {
                method: 'PATCH',
                body: { meterEnd: 50 }, // Less than start 100
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should fail validation');
        } catch (e: any) {
            expect(e.response?.status).toBe(400);
        }
    });

    it('DELETE /api/meter-readings/:id - Can delete reading', async () => {
        await $fetch(`/api/meter-readings/${readingId}`, {
            method: 'DELETE',
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        try {
            await $fetch(`/api/meter-readings/${readingId}`, {
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should be 404');
        } catch (e: any) {
            expect(e.response?.status).toBe(404);
        }
    });

});
