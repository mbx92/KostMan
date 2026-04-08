// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
    properties,
    propertySettings,
    rooms,
    tenants,
    users,
    utilityBills,
} from '../server/database/schema';
import { createUtilityBill, syncUnpaidUtilityBillsForRoom } from '../server/services/utilityBillService';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

describe('utilityBillService', () => {
    const suffix = Date.now().toString();
    let ownerId: string;
    let propertyId: string;
    let roomId: string;
    let tenantId: string;
    let utilityBillId: string;

    beforeAll(async () => {
        const [owner] = await db.insert(users).values({
            email: `utility-service-${suffix}@example.com`,
            password: 'test-password',
            name: 'Utility Service Test',
            role: 'owner',
        }).returning({ id: users.id });
        ownerId = owner.id;

        const [property] = await db.insert(properties).values({
            userId: ownerId,
            name: `Properti Test ${suffix}`,
            address: 'Jl. Test No. 1',
            description: 'Property untuk test utility service',
            image: null,
            mapUrl: null,
        }).returning({ id: properties.id });
        propertyId = property.id;

        await db.insert(propertySettings).values({
            propertyId,
            costPerKwh: '1000',
            waterFee: '20000',
            trashFee: '5000',
        });

        const [tenant] = await db.insert(tenants).values({
            name: `Penghuni ${suffix}`,
            contact: '081234567890',
            idCardNumber: randomUUID().replace(/-/g, '').slice(0, 16),
            status: 'active',
        }).returning({ id: tenants.id });
        tenantId = tenant.id;

        const [room] = await db.insert(rooms).values({
            propertyId,
            tenantId,
            name: `Kamar ${suffix}`,
            price: '1000000',
            status: 'occupied',
            useTrashService: true,
            occupantCount: 1,
        }).returning({ id: rooms.id });
        roomId = room.id;
    });

    afterAll(async () => {
        if (utilityBillId) {
            await db.delete(utilityBills).where(eq(utilityBills.id, utilityBillId)).catch(() => { });
        }
        if (roomId) {
            await db.delete(rooms).where(eq(rooms.id, roomId)).catch(() => { });
        }
        if (tenantId) {
            await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => { });
        }
        if (propertyId) {
            await db.delete(propertySettings).where(eq(propertySettings.propertyId, propertyId)).catch(() => { });
            await db.delete(properties).where(eq(properties.id, propertyId)).catch(() => { });
        }
        if (ownerId) {
            await db.delete(users).where(eq(users.id, ownerId)).catch(() => { });
        }
        await pool.end().catch(() => { });
    });

    it('recalculates unpaid utility bill water fee when occupant count changes', async () => {
        const createdBill = await createUtilityBill({
            roomId,
            period: '2026-03',
            meterStart: 100,
            meterEnd: 110,
            costPerKwh: 1000,
            waterFee: 20000,
            trashFee: 5000,
        }, {
            id: ownerId,
            role: 'owner',
        });

        utilityBillId = createdBill.id;

        expect(Number(createdBill.waterFee)).toBe(20000);
        expect(Number(createdBill.totalAmount)).toBe(35000);

        await db.update(rooms).set({
            occupantCount: 2,
        }).where(eq(rooms.id, roomId));

        const [updatedBill] = await syncUnpaidUtilityBillsForRoom(roomId, {
            id: ownerId,
            role: 'owner',
        });

        expect(Number(updatedBill.waterFee)).toBe(40000);
        expect(Number(updatedBill.totalAmount)).toBe(55000);
    });
});
