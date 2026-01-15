
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users, properties, rooms } from '../../server/database/schema';
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
    // ... other fields
}

interface RoomResponse {
    id: string;
    propertyId: string;
    name: string;
    price: string;
    status: string;
    useTrashService: boolean;
    property?: any;
}

interface RoomListResponse {
    data: RoomResponse[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    }
}

describe('Room Management Integration', async () => {

    await setup({
        server: true
    });

    const timestamp = Date.now();

    const ownerUser = {
        email: `room_owner_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Room Owner',
        role: 'owner'
    };

    const otherOwnerUser = {
        email: `room_other_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Room Other',
        role: 'owner'
    };

    let ownerToken: string;
    let otherOwnerToken: string;
    let propertyId: string;
    let createdRoomId: string;

    beforeAll(async () => {
        try {
            const hashedPassword = await bcrypt.hash('Password123!', 10);

            // Insert Users
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
            const loginOwner = await $fetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email: ownerUser.email, password: ownerUser.password } });
            ownerToken = loginOwner.token;

            const loginOther = await $fetch<LoginResponse>('/api/auth/login', { method: 'POST', body: { email: otherOwnerUser.email, password: otherOwnerUser.password } });
            otherOwnerToken = loginOther.token;

            // Create Property for Owner
            const propRes = await $fetch<PropertyResponse>('/api/properties', {
                method: 'POST',
                body: {
                    name: 'Kost Room Test',
                    address: 'Test Address',
                    description: 'For Room Testing'
                },
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            propertyId = propRes.id;

        } catch (err) {
            console.error('Setup failed', err);
            throw err;
        }
    });

    afterAll(async () => {
        try {
            if (createdRoomId) {
                await db.delete(rooms).where(eq(rooms.id, createdRoomId));
            }
            if (propertyId) {
                await db.delete(properties).where(eq(properties.id, propertyId));
            }
            await db.delete(users).where(eq(users.email, ownerUser.email));
            await db.delete(users).where(eq(users.email, otherOwnerUser.email));
            await pool.end();
        } catch (e) {
            console.error('Cleanup failed', e);
        }
    });

    it('POST /api/rooms - Owner can create room', async () => {
        const newRoom = {
            propertyId: propertyId,
            name: 'Room 101',
            price: 1500000,
            status: 'available',
            useTrashService: true
        };

        const res = await $fetch<RoomResponse>('/api/rooms', {
            method: 'POST',
            body: newRoom,
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res).toHaveProperty('id');
        expect(res.name).toBe(newRoom.name);
        expect(Number(res.price)).toBe(newRoom.price);

        createdRoomId = res.id;
    });

    it('GET /api/rooms - Owner can list rooms with filter', async () => {
        const res = await $fetch<RoomListResponse>('/api/rooms', {
            params: { propertyId: propertyId },
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res.data.length).toBeGreaterThan(0);
        expect(res.data[0].id).toBe(createdRoomId);
        expect(res.data[0].property).toBeDefined(); // Check join
    });

    it('GET /api/rooms/[id] - Owner can view room detail', async () => {
        const res = await $fetch<RoomResponse>(`/api/rooms/${createdRoomId}`, {
            headers: { Cookie: `auth_token=${ownerToken}` }
        });
        expect(res.id).toBe(createdRoomId);
        expect(res.name).toBe('Room 101');
    });

    it('GET /api/rooms/[id] - Other Owner cannot view room (403)', async () => {
        try {
            await $fetch(`/api/rooms/${createdRoomId}`, {
                headers: { Cookie: `auth_token=${otherOwnerToken}` }
            });
            expect.fail('Should fail with 403');
        } catch (e: any) {
            expect(e.response?.status).toBe(403);
        }
    });

    it('PUT /api/rooms/[id] - Owner can update room', async () => {
        const updateData = {
            name: 'Room 101 Deluxe',
            price: 2000000
        };

        const res = await $fetch<RoomResponse>(`/api/rooms/${createdRoomId}`, {
            method: 'PUT',
            body: updateData,
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res.name).toBe(updateData.name);
        expect(Number(res.price)).toBe(updateData.price);
    });

    it('DELETE /api/rooms/[id] - Owner can delete room', async () => {
        const res = await $fetch<{ message: string }>(`/api/rooms/${createdRoomId}`, {
            method: 'DELETE',
            headers: { Cookie: `auth_token=${ownerToken}` }
        });

        expect(res.message).toContain('deleted');

        // Verify gone
        try {
            await $fetch(`/api/rooms/${createdRoomId}`, {
                headers: { Cookie: `auth_token=${ownerToken}` }
            });
            expect.fail('Should 404');
        } catch (e: any) {
            expect(e.response?.status).toBe(404);
        }
    });

});
