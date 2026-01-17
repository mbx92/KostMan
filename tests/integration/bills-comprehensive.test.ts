// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users, properties, propertySettings, rooms, tenants, bills } from '../../server/database/schema';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { eq, and } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

interface LoginResponse {
    token: string;
}

interface Bill {
    id: string;
    roomId: string;
    tenantId: string | null;
    period: string;
    periodEnd: string | null;
    monthsCovered: number;
    meterStart: number;
    meterEnd: number;
    costPerKwh: string;
    roomPrice: string;
    usageCost: string;
    waterFee: string;
    trashFee: string;
    additionalCost: string;
    totalAmount: string;
    isPaid: boolean;
    paidAt: Date | null;
    generatedAt: Date;
}

describe('Comprehensive Billing Integration Tests', async () => {

    await setup({
        server: true
    });

    const timestamp = Date.now();
    const adminUser = {
        email: `bill_admin_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Bill Admin',
        role: 'admin'
    };
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

    let adminToken: string;
    let ownerToken: string;
    let staffToken: string;
    let propertyId: string;
    let property2Id: string;
    let roomId: string;
    let room2Id: string;
    let room3Id: string; // Room with proration
    let room4Id: string; // Room without trash service
    let tenantId: string;
    let tenant2Id: string;
    const createdBillIds: string[] = [];

    beforeAll(async () => {
        try {
            const hashedPassword = await bcrypt.hash('Password123!', 10);

            // Create users
            await db.insert(users).values([
                {
                    name: adminUser.name,
                    email: adminUser.email,
                    password: hashedPassword,
                    role: 'admin'
                },
                {
                    name: ownerUser.name,
                    email: ownerUser.email,
                    password: hashedPassword,
                    role: 'owner'
                },
                {
                    name: staffUser.name,
                    email: staffUser.email,
                    password: hashedPassword,
                    role: 'staff'
                }
            ]);

            // Login users
            const loginAdmin = await $fetch<LoginResponse>('/api/auth/login', {
                method: 'POST',
                body: { email: adminUser.email, password: adminUser.password }
            });
            adminToken = loginAdmin.token;

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

            // Create Properties
            const propRes = await $fetch<any>('/api/properties', {
                method: 'POST',
                body: {
                    name: 'Comprehensive Test Property 1',
                    address: '123 Bill Test St',
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            propertyId = propRes.id;

            const prop2Res = await $fetch<any>('/api/properties', {
                method: 'POST',
                body: {
                    name: 'Comprehensive Test Property 2',
                    address: '456 Bill Test Ave',
                    costPerKwh: 1600,
                    waterFee: 60000,
                    trashFee: 30000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            property2Id = prop2Res.id;

            // Create Tenants
            const tenantRes = await $fetch<any>('/api/tenants', {
                method: 'POST',
                body: {
                    name: 'Test Tenant 1',
                    contact: '081234567890',
                    idCardNumber: '1234567890123456'
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            tenantId = tenantRes.id;

            const tenant2Res = await $fetch<any>('/api/tenants', {
                method: 'POST',
                body: {
                    name: 'Test Tenant 2',
                    contact: '081234567891',
                    idCardNumber: '1234567890123457'
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            tenant2Id = tenant2Res.id;

            // Create Rooms
            // Room 1: Standard room with tenant
            const roomRes = await $fetch<any>('/api/rooms', {
                method: 'POST',
                body: {
                    propertyId,
                    name: 'Room 101',
                    price: 3000000,
                    tenantId,
                    status: 'occupied',
                    useTrashService: true
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            roomId = roomRes.id;

            // Room 2: Different property
            const room2Res = await $fetch<any>('/api/rooms', {
                method: 'POST',
                body: {
                    propertyId: property2Id,
                    name: 'Room 201',
                    price: 2500000,
                    tenantId: tenant2Id,
                    status: 'occupied',
                    useTrashService: true
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            room2Id = room2Res.id;

            // Room 3: With mid-month move-in date (for proration testing)
            const room3Res = await $fetch<any>('/api/rooms', {
                method: 'POST',
                body: {
                    propertyId,
                    name: 'Room 102',
                    price: 2800000,
                    tenantId,
                    status: 'occupied',
                    useTrashService: true,
                    moveInDate: '2026-01-15' // Mid-month
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            room3Id = room3Res.id;

            // Room 4: Without trash service
            const room4Res = await $fetch<any>('/api/rooms', {
                method: 'POST',
                body: {
                    propertyId,
                    name: 'Room 103',
                    price: 2000000,
                    tenantId: tenant2Id,
                    status: 'occupied',
                    useTrashService: false
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            room4Id = room4Res.id;

        } catch (err) {
            console.error('Setup failed', err);
            throw err;
        }
    }, 60000); // 60 second timeout for setup

    afterAll(async () => {
        try {
            // Cleanup in reverse order of creation
            for (const billId of createdBillIds) {
                await db.delete(bills).where(eq(bills.id, billId)).catch(() => { });
            }
            if (room4Id) await db.delete(rooms).where(eq(rooms.id, room4Id)).catch(() => { });
            if (room3Id) await db.delete(rooms).where(eq(rooms.id, room3Id)).catch(() => { });
            if (room2Id) await db.delete(rooms).where(eq(rooms.id, room2Id)).catch(() => { });
            if (roomId) await db.delete(rooms).where(eq(rooms.id, roomId)).catch(() => { });
            if (tenant2Id) await db.delete(tenants).where(eq(tenants.id, tenant2Id)).catch(() => { });
            if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => { });
            if (property2Id) await db.delete(properties).where(eq(properties.id, property2Id)).catch(() => { });
            if (propertyId) await db.delete(properties).where(eq(properties.id, propertyId)).catch(() => { });
            await db.delete(users).where(eq(users.email, adminUser.email)).catch(() => { });
            await db.delete(users).where(eq(users.email, ownerUser.email)).catch(() => { });
            await db.delete(users).where(eq(users.email, staffUser.email)).catch(() => { });
            await pool.end();
        } catch (e) {
            console.error('Cleanup failed', e);
        }
    }, 60000); // 60 second timeout for cleanup

    // ==================== BILL GENERATION TESTS ====================

    describe('POST /api/bills/generate - Bill Generation', () => {

        it('should generate a single-month bill with correct calculations', async () => {
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

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(bill).toHaveProperty('id');
            expect(bill.roomId).toBe(roomId);
            expect(bill.tenantId).toBe(tenantId);
            expect(bill.period).toBe('2026-01');
            expect(bill.monthsCovered).toBe(1);
            expect(bill.isPaid).toBe(false);

            // Verify calculations
            const expectedRoomPrice = 3000000;
            const expectedUsageCost = (1150 - 1000) * 1500; // 225,000
            const expectedWaterFee = 50000;
            const expectedTrashFee = 25000;
            const expectedTotal = expectedRoomPrice + expectedUsageCost + expectedWaterFee + expectedTrashFee;

            expect(parseFloat(bill.roomPrice)).toBe(expectedRoomPrice);
            expect(parseFloat(bill.usageCost)).toBe(expectedUsageCost);
            expect(parseFloat(bill.waterFee)).toBe(expectedWaterFee);
            expect(parseFloat(bill.trashFee)).toBe(expectedTrashFee);
            expect(parseFloat(bill.totalAmount)).toBe(expectedTotal);

            createdBillIds.push(bill.id);
        });

        it('should generate a multi-month bill with auto-calculated periodEnd', async () => {
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

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(bill.period).toBe('2026-02');
            expect(bill.periodEnd).toBe('2026-04'); // Auto-calculated
            expect(bill.monthsCovered).toBe(3);

            // Verify multi-month calculations
            expect(parseFloat(bill.roomPrice)).toBe(3000000 * 3);
            expect(parseFloat(bill.waterFee)).toBe(50000 * 3);
            expect(parseFloat(bill.trashFee)).toBe(25000 * 3);
            expect(parseFloat(bill.additionalCost)).toBe(10000);

            createdBillIds.push(bill.id);
        });

        it('should generate bill with explicit periodEnd', async () => {
            const billData = {
                roomId,
                period: '2026-05',
                periodEnd: '2026-07',
                monthsCovered: 3,
                meterStart: 1500,
                meterEnd: 1800,
                costPerKwh: 1500,
                waterFee: 50000,
                trashFee: 25000
            };

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(bill.periodEnd).toBe('2026-07');
            createdBillIds.push(bill.id);
        });

        it('should generate bill with additional costs', async () => {
            const billData = {
                roomId: room2Id,
                period: '2026-01',
                monthsCovered: 1,
                meterStart: 500,
                meterEnd: 600,
                costPerKwh: 1600,
                waterFee: 60000,
                trashFee: 30000,
                additionalCost: 100000 // Parking fee, etc.
            };

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(parseFloat(bill.additionalCost)).toBe(100000);
            const expectedTotal = 2500000 + (100 * 1600) + 60000 + 30000 + 100000;
            expect(parseFloat(bill.totalAmount)).toBe(expectedTotal);

            createdBillIds.push(bill.id);
        });

        it('should generate bill for room without trash service', async () => {
            const billData = {
                roomId: room4Id,
                period: '2026-01',
                monthsCovered: 1,
                meterStart: 100,
                meterEnd: 200,
                costPerKwh: 1500,
                waterFee: 50000,
                trashFee: 25000 // Should be ignored
            };

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(parseFloat(bill.trashFee)).toBe(0); // Should be 0 even if provided
            createdBillIds.push(bill.id);
        });

        it('should generate bill with proration for mid-month move-in', async () => {
            const billData = {
                roomId: room3Id,
                period: '2026-01', // Same month as move-in
                monthsCovered: 1,
                meterStart: 100,
                meterEnd: 150,
                costPerKwh: 1500,
                waterFee: 50000,
                trashFee: 25000
            };

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            // January has 31 days, move-in on 15th
            // Days occupied: 31 - 15 + 1 = 17 days
            // Proration factor: 17/31 ≈ 0.5484
            const prorationFactor = 17 / 31;

            const expectedRoomPrice = 2800000 * prorationFactor;
            const expectedWaterFee = 50000 * prorationFactor;
            const expectedTrashFee = 25000 * prorationFactor;
            const expectedUsageCost = (150 - 100) * 1500; // NOT prorated

            expect(parseFloat(bill.roomPrice)).toBeCloseTo(expectedRoomPrice, 0);
            expect(parseFloat(bill.waterFee)).toBeCloseTo(expectedWaterFee, 0);
            expect(parseFloat(bill.trashFee)).toBeCloseTo(expectedTrashFee, 0);
            expect(parseFloat(bill.usageCost)).toBe(expectedUsageCost);

            createdBillIds.push(bill.id);
        });

        it('should NOT prorate bill for subsequent months after move-in', async () => {
            const billData = {
                roomId: room3Id,
                period: '2026-02', // Next month after move-in
                monthsCovered: 1,
                meterStart: 150,
                meterEnd: 200,
                costPerKwh: 1500,
                waterFee: 50000,
                trashFee: 25000
            };

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            // Should be full month (no proration)
            expect(parseFloat(bill.roomPrice)).toBe(2800000);
            expect(parseFloat(bill.waterFee)).toBe(50000);
            expect(parseFloat(bill.trashFee)).toBe(25000);

            createdBillIds.push(bill.id);
        });

        it('should allow staff to generate bills', async () => {
            const billData = {
                roomId: room2Id,
                period: '2026-02',
                monthsCovered: 1,
                meterStart: 600,
                meterEnd: 700,
                costPerKwh: 1600,
                waterFee: 60000,
                trashFee: 30000
            };

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${staffToken}` }
            });

            expect(bill).toHaveProperty('id');
            createdBillIds.push(bill.id);
        });

        it('should allow admin to generate bills', async () => {
            const billData = {
                roomId: room2Id,
                period: '2026-03',
                monthsCovered: 1,
                meterStart: 700,
                meterEnd: 800,
                costPerKwh: 1600,
                waterFee: 60000,
                trashFee: 30000
            };

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${adminToken}` }
            });

            expect(bill).toHaveProperty('id');
            createdBillIds.push(bill.id);
        });
    });

    // ==================== DUPLICATE PREVENTION TESTS ====================

    describe('POST /api/bills/generate - Duplicate Prevention', () => {

        let paidBillId: string;

        it('should prevent duplicate bill for same tenant and period if already paid', async () => {
            // First, generate and pay a bill
            const billData = {
                roomId,
                period: '2026-08',
                monthsCovered: 1,
                meterStart: 2000,
                meterEnd: 2100,
                costPerKwh: 1500,
                waterFee: 50000,
                trashFee: 25000
            };

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            paidBillId = bill.id;
            createdBillIds.push(bill.id);

            // Mark as paid
            await $fetch(`/api/bills/${bill.id}/pay`, {
                method: 'PATCH',
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            // Try to generate another bill for same period
            try {
                await $fetch('/api/bills/generate', {
                    method: 'POST',
                    body: billData,
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Should have thrown 409 conflict');
            } catch (e: any) {
                expect(e.response?.status).toBe(409);
                expect(e.response?.statusText).toContain('already paid');
            }
        });

        it('should allow generating unpaid bill for same period (overwrites)', async () => {
            // Generate unpaid bill
            const billData = {
                roomId,
                period: '2026-09',
                monthsCovered: 1,
                meterStart: 2100,
                meterEnd: 2200,
                costPerKwh: 1500,
                waterFee: 50000,
                trashFee: 25000
            };

            const bill1 = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: billData,
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            createdBillIds.push(bill1.id);

            // Generate another for same period (should succeed since first is unpaid)
            const bill2 = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: { ...billData, meterEnd: 2250 },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            createdBillIds.push(bill2.id);

            expect(bill2).toHaveProperty('id');
        });
    });

    // ==================== VALIDATION TESTS ====================

    describe('POST /api/bills/generate - Validation', () => {

        it('should reject invalid period format', async () => {
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
                expect.fail('Should have thrown validation error');
            } catch (e: any) {
                expect(e.response?.status).toBe(400);
            }
        });

        it('should reject when meterEnd < meterStart', async () => {
            try {
                await $fetch('/api/bills/generate', {
                    method: 'POST',
                    body: {
                        roomId,
                        period: '2026-10',
                        monthsCovered: 1,
                        meterStart: 2000,
                        meterEnd: 1500, // Less than start
                        costPerKwh: 1500,
                        waterFee: 50000,
                        trashFee: 25000
                    },
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Should have thrown validation error');
            } catch (e: any) {
                expect(e.response?.status).toBe(400);
            }
        });

        it('should reject negative costs', async () => {
            try {
                await $fetch('/api/bills/generate', {
                    method: 'POST',
                    body: {
                        roomId,
                        period: '2026-10',
                        monthsCovered: 1,
                        meterStart: 1000,
                        meterEnd: 1100,
                        costPerKwh: -1500, // Negative
                        waterFee: 50000,
                        trashFee: 25000
                    },
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Should have thrown validation error');
            } catch (e: any) {
                expect(e.response?.status).toBe(400);
            }
        });

        it('should reject invalid monthsCovered', async () => {
            try {
                await $fetch('/api/bills/generate', {
                    method: 'POST',
                    body: {
                        roomId,
                        period: '2026-10',
                        monthsCovered: 0, // Must be at least 1
                        meterStart: 1000,
                        meterEnd: 1100,
                        costPerKwh: 1500,
                        waterFee: 50000,
                        trashFee: 25000
                    },
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Should have thrown validation error');
            } catch (e: any) {
                expect(e.response?.status).toBe(400);
            }
        });

        it('should reject non-existent room', async () => {
            try {
                await $fetch('/api/bills/generate', {
                    method: 'POST',
                    body: {
                        roomId: '00000000-0000-0000-0000-000000000000',
                        period: '2026-10',
                        monthsCovered: 1,
                        meterStart: 1000,
                        meterEnd: 1150,
                        costPerKwh: 1500,
                        waterFee: 50000,
                        trashFee: 25000
                    },
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Should have thrown 404');
            } catch (e: any) {
                expect(e.response?.status).toBe(404);
            }
        });

        it('should reject invalid periodEnd (before period)', async () => {
            try {
                await $fetch('/api/bills/generate', {
                    method: 'POST',
                    body: {
                        roomId,
                        period: '2026-10',
                        periodEnd: '2026-09', // Before period start
                        monthsCovered: 2,
                        meterStart: 1000,
                        meterEnd: 1150,
                        costPerKwh: 1500,
                        waterFee: 50000,
                        trashFee: 25000
                    },
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Should have thrown validation error');
            } catch (e: any) {
                expect(e.response?.status).toBe(400);
            }
        });
    });

    // ==================== GET BILLS TESTS ====================

    describe('GET /api/bills - List Bills', () => {

        it('should retrieve all bills', async () => {
            const bills = await $fetch<Bill[]>('/api/bills', {
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(Array.isArray(bills)).toBe(true);
            expect(bills.length).toBeGreaterThan(0);
        });

        it('should filter bills by propertyId', async () => {
            const bills = await $fetch<Bill[]>(`/api/bills?propertyId=${propertyId}`, {
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(Array.isArray(bills)).toBe(true);
            bills.forEach(bill => {
                // All bills should be from rooms in this property
                expect([roomId, room3Id, room4Id]).toContain(bill.roomId);
            });
        });

        it('should filter bills by isPaid=true', async () => {
            const bills = await $fetch<Bill[]>('/api/bills?isPaid=true', {
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(Array.isArray(bills)).toBe(true);
            bills.forEach(bill => {
                expect(bill.isPaid).toBe(true);
            });
        });

        it('should filter bills by isPaid=false', async () => {
            const bills = await $fetch<Bill[]>('/api/bills?isPaid=false', {
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(Array.isArray(bills)).toBe(true);
            bills.forEach(bill => {
                expect(bill.isPaid).toBe(false);
            });
        });

        it('should filter bills by billPeriod', async () => {
            const bills = await $fetch<Bill[]>('/api/bills?billPeriod=2026-01', {
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(Array.isArray(bills)).toBe(true);
            bills.forEach(bill => {
                expect(bill.period).toBe('2026-01');
            });
        });

        it('should support combined filters', async () => {
            const bills = await $fetch<Bill[]>(
                `/api/bills?propertyId=${propertyId}&isPaid=false&billPeriod=2026-02`,
                { headers: { Cookie: `auth_token=${ownerToken}` } }
            );

            expect(Array.isArray(bills)).toBe(true);
            bills.forEach(bill => {
                expect([roomId, room3Id, room4Id]).toContain(bill.roomId);
                expect(bill.isPaid).toBe(false);
                expect(bill.period).toBe('2026-02');
            });
        });

        it('should allow staff to view bills', async () => {
            const bills = await $fetch<Bill[]>('/api/bills', {
                headers: { Cookie: `auth_token=${staffToken}` }
            });

            expect(Array.isArray(bills)).toBe(true);
        });

        it('should allow admin to view bills', async () => {
            const bills = await $fetch<Bill[]>('/api/bills', {
                headers: { Cookie: `auth_token=${adminToken}` }
            });

            expect(Array.isArray(bills)).toBe(true);
        });
    });

    // ==================== MARK AS PAID TESTS ====================

    describe('PATCH /api/bills/:id/pay - Mark as Paid', () => {

        let unpaidBillId: string;

        beforeAll(async () => {
            // Create an unpaid bill for testing
            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId,
                    period: '2026-11',
                    monthsCovered: 1,
                    meterStart: 3000,
                    meterEnd: 3100,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            unpaidBillId = bill.id;
            createdBillIds.push(bill.id);
        });

        it('should mark bill as paid by owner', async () => {
            const bill = await $fetch<Bill>(`/api/bills/${unpaidBillId}/pay`, {
                method: 'PATCH',
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(bill.isPaid).toBe(true);
            expect(bill.paidAt).toBeTruthy();
            expect(new Date(bill.paidAt!).getTime()).toBeLessThanOrEqual(Date.now());
        });

        it('should reject marking already paid bill', async () => {
            try {
                await $fetch(`/api/bills/${unpaidBillId}/pay`, {
                    method: 'PATCH',
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Should have thrown 400 error');
            } catch (e: any) {
                expect(e.response?.status).toBe(400);
                expect(e.response?.statusText).toContain('already');
            }
        });

        it('should allow staff to mark bill as paid', async () => {
            // Create another unpaid bill
            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId: room2Id,
                    period: '2026-11',
                    monthsCovered: 1,
                    meterStart: 1000,
                    meterEnd: 1100,
                    costPerKwh: 1600,
                    waterFee: 60000,
                    trashFee: 30000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            createdBillIds.push(bill.id);

            const paidBill = await $fetch<Bill>(`/api/bills/${bill.id}/pay`, {
                method: 'PATCH',
                headers: { Cookie: `auth_token=${staffToken}` }
            });

            expect(paidBill.isPaid).toBe(true);
        });

        it('should reject non-existent bill', async () => {
            try {
                await $fetch('/api/bills/00000000-0000-0000-0000-000000000000/pay', {
                    method: 'PATCH',
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Should have thrown 404');
            } catch (e: any) {
                expect(e.response?.status).toBe(404);
            }
        });
    });

    // ==================== DELETE BILL TESTS ====================

    describe('DELETE /api/bills/:id - Delete Bill', () => {

        let deletableBillId: string;
        let paidBillToDelete: string;

        beforeAll(async () => {
            // Create unpaid bill for deletion
            const bill1 = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId,
                    period: '2026-12',
                    monthsCovered: 1,
                    meterStart: 4000,
                    meterEnd: 4100,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            deletableBillId = bill1.id;
            createdBillIds.push(bill1.id);

            // Create and pay a bill
            const bill2 = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId: room2Id,
                    period: '2026-12',
                    monthsCovered: 1,
                    meterStart: 1100,
                    meterEnd: 1200,
                    costPerKwh: 1600,
                    waterFee: 60000,
                    trashFee: 30000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            paidBillToDelete = bill2.id;
            createdBillIds.push(bill2.id);

            await $fetch(`/api/bills/${bill2.id}/pay`, {
                method: 'PATCH',
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
        });

        it('should delete unpaid bill by owner', async () => {
            const response = await $fetch<{ message: string }>(`/api/bills/${deletableBillId}`, {
                method: 'DELETE',
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(response.message).toContain('deleted');

            // Verify it's deleted
            try {
                await $fetch(`/api/bills/${deletableBillId}/pay`, {
                    method: 'PATCH',
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Bill should be deleted');
            } catch (e: any) {
                expect(e.response?.status).toBe(404);
            }
        });

        it('should reject deleting paid bill', async () => {
            try {
                await $fetch(`/api/bills/${paidBillToDelete}`, {
                    method: 'DELETE',
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Should have thrown 400 error');
            } catch (e: any) {
                expect(e.response?.status).toBe(400);
                expect(e.response?.statusText).toContain('Cannot delete a paid bill');
            }
        });

        it('should allow staff to delete unpaid bill', async () => {
            // Create unpaid bill
            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId: room2Id,
                    period: '2027-01',
                    monthsCovered: 1,
                    meterStart: 1200,
                    meterEnd: 1300,
                    costPerKwh: 1600,
                    waterFee: 60000,
                    trashFee: 30000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            createdBillIds.push(bill.id);

            const response = await $fetch<{ message: string }>(`/api/bills/${bill.id}`, {
                method: 'DELETE',
                headers: { Cookie: `auth_token=${staffToken}` }
            });

            expect(response.message).toContain('deleted');
        });

        it('should reject non-existent bill', async () => {
            try {
                await $fetch('/api/bills/00000000-0000-0000-0000-000000000000', {
                    method: 'DELETE',
                    headers: { Cookie: `auth_token=${ownerToken}` }
                });
                expect.fail('Should have thrown 404');
            } catch (e: any) {
                expect(e.response?.status).toBe(404);
            }
        });
    });

    // ==================== AUTHORIZATION TESTS ====================

    describe('Authorization Tests', () => {

        it('should reject unauthenticated requests to generate bill', async () => {
            try {
                await $fetch('/api/bills/generate', {
                    method: 'POST',
                    body: {
                        roomId,
                        period: '2027-02',
                        monthsCovered: 1,
                        meterStart: 5000,
                        meterEnd: 5100,
                        costPerKwh: 1500,
                        waterFee: 50000,
                        trashFee: 25000
                    }
                });
                expect.fail('Should have thrown 401');
            } catch (e: any) {
                expect(e.response?.status).toBe(401);
            }
        });

        it('should reject unauthenticated requests to list bills', async () => {
            try {
                await $fetch('/api/bills');
                expect.fail('Should have thrown 401');
            } catch (e: any) {
                expect(e.response?.status).toBe(401);
            }
        });

        it('should reject unauthenticated requests to mark as paid', async () => {
            try {
                await $fetch(`/api/bills/${createdBillIds[0]}/pay`, {
                    method: 'PATCH'
                });
                expect.fail('Should have thrown 401');
            } catch (e: any) {
                expect(e.response?.status).toBe(401);
            }
        });

        it('should reject unauthenticated requests to delete bill', async () => {
            try {
                await $fetch(`/api/bills/${createdBillIds[0]}`, {
                    method: 'DELETE'
                });
                expect.fail('Should have thrown 401');
            } catch (e: any) {
                expect(e.response?.status).toBe(401);
            }
        });
    });

    // ==================== EDGE CASES ====================

    describe('Edge Cases', () => {

        it('should handle zero usage (meterStart === meterEnd)', async () => {
            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId,
                    period: '2027-03',
                    monthsCovered: 1,
                    meterStart: 5000,
                    meterEnd: 5000, // Same as start
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(parseFloat(bill.usageCost)).toBe(0);
            createdBillIds.push(bill.id);
        });

        it('should handle very large meter readings', async () => {
            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId,
                    period: '2027-04',
                    monthsCovered: 1,
                    meterStart: 999999,
                    meterEnd: 1000500,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            const expectedUsage = (1000500 - 999999) * 1500;
            expect(parseFloat(bill.usageCost)).toBe(expectedUsage);
            createdBillIds.push(bill.id);
        });

        it('should handle 12-month billing period', async () => {
            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId: room2Id,
                    period: '2027-01',
                    monthsCovered: 12,
                    meterStart: 2000,
                    meterEnd: 2500,
                    costPerKwh: 1600,
                    waterFee: 60000,
                    trashFee: 30000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(bill.monthsCovered).toBe(12);
            expect(bill.periodEnd).toBe('2027-12');
            expect(parseFloat(bill.roomPrice)).toBe(2500000 * 12);
            expect(parseFloat(bill.waterFee)).toBe(60000 * 12);
            expect(parseFloat(bill.trashFee)).toBe(30000 * 12);
            createdBillIds.push(bill.id);
        });

        it('should handle bill with zero additional cost', async () => {
            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId,
                    period: '2027-05',
                    monthsCovered: 1,
                    meterStart: 6000,
                    meterEnd: 6100,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000,
                    additionalCost: 0
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            expect(parseFloat(bill.additionalCost)).toBe(0);
            createdBillIds.push(bill.id);
        });

        it('should handle February proration (28 days)', async () => {
            // Create room with Feb 15 move-in
            const febRoom = await $fetch<any>('/api/rooms', {
                method: 'POST',
                body: {
                    propertyId,
                    name: 'Room Feb Test',
                    price: 2800000,
                    tenantId,
                    status: 'occupied',
                    useTrashService: true,
                    moveInDate: '2026-02-15'
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            const bill = await $fetch<Bill>('/api/bills/generate', {
                method: 'POST',
                body: {
                    roomId: febRoom.id,
                    period: '2026-02',
                    monthsCovered: 1,
                    meterStart: 100,
                    meterEnd: 150,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });

            // February 2026 has 28 days
            // Days occupied: 28 - 15 + 1 = 14 days
            // Proration factor: 14/28 = 0.5
            const prorationFactor = 14 / 28;

            expect(parseFloat(bill.roomPrice)).toBeCloseTo(2800000 * prorationFactor, 0);
            expect(parseFloat(bill.waterFee)).toBeCloseTo(50000 * prorationFactor, 0);

            createdBillIds.push(bill.id);

            // Cleanup
            await db.delete(rooms).where(eq(rooms.id, febRoom.id));
        });
    });

});
