
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users, tenants } from '../../server/database/schema';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { eq } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

interface LoginResponse {
    token: string;
}

interface TenantResponse {
    id: string;
    name: string;
    contact: string;
    idCardNumber: string;
    status: 'active' | 'inactive';
}

describe('Tenant Management Integration', async () => {

    await setup({
        server: true
    });

    const timestamp = Date.now();

    const adminUser = {
        email: `tenant_admin_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Tenant Admin',
        role: 'admin'
    };

    const ownerUser = {
        email: `tenant_owner_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Tenant Owner',
        role: 'owner'
    };

    let adminToken: string;
    let ownerToken: string;
    let createdTenantId: string;

    beforeAll(async () => {
        try {
            const hashedPassword = await bcrypt.hash('Password123!', 10);

            // Insert Users directly
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

            // Login
            const loginAdmin = await $fetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email: adminUser.email, password: adminUser.password } });
            adminToken = loginAdmin.token;

            const loginOwner = await $fetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email: ownerUser.email, password: ownerUser.password } });
            ownerToken = loginOwner.token;

        } catch (err) {
            console.error('Setup failed', err);
            throw err;
        }
    });

    afterAll(async () => {
        try {
            if (createdTenantId) {
                await db.delete(tenants).where(eq(tenants.id, createdTenantId));
            }
            await db.delete(users).where(eq(users.email, adminUser.email));
            await db.delete(users).where(eq(users.email, ownerUser.email));
            await pool.end();
        } catch (e) {
            console.error('Cleanup failed', e);
        }
    });

    it('POST /api/tenants - Owner can create tenant', async () => {
        const newTenant = {
            name: 'John Doe',
            contact: '081234567890',
            idCardNumber: '1234567890123456',
            status: 'active'
        };

        const res = await $fetch<TenantResponse>('/api/tenants', {
            method: 'POST',
            body: newTenant,
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res).toHaveProperty('id');
        expect(res.name).toBe(newTenant.name);
        expect(res.contact).toBe(newTenant.contact);
        expect(res.idCardNumber).toBe(newTenant.idCardNumber);
        expect(res.status).toBe(newTenant.status);

        createdTenantId = res.id;
    });

    it('GET /api/tenants/[id] - Admin can view tenant', async () => {
        const res = await $fetch<TenantResponse>(`/api/tenants/${createdTenantId}`, {
            headers: { Cookie: `auth_token=${adminToken}` }
        });

        expect(res.id).toBe(createdTenantId);
        expect(res.name).toBe('John Doe');
    });

    it('GET /api/tenants - Owner can list active tenants', async () => {
        const res = await $fetch<TenantResponse[]>('/api/tenants?status=active', {
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(Array.isArray(res)).toBe(true);
        const tenant = res.find(t => t.id === createdTenantId);
        expect(tenant).toBeDefined();
        expect(tenant?.status).toBe('active');
    });

    it('PUT /api/tenants/[id] - Owner can update tenant', async () => {
        const updatedData = {
            name: 'John Doe Updated',
            status: 'inactive'
        };

        const res = await $fetch<TenantResponse>(`/api/tenants/${createdTenantId}`, {
            method: 'PUT',
            body: updatedData,
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res.name).toBe(updatedData.name);
        expect(res.status).toBe(updatedData.status);
    });

    it('DELETE /api/tenants/[id] - Owner can delete tenant', async () => {
        const res = await $fetch<{ message: string }>(`/api/tenants/${createdTenantId}`, {
            method: 'DELETE',
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res.message).toContain('deleted');

        // Verify it's gone
        try {
            await $fetch(`/api/tenants/${createdTenantId}`, {
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should fail with 404');
        } catch (e: any) {
            expect(e.response?.status).toBe(404);
        }

        // Clear ID so cleanup doesn't fail
        createdTenantId = '';
    });
});
