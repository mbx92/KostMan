import { describe, it, expect, beforeAll } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';

describe('Bill Proration', async () => {
    await setup({
        server: true,
    });

    let authToken: string;
    let propertyId: string;
    let roomId: string;
    let tenantId: string;

    beforeAll(async () => {
        // Register and login
        await $fetch('/api/auth/register', {
            method: 'POST',
            body: {
                email: 'proration@test.com',
                password: 'password123',
                name: 'Proration Test User',
                role: 'owner',
            },
        });

        const loginResponse = await $fetch('/api/auth/login', {
            method: 'POST',
            body: {
                email: 'proration@test.com',
                password: 'password123',
            },
        });

        authToken = loginResponse.token;

        // Create property
        const property = await $fetch('/api/properties', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
            body: {
                name: 'Proration Test Property',
                address: '123 Test St',
                description: 'Test property for proration',
            },
        });

        propertyId = property.id;

        // Create property settings
        await $fetch('/api/properties/settings', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
            body: {
                propertyId,
                costPerKwh: 1500,
                waterFee: 50000,
                trashFee: 25000,
            },
        });

        // Create tenant
        const tenant = await $fetch('/api/tenants', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
            body: {
                name: 'Test Tenant',
                contact: '081234567890',
                idCardNumber: '1234567890123456',
            },
        });

        tenantId = tenant.id;
    });

    describe('Mid-month move-in proration', () => {
        it('should prorate bill for tenant moving in on 15th of month', async () => {
            // Create room with move-in date on 15th
            const room = await $fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    propertyId,
                    tenantId,
                    name: 'Room 15th',
                    price: 3000000, // 3 million per month
                    status: 'occupied',
                    useTrashService: true,
                    moveInDate: '2026-01-15', // Moved in on 15th
                },
            });

            // Generate bill for January 2026
            const bill = await $fetch('/api/bills/generate', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    roomId: room.id,
                    period: '2026-01',
                    meterStart: 100,
                    meterEnd: 150,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000,
                    monthsCovered: 1,
                },
            });

            // January has 31 days, tenant moved in on 15th
            // Days occupied: 31 - 15 + 1 = 17 days
            // Proration factor: 17/31 ≈ 0.5484
            const expectedProrationFactor = 17 / 31;

            const expectedRoomPrice = 3000000 * expectedProrationFactor;
            const expectedWaterFee = 50000 * expectedProrationFactor;
            const expectedTrashFee = 25000 * expectedProrationFactor;
            const expectedUsageCost = (150 - 100) * 1500; // Not prorated
            const expectedTotal = expectedRoomPrice + expectedWaterFee + expectedTrashFee + expectedUsageCost;

            expect(parseFloat(bill.roomPrice)).toBeCloseTo(expectedRoomPrice, 0);
            expect(parseFloat(bill.waterFee)).toBeCloseTo(expectedWaterFee, 0);
            expect(parseFloat(bill.trashFee)).toBeCloseTo(expectedTrashFee, 0);
            expect(parseFloat(bill.usageCost)).toBe(expectedUsageCost);
            expect(parseFloat(bill.totalAmount)).toBeCloseTo(expectedTotal, 0);
        });

        it('should NOT prorate bill for tenant moving in on 1st of month', async () => {
            // Create room with move-in date on 1st
            const room = await $fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    propertyId,
                    tenantId,
                    name: 'Room 1st',
                    price: 3000000,
                    status: 'occupied',
                    useTrashService: true,
                    moveInDate: '2026-01-01', // Moved in on 1st
                },
            });

            // Generate bill for January 2026
            const bill = await $fetch('/api/bills/generate', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    roomId: room.id,
                    period: '2026-01',
                    meterStart: 100,
                    meterEnd: 150,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000,
                    monthsCovered: 1,
                },
            });

            // Should charge full month
            expect(parseFloat(bill.roomPrice)).toBe(3000000);
            expect(parseFloat(bill.waterFee)).toBe(50000);
            expect(parseFloat(bill.trashFee)).toBe(25000);
        });

        it('should NOT prorate bill for subsequent months after move-in', async () => {
            // Create room with move-in date in December
            const room = await $fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    propertyId,
                    tenantId,
                    name: 'Room Subsequent',
                    price: 3000000,
                    status: 'occupied',
                    useTrashService: true,
                    moveInDate: '2025-12-15', // Moved in December 15th
                },
            });

            // Generate bill for January 2026 (next month)
            const bill = await $fetch('/api/bills/generate', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    roomId: room.id,
                    period: '2026-01', // Next month after move-in
                    meterStart: 100,
                    meterEnd: 150,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000,
                    monthsCovered: 1,
                },
            });

            // Should charge full month (no proration for subsequent months)
            expect(parseFloat(bill.roomPrice)).toBe(3000000);
            expect(parseFloat(bill.waterFee)).toBe(50000);
            expect(parseFloat(bill.trashFee)).toBe(25000);
        });

        it('should handle room without trash service in proration', async () => {
            // Create room without trash service
            const room = await $fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    propertyId,
                    tenantId,
                    name: 'Room No Trash',
                    price: 2000000,
                    status: 'occupied',
                    useTrashService: false, // No trash service
                    moveInDate: '2026-01-20', // Moved in on 20th
                },
            });

            // Generate bill
            const bill = await $fetch('/api/bills/generate', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    roomId: room.id,
                    period: '2026-01',
                    meterStart: 100,
                    meterEnd: 120,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000,
                    monthsCovered: 1,
                },
            });

            // Trash fee should be 0 regardless of proration
            expect(parseFloat(bill.trashFee)).toBe(0);

            // Other fees should be prorated
            const expectedProrationFactor = 12 / 31; // 12 days (20th to 31st)
            expect(parseFloat(bill.roomPrice)).toBeCloseTo(2000000 * expectedProrationFactor, 0);
            expect(parseFloat(bill.waterFee)).toBeCloseTo(50000 * expectedProrationFactor, 0);
        });

        it('should handle room without moveInDate (no proration)', async () => {
            // Create room without move-in date
            const room = await $fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    propertyId,
                    tenantId,
                    name: 'Room No Date',
                    price: 2500000,
                    status: 'occupied',
                    useTrashService: true,
                    // No moveInDate
                },
            });

            // Generate bill
            const bill = await $fetch('/api/bills/generate', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    roomId: room.id,
                    period: '2026-01',
                    meterStart: 100,
                    meterEnd: 150,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000,
                    monthsCovered: 1,
                },
            });

            // Should charge full month (no proration without moveInDate)
            expect(parseFloat(bill.roomPrice)).toBe(2500000);
            expect(parseFloat(bill.waterFee)).toBe(50000);
            expect(parseFloat(bill.trashFee)).toBe(25000);
        });

        it('should prorate correctly for February (28 days)', async () => {
            // Create room with move-in date on Feb 15th
            const room = await $fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    propertyId,
                    tenantId,
                    name: 'Room Feb',
                    price: 2800000,
                    status: 'occupied',
                    useTrashService: true,
                    moveInDate: '2026-02-15', // Feb 15th (non-leap year)
                },
            });

            // Generate bill for February 2026
            const bill = await $fetch('/api/bills/generate', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: {
                    roomId: room.id,
                    period: '2026-02',
                    meterStart: 100,
                    meterEnd: 130,
                    costPerKwh: 1500,
                    waterFee: 50000,
                    trashFee: 25000,
                    monthsCovered: 1,
                },
            });

            // February 2026 has 28 days, tenant moved in on 15th
            // Days occupied: 28 - 15 + 1 = 14 days
            // Proration factor: 14/28 = 0.5
            const expectedProrationFactor = 14 / 28;

            expect(parseFloat(bill.roomPrice)).toBeCloseTo(2800000 * expectedProrationFactor, 0);
            expect(parseFloat(bill.waterFee)).toBeCloseTo(50000 * expectedProrationFactor, 0);
            expect(parseFloat(bill.trashFee)).toBeCloseTo(25000 * expectedProrationFactor, 0);
        });
    });
});
