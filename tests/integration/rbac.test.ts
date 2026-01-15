
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils'; // Use utils from Nuxt
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users } from '../../server/database/schema';
import 'dotenv/config';
import { eq } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

describe('RBAC Integration', async () => {

    // Setup Nuxt server programmatically
    await setup({
        server: true
    });

    // Unique identifier for this test run
    const timestamp = Date.now();

    const adminUser = {
        email: `admin_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'RBAC Admin',
        role: 'admin'
    };

    const ownerUser = {
        email: `owner_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'RBAC Owner',
        role: 'owner'
    };

    const staffUser = {
        email: `staff_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'RBAC Staff',
        role: 'staff'
    };

    let adminToken: string;
    let ownerToken: string;
    let staffToken: string;

    // Setup: Register users and force roles in DB
    beforeAll(async () => {
        try {
            console.log('Registering Admin...');
            await $fetch('/api/auth/register', { method: 'POST', body: { email: adminUser.email, password: adminUser.password, name: adminUser.name } });

            console.log('Registering Owner...');
            await $fetch('/api/auth/register', { method: 'POST', body: { email: ownerUser.email, password: ownerUser.password, name: ownerUser.name } });

            console.log('Registering Staff...');
            await $fetch('/api/auth/register', { method: 'POST', body: { email: staffUser.email, password: staffUser.password, name: staffUser.name } });

            // FORCE ROLES IN DB
            console.log('Forcing roles in DB...');
            await db.update(users).set({ role: 'admin' }).where(eq(users.email, adminUser.email));
            await db.update(users).set({ role: 'owner' }).where(eq(users.email, ownerUser.email));
            await db.update(users).set({ role: 'staff' }).where(eq(users.email, staffUser.email));

            // Login to get tokens (initial login) - AFTER role update
            console.log('Logging in Admin...');
            const loginAdmin = await $fetch('/api/auth/login', { method: 'POST', body: { email: adminUser.email, password: adminUser.password } });
            adminToken = loginAdmin.token;

            console.log('Logging in Owner...');
            const loginOwner = await $fetch('/api/auth/login', { method: 'POST', body: { email: ownerUser.email, password: ownerUser.password } });
            ownerToken = loginOwner.token;

            console.log('Logging in Staff...');
            const loginStaff = await $fetch('/api/auth/login', { method: 'POST', body: { email: staffUser.email, password: staffUser.password } });
            staffToken = loginStaff.token;

        } catch (err: any) {
            console.error('Setup failed:', err);
            if (err?.response) {
                console.error('Response status:', err.response.status);
                console.error('Response body:', err.response._data);
            }
            throw err;
        }
    });

    afterAll(async () => {
        // Cleanup
        try {
            await db.delete(users).where(eq(users.email, adminUser.email));
            await db.delete(users).where(eq(users.email, ownerUser.email));
            await db.delete(users).where(eq(users.email, staffUser.email));
            await pool.end();
        } catch (e) {
            console.error('Cleanup failed', e);
        }
    });

    // --- USERS ENDPOINT (Admin Only) ---
    it('GET /api/users - Admin should access', async () => {
        const res = await $fetch('/api/users', { headers: { Cookie: `auth_token=${adminToken}` } });
        expect(Array.isArray(res)).toBe(true);
    });

    it('GET /api/users - Owner should get 403', async () => {
        try {
            await $fetch('/api/users', { headers: { Cookie: `auth_token=${ownerToken}` } });
            expect.fail('Should be 403');
        } catch (e: any) {
            expect(e.response?.status).toBe(403);
        }
    });

    it('GET /api/users - Staff should get 403', async () => {
        try {
            await $fetch('/api/users', { headers: { Cookie: `auth_token=${staffToken}` } });
            expect.fail('Should be 403');
        } catch (e: any) {
            expect(e.response?.status).toBe(403);
        }
    });

    // --- PROPERTIES ENDPOINT (Admin/Owner) ---
    it('GET /api/properties - Admin should access', async () => {
        const res = await $fetch('/api/properties', { headers: { Cookie: `auth_token=${adminToken}` } });
        expect(Array.isArray(res)).toBe(true);
    });

    it('GET /api/properties - Owner should access', async () => {
        const res = await $fetch('/api/properties', { headers: { Cookie: `auth_token=${ownerToken}` } });
        expect(Array.isArray(res)).toBe(true);
    });

    it('GET /api/properties - Staff should get 403', async () => {
        try {
            await $fetch('/api/properties', { headers: { Cookie: `auth_token=${staffToken}` } });
            expect.fail('Should be 403');
        } catch (e: any) {
            expect(e.response?.status).toBe(403);
        }
    });

    // --- BILLS ENDPOINT (Admin/Owner/Staff) ---
    it('GET /api/bills - Staff should access', async () => {
        const res = await $fetch('/api/bills', { headers: { Cookie: `auth_token=${staffToken}` } });
        expect(Array.isArray(res)).toBe(true);
    });

    it('GET /api/bills - Owner should access', async () => {
        const res = await $fetch('/api/bills', { headers: { Cookie: `auth_token=${ownerToken}` } });
        expect(Array.isArray(res)).toBe(true);
    });

});
