// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users, properties, rooms, tenants, bills } from '../../server/database/schema';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { eq, and } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

interface LoginResponse {
    token: string;
}

describe('Bill Integration Tests', async () => {

    await setup({
        server: true
    });

    const timestamp = Date.now();
    const ownerUser = {
        email: `bill_owner_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Bill Owner',
        role: 'owner'
    };
    const staffUser = {
        email: `bill_staff_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Bill Staff',
        role: 'staff'
    };

    let ownerToken: string;
    let staffToken: string;
    let propertyId: string;
    let roomId: string;
    let tenantId: string;
    let billId: string;
    let billId2: string;

    beforeAll(async () => {
        try {
            const hashedPassword = await bcrypt.hash('Password123!', 10);

            // Create users
            await db.insert(users).values({
                name: ownerUser.name,
                email: ownerUser.email,
                password: hashedPassword,
                role: 'owner'
            });
            await db.insert(users).values({
                name: staffUser.name,
                email: staffUser.email,
                password: hashedPassword,
                role: 'staff'
            });

            // Login users
            const loginOwner = await $fetch<LoginResponse>('/api/auth/login', {
                method: 'POST',
                body: { email: ownerUser.email, password: ownerUser.password }
            });
            ownerToken = loginOwner.token;

            const loginStaff = await $fetch<LoginResponse>('/api/auth/login', {
                method: 'POST',
                body: { email: staffUser.email, password: staffUser.password }
            });
            staffToken = loginStaff.token;

            // Create Property
            const propRes = await $fetch<any>('/api/properties', {
                method: 'POST',
                body: {
                    name: 'Bill Test Property',
                    address: '123 Bill St',
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            propertyId = propRes.id;

            // Create Tenant
            const tenantRes = await $fetch<any>('/api/tenants', {
                method: 'POST',
                body: {
                    name: 'Test Tenant',
                    contact: '081234567890',
                    idCardNumber: '1234567890123456'
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            tenantId = tenantRes.id;

            // Create Room with tenant
            const roomRes = await $fetch<any>('/api/rooms', {
                method: 'POST',
                body: {
                    propertyId,
                    name: 'Room 101',
                    price: 1500000,
                    tenantId,
                    status: 'occupied'
                },
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
            // Cleanup in reverse order of creation
            if (billId) await db.delete(bills).where(eq(bills.id, billId));
            if (billId2) await db.delete(bills).where(eq(bills.id, billId2));
            if (roomId) await db.delete(rooms).where(eq(rooms.id, roomId));
            if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
            if (propertyId) await db.delete(properties).where(eq(properties.id, propertyId));
            await db.delete(users).where(eq(users.email, ownerUser.email));
            await db.delete(users).where(eq(users.email, staffUser.email));
            await pool.end();
        } catch (e) {
            console.error('Cleanup failed', e);
        }
    });

    // Test 1: Generate a single-month bill
    it('POST /api/bills/generate - Owner can generate single-month bill', async () => {
        const billData = {
            roomId,
            period: '2026-01',
            monthsCovered: 1,
            meterStart: 1000,
            meterEnd: 1150,
            costPerKwh: 1500,
            waterFee: 50000,
            trashFee: 25000,
            additionalCost: 0
        };

        const res = await $fetch<any>('/api/bills/generate', {
            method: 'POST',
            body: billData,
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res).toHaveProperty('id');
        expect(res.roomId).toBe(roomId);
        expect(res.tenantId).toBe(tenantId);
        expect(res.period).toBe('2026-01');
        expect(res.monthsCovered).toBe(1);
        expect(res.isPaid).toBe(false);
        expect(parseFloat(res.totalAmount)).toBeGreaterThan(0);

        billId = res.id;
    });

    // Test 2: Duplicate payment prevention
    it('POST /api/bills/generate - Cannot generate duplicate paid bill for same period', async () => {
        // First, mark the bill as paid
        await $fetch<any>(`/api/bills/${billId}/pay`, {
            method: 'PATCH',
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        // Try to generate another bill for the same tenant and period
        try {
            await $fetch('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId,
                    period: '2026-01',
                    monthsCovered: 1,
                    meterStart: 1150,
                    meterEnd: 1300,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should fail with 409 conflict');
        } catch (e: any) {
            expect(e.response?.status).toBe(409);
            expect(e.response?.statusText).toContain('already paid');
        }
    });

    // Test 3: Generate multi-month bill
    it('POST /api/bills/generate - Can generate multi-month bill with auto-calculated periodEnd', async () => {
        const billData = {
            roomId,
            period: '2026-02',
            monthsCovered: 3,
            meterStart: 1150,
            meterEnd: 1500,
            costPerKwh: 1500,
            waterFee: 50000,
            trashFee: 25000,
            additionalCost: 10000
        };

        const res = await $fetch<any>('/api/bills/generate', {
            method: 'POST',
            body: billData,
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res).toHaveProperty('id');
        expect(res.period).toBe('2026-02');
        expect(res.periodEnd).toBe('2026-04'); // Auto-calculated
        expect(res.monthsCovered).toBe(3);
        expect(parseFloat(res.roomPrice)).toBe(1500000 * 3); // 3 months
        expect(parseFloat(res.waterFee)).toBe(50000 * 3);
        expect(parseFloat(res.trashFee)).toBe(25000 * 3);

        billId2 = res.id;
    });

    // Test 4: Get all bills
    it('GET /api/bills - Can retrieve all bills', async () => {
        const res = await $fetch<any[]>('/api/bills', {
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(Array.isArray(res)).toBe(true);
        expect(res.length).toBeGreaterThanOrEqual(2);
    });

    // Test 5: Filter by propertyId
    it('GET /api/bills?propertyId - Can filter bills by property', async () => {
        const res = await $fetch<any[]>(`/api/bills?propertyId=${propertyId}`, {
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(Array.isArray(res)).toBe(true);
        expect(res.length).toBeGreaterThanOrEqual(2);
        // All bills should be from rooms in this property
        res.forEach(bill => {
            expect(bill.roomId).toBe(roomId);
        });
    });

    // Test 6: Filter by isPaid
    it('GET /api/bills?isPaid - Can filter bills by payment status', async () => {
        const unpaidRes = await $fetch<any[]>('/api/bills?isPaid=false', {
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(Array.isArray(unpaidRes)).toBe(true);
        unpaidRes.forEach(bill => {
            expect(bill.isPaid).toBe(false);
        });

        const paidRes = await $fetch<any[]>('/api/bills?isPaid=true', {
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(Array.isArray(paidRes)).toBe(true);
        paidRes.forEach(bill => {
            expect(bill.isPaid).toBe(true);
        });
    });

    // Test 7: Filter by period
    it('GET /api/bills?billPeriod - Can filter bills by period', async () => {
        const res = await $fetch<any[]>('/api/bills?billPeriod=2026-02', {
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(Array.isArray(res)).toBe(true);
        res.forEach(bill => {
            expect(bill.period).toBe('2026-02');
        });
    });

    // Test 8: Combined filters
    it('GET /api/bills - Can use combined filters', async () => {
        const res = await $fetch<any[]>(
            `/api/bills?propertyId=${propertyId}&isPaid=false&billPeriod=2026-02`,
            { headers: { Cookie: `auth_token=${ownerToken}` } }
        );

        expect(Array.isArray(res)).toBe(true);
        res.forEach(bill => {
            expect(bill.roomId).toBe(roomId);
            expect(bill.isPaid).toBe(false);
            expect(bill.period).toBe('2026-02');
        });
    });

    // Test 9: Mark bill as paid
    it('PATCH /api/bills/:id/pay - Staff can mark bill as paid', async () => {
        const res = await $fetch<any>(`/api/bills/${billId2}/pay`, {
            method: 'PATCH',
            headers: { Cookie: `auth_token=${staffToken}` }
        });

        expect(res.isPaid).toBe(true);
        expect(res.paidAt).toBeTruthy();
    });

    // Test 10: Cannot mark already paid bill
    it('PATCH /api/bills/:id/pay - Cannot mark already paid bill', async () => {
        try {
            await $fetch(`/api/bills/${billId2}/pay`, {
                method: 'PATCH',
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should fail with 400 error');
        } catch (e: any) {
            expect(e.response?.status).toBe(400);
            expect(e.response?.statusText).toContain('already');
        }
    });

    // Test 11: Cannot delete paid bill
    it('DELETE /api/bills/:id - Cannot delete paid bill', async () => {
        try {
            await $fetch(`/api/bills/${billId}`, {
                method: 'DELETE',
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should fail with 400 error');
        } catch (e: any) {
            expect(e.response?.status).toBe(400);
            expect(e.response?.statusText).toContain('Cannot delete a paid bill');
        }
    });

    // Test 12: Validation - Invalid period format
    it('POST /api/bills/generate - Validation fails for invalid period format', async () => {
        try {
            await $fetch('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId,
                    period: '2026/01', // Invalid format
                    monthsCovered: 1,
                    meterStart: 1000,
                    meterEnd: 1150,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should fail validation');
        } catch (e: any) {
            expect(e.response?.status).toBe(400);
        }
    });

    // Test 13: Validation - Meter end < meter start
    it('POST /api/bills/generate - Validation fails when meterEnd < meterStart', async () => {
        try {
            await $fetch('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId,
                    period: '2026-05',
                    monthsCovered: 1,
                    meterStart: 2000,
                    meterEnd: 1500, // Less than start
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should fail validation');
        } catch (e: any) {
            expect(e.response?.status).toBe(400);
        }
    });

    // Test 14: Non-existent room
    it('POST /api/bills/generate - Fails for non-existent room', async () => {
        try {
            await $fetch('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId: '00000000-0000-0000-0000-000000000000',
                    period: '2026-06',
                    monthsCovered: 1,
                    meterStart: 1000,
                    meterEnd: 1150,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should fail with 404');
        } catch (e: any) {
            expect(e.response?.status).toBe(404);
        }
    });

});
