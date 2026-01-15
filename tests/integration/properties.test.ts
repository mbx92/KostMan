
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users, properties } from '../../server/database/schema';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { eq } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

interface LoginResponse {
    token: string;
}

interface PropertyResponse {
    id: string;
    name: string;
    address: string;
    description?: string;
    userId: string;
}

describe('Property Management Integration', async () => {

    await setup({
        server: true
    });

    const timestamp = Date.now();

    const adminUser = {
        email: `prop_admin_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Prop Admin',
        role: 'admin'
    };

    const ownerUser = {
        email: `prop_owner_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Prop Owner',
        role: 'owner'
    };

    const otherOwnerUser = {
        email: `prop_other_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Prop Other',
        role: 'owner'
    };

    let adminToken: string;
    let ownerToken: string;
    let otherOwnerToken: string;
    let createdPropertyId: string;

    beforeAll(async () => {
        try {
            const hashedPassword = await bcrypt.hash('Password123!', 10);

            // Insert Users directly (Bypass API which requires Admin)
            await db.insert(users).values({
                name: adminUser.name,
                email: adminUser.email,
                password: hashedPassword,
                role: 'admin'
            });

            await db.insert(users).values({
                name: ownerUser.name,
                email: ownerUser.email,
                password: hashedPassword,
                role: 'owner'
            });

            await db.insert(users).values({
                name: otherOwnerUser.name,
                email: otherOwnerUser.email,
                password: hashedPassword,
                role: 'owner'
            });

            // Login
            const loginAdmin = await $fetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email: adminUser.email, password: adminUser.password } });
            adminToken = loginAdmin.token;

            const loginOwner = await $fetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email: ownerUser.email, password: ownerUser.password } });
            ownerToken = loginOwner.token;

            const loginOther = await $fetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email: otherOwnerUser.email, password: otherOwnerUser.password } });
            otherOwnerToken = loginOther.token;

        } catch (err) {
            console.error('Setup failed', err);
            throw err;
        }
    });

    afterAll(async () => {
        try {
            if (createdPropertyId) {
                await db.delete(properties).where(eq(properties.id, createdPropertyId));
            }
            await db.delete(users).where(eq(users.email, adminUser.email));
            await db.delete(users).where(eq(users.email, ownerUser.email));
            await db.delete(users).where(eq(users.email, otherOwnerUser.email));
            await pool.end();
        } catch (e) {
            console.error('Cleanup failed', e);
        }
    });

    it('POST /api/properties - Owner can create property', async () => {
        const newProperty = {
            name: 'Kost Indah',
            address: 'Jl. Merdeka No. 10',
            description: 'Nyaman dan aman',
        };

        const res = await $fetch<PropertyResponse>('/api/properties', {
            method: 'POST',
            body: newProperty,
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res).toHaveProperty('id');
        expect(res.name).toBe(newProperty.name);
        expect(res.address).toBe(newProperty.address);

        createdPropertyId = res.id;
    });

    it('GET /api/properties/[id] - Owner can view their property', async () => {
        const res = await $fetch<PropertyResponse>(`/api/properties/${createdPropertyId}`, {
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res.id).toBe(createdPropertyId);
        expect(res.name).toBe('Kost Indah');
    });

    it('GET /api/properties/[id] - Other Owner cannot view property (403)', async () => {
        try {
            await $fetch(`/api/properties/${createdPropertyId}`, {
                headers: { Cookie: `auth_token=${otherOwnerToken}` }
            });
            expect.fail('Should fail with 403');
        } catch (e: any) {
            expect(e.response?.status).toBe(403);
        }
    });

    it('GET /api/properties/[id] - Admin can view property', async () => {
        const res = await $fetch<PropertyResponse>(`/api/properties/${createdPropertyId}`, {
            headers: { Cookie: `auth_token=${adminToken}` }
        });
        expect(res.id).toBe(createdPropertyId);
    });

    it('PUT /api/properties/[id] - Owner can update property', async () => {
        const updatedData = {
            name: 'Kost Indah & Nyaman',
            address: 'Jl. Merdeka No. 10 Updated'
        };

        const res = await $fetch<PropertyResponse>(`/api/properties/${createdPropertyId}`, {
            method: 'PUT',
            body: updatedData,
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res.name).toBe(updatedData.name);
        expect(res.address).toBe(updatedData.address);
    });

    it('DELETE /api/properties/[id] - Other Owner cannot delete property', async () => {
        try {
            await $fetch(`/api/properties/${createdPropertyId}`, {
                method: 'DELETE',
                headers: { Cookie: `auth_token=${otherOwnerToken}` }
            });
            expect.fail('Should fail with 403');
        } catch (e: any) {
            expect(e.response?.status).toBe(403);
        }
    });

    it('DELETE /api/properties/[id] - Owner can delete property', async () => {
        const res = await $fetch<{ message: string }>(`/api/properties/${createdPropertyId}`, {
            method: 'DELETE',
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res.message).toContain('deleted');

        // Verify it's gone
        try {
            await $fetch(`/api/properties/${createdPropertyId}`, {
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should fail with 404');
        } catch (e: any) {
            expect(e.response?.status).toBe(404);
        }
    });

});