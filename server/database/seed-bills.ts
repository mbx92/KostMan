#!/usr/bin/env tsx
/**
 * Bill Testing Data Seeder
 * 
 * This script seeds test data for manual billing API testing in Postman.
 * It creates properties, rooms, tenants, and meter readings using existing users.
 * 
 * Prerequisites:
 * - Run `npm run db:seed` first to create users
 * 
 * Usage:
 *   npm run db:seed-bills
 *   or
 *   npx tsx server/database/seed-bills.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { eq } from 'drizzle-orm';
import {
    users,
    properties,
    propertySettings,
    tenants,
    rooms,
    meterReadings,
    globalSettings
} from './schema';
import 'dotenv/config';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

// Colors for console output
const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    bold: '\x1b[1m',
};

async function main() {
    console.log(`${c.cyan}╔═══════════════════════════════════════╗${c.reset}`);
    console.log(`${c.cyan}║   Bill Testing Data Seeder            ║${c.reset}`);
    console.log(`${c.cyan}╚═══════════════════════════════════════╝${c.reset}\n`);

    try {
        // 1. Get existing owner user
        console.log(`${c.cyan}[1/6] Fetching existing users...${c.reset}`);

        const [owner] = await db.select().from(users).where(eq(users.email, 'owner@example.com'));
        const [staff] = await db.select().from(users).where(eq(users.email, 'staff@example.com'));

        if (!owner) {
            throw new Error('Owner user not found. Please run "npm run db:seed" first.');
        }

        console.log(`${c.green}✓ Found owner: ${owner.email}${c.reset}`);
        if (staff) {
            console.log(`${c.green}✓ Found staff: ${staff.email}${c.reset}`);
        }
        console.log();

        // 2. Create Global Settings
        console.log(`${c.cyan}[2/6] Creating global settings...${c.reset}`);

        await db.insert(globalSettings).values({
            userId: owner.id,
            appName: 'KostMan',
            costPerKwh: '1500',
            waterFee: '50000',
            trashFee: '25000',
        }).onConflictDoNothing();

        console.log(`${c.green}✓ Created global settings${c.reset}\n`);

        // 3. Create Properties
        console.log(`${c.cyan}[3/6] Creating properties...${c.reset}`);

        const [property1] = await db.insert(properties).values({
            userId: owner.id,
            name: 'Kost Mawar',
            address: 'Jl. Mawar No. 123, Jakarta Selatan',
            description: 'Kost nyaman di pusat kota dengan fasilitas lengkap',
            mapUrl: 'https://maps.google.com/?q=-6.2615,106.8106',
        }).returning();

        const [property2] = await db.insert(properties).values({
            userId: owner.id,
            name: 'Kost Melati',
            address: 'Jl. Melati No. 456, Jakarta Barat',
            description: 'Kost strategis dekat kampus dan stasiun',
            mapUrl: 'https://maps.google.com/?q=-6.1751,106.8650',
        }).returning();

        console.log(`${c.green}✓ Created property: ${property1.name} (ID: ${property1.id})${c.reset}`);
        console.log(`${c.green}✓ Created property: ${property2.name} (ID: ${property2.id})${c.reset}\n`);

        // 4. Create Property Settings
        console.log(`${c.cyan}[4/6] Creating property settings...${c.reset}`);

        await db.insert(propertySettings).values({
            propertyId: property1.id,
            costPerKwh: '1500',
            waterFee: '50000',
            trashFee: '25000',
        });

        await db.insert(propertySettings).values({
            propertyId: property2.id,
            costPerKwh: '1600',
            waterFee: '55000',
            trashFee: '30000',
        });

        console.log(`${c.green}✓ Created settings for ${property1.name}${c.reset}`);
        console.log(`${c.green}✓ Created settings for ${property2.name}${c.reset}\n`);

        // 5. Create Tenants
        console.log(`${c.cyan}[5/6] Creating tenants...${c.reset}`);

        const [tenant1] = await db.insert(tenants).values({
            name: 'Budi Santoso',
            contact: '081234567890',
            idCardNumber: '3171012345678901',
            status: 'active',
        }).returning();

        const [tenant2] = await db.insert(tenants).values({
            name: 'Siti Nurhaliza',
            contact: '081234567891',
            idCardNumber: '3171012345678902',
            status: 'active',
        }).returning();

        const [tenant3] = await db.insert(tenants).values({
            name: 'Ahmad Wijaya',
            contact: '081234567892',
            idCardNumber: '3171012345678903',
            status: 'active',
        }).returning();

        console.log(`${c.green}✓ Created tenant: ${tenant1.name} (ID: ${tenant1.id})${c.reset}`);
        console.log(`${c.green}✓ Created tenant: ${tenant2.name} (ID: ${tenant2.id})${c.reset}`);
        console.log(`${c.green}✓ Created tenant: ${tenant3.name} (ID: ${tenant3.id})${c.reset}\n`);

        // 6. Create Rooms
        console.log(`${c.cyan}[6/6] Creating rooms with meter readings...${c.reset}`);

        // Room A1 - Occupied with tenant
        const [room1] = await db.insert(rooms).values({
            propertyId: property1.id,
            tenantId: tenant1.id,
            name: 'A1',
            price: '1500000',
            status: 'occupied',
            useTrashService: true,
            moveInDate: '2025-12-01',
        }).returning();

        // Add meter readings for Room A1
        await db.insert(meterReadings).values({
            roomId: room1.id,
            period: '2025-12',
            meterStart: 1000,
            meterEnd: 1150,
            recordedAt: new Date('2025-12-31T10:00:00'),
            recorderBy: staff?.id || owner.id,
        });

        await db.insert(meterReadings).values({
            roomId: room1.id,
            period: '2026-01',
            meterStart: 1150,
            meterEnd: 1320,
            recordedAt: new Date('2026-01-31T10:00:00'),
            recorderBy: staff?.id || owner.id,
        });

        console.log(`${c.green}✓ Room A1 (${room1.id}) - Occupied by ${tenant1.name}${c.reset}`);
        console.log(`  Meter: Dec 2025 (1000→1150), Jan 2026 (1150→1320)`);

        // Room A2 - Occupied with tenant
        const [room2] = await db.insert(rooms).values({
            propertyId: property1.id,
            tenantId: tenant2.id,
            name: 'A2',
            price: '1500000',
            status: 'occupied',
            useTrashService: true,
            moveInDate: '2025-11-15',
        }).returning();

        await db.insert(meterReadings).values({
            roomId: room2.id,
            period: '2025-12',
            meterStart: 2000,
            meterEnd: 2200,
            recordedAt: new Date('2025-12-31T10:00:00'),
            recorderBy: staff?.id || owner.id,
        });

        await db.insert(meterReadings).values({
            roomId: room2.id,
            period: '2026-01',
            meterStart: 2200,
            meterEnd: 2380,
            recordedAt: new Date('2026-01-31T10:00:00'),
            recorderBy: staff?.id || owner.id,
        });

        console.log(`${c.green}✓ Room A2 (${room2.id}) - Occupied by ${tenant2.name}${c.reset}`);
        console.log(`  Meter: Dec 2025 (2000→2200), Jan 2026 (2200→2380)`);

        // Room A3 - Occupied, no trash service
        const [room3] = await db.insert(rooms).values({
            propertyId: property1.id,
            tenantId: tenant3.id,
            name: 'A3',
            price: '1800000',
            status: 'occupied',
            useTrashService: false,
            moveInDate: '2025-10-01',
        }).returning();

        await db.insert(meterReadings).values({
            roomId: room3.id,
            period: '2026-01',
            meterStart: 3000,
            meterEnd: 3150,
            recordedAt: new Date('2026-01-31T10:00:00'),
            recorderBy: staff?.id || owner.id,
        });

        console.log(`${c.green}✓ Room A3 (${room3.id}) - Occupied by ${tenant3.name} (No trash)${c.reset}`);
        console.log(`  Meter: Jan 2026 (3000→3150)`);

        // Room B1 - Available (no tenant)
        const [room4] = await db.insert(rooms).values({
            propertyId: property2.id,
            name: 'B1',
            price: '1600000',
            status: 'available',
            useTrashService: true,
        }).returning();

        console.log(`${c.green}✓ Room B1 (${room4.id}) - Available${c.reset}`);

        // Room B2 - Maintenance
        const [room5] = await db.insert(rooms).values({
            propertyId: property2.id,
            name: 'B2',
            price: '1600000',
            status: 'maintenance',
            useTrashService: true,
        }).returning();

        console.log(`${c.green}✓ Room B2 (${room5.id}) - Maintenance${c.reset}\n`);

        // Summary
        console.log(`${c.green}╔═══════════════════════════════════════╗${c.reset}`);
        console.log(`${c.green}║   ✓ Test data seeded successfully!    ║${c.reset}`);
        console.log(`${c.green}╚═══════════════════════════════════════╝${c.reset}\n`);

        console.log(`${c.bold}${c.cyan}📊 Summary:${c.reset}`);
        console.log(`  • 2 Properties (Kost Mawar, Kost Melati)`);
        console.log(`  • 3 Tenants (all active)`);
        console.log(`  • 5 Rooms (3 occupied, 1 available, 1 maintenance)`);
        console.log(`  • 5 Meter readings`);
        console.log();

        console.log(`${c.bold}${c.yellow}🔑 Test Credentials:${c.reset}`);
        console.log(`  Email:    owner@example.com`);
        console.log(`  Password: password123`);
        console.log();

        console.log(`${c.bold}${c.cyan}📝 Postman Testing Guide:${c.reset}`);
        console.log();
        console.log(`${c.bold}1. Login${c.reset}`);
        console.log(`   POST /api/auth/login`);
        console.log(`   Body: { "email": "owner@example.com", "password": "password123" }`);
        console.log();

        console.log(`${c.bold}2. Generate Bill for Room A1 (Single Month)${c.reset}`);
        console.log(`   POST /api/bills/generate`);
        console.log(`   Body: {`);
        console.log(`     "roomId": "${room1.id}",`);
        console.log(`     "period": "2026-01",`);
        console.log(`     "monthsCovered": 1,`);
        console.log(`     "meterStart": 1150,`);
        console.log(`     "meterEnd": 1320,`);
        console.log(`     "costPerKwh": 1500,`);
        console.log(`     "waterFee": 50000,`);
        console.log(`     "trashFee": 25000,`);
        console.log(`     "additionalCost": 0`);
        console.log(`   }`);
        console.log(`   Expected: Rp 1,830,000 (Room: 1,500,000 + Usage: 255,000 + Water: 50,000 + Trash: 25,000)`);
        console.log();

        console.log(`${c.bold}3. Generate Multi-Month Bill for Room A2${c.reset}`);
        console.log(`   POST /api/bills/generate`);
        console.log(`   Body: {`);
        console.log(`     "roomId": "${room2.id}",`);
        console.log(`     "period": "2026-02",`);
        console.log(`     "monthsCovered": 3,`);
        console.log(`     "meterStart": 2380,`);
        console.log(`     "meterEnd": 2680,`);
        console.log(`     "costPerKwh": 1500,`);
        console.log(`     "waterFee": 50000,`);
        console.log(`     "trashFee": 25000,`);
        console.log(`     "additionalCost": 0`);
        console.log(`   }`);
        console.log(`   Expected: Rp 5,175,000 (Room: 4,500,000 + Usage: 450,000 + Water: 150,000 + Trash: 75,000)`);
        console.log();

        console.log(`${c.bold}4. Generate Bill for Room A3 (No Trash Service)${c.reset}`);
        console.log(`   POST /api/bills/generate`);
        console.log(`   Body: {`);
        console.log(`     "roomId": "${room3.id}",`);
        console.log(`     "period": "2026-01",`);
        console.log(`     "monthsCovered": 1,`);
        console.log(`     "meterStart": 3000,`);
        console.log(`     "meterEnd": 3150,`);
        console.log(`     "costPerKwh": 1500,`);
        console.log(`     "waterFee": 50000,`);
        console.log(`     "trashFee": 0,`);
        console.log(`     "additionalCost": 50000`);
        console.log(`   }`);
        console.log(`   Expected: Rp 2,125,000 (Room: 1,800,000 + Usage: 225,000 + Water: 50,000 + Additional: 50,000)`);
        console.log();

        console.log(`${c.bold}5. List All Bills${c.reset}`);
        console.log(`   GET /api/bills`);
        console.log();

        console.log(`${c.bold}6. Filter Bills${c.reset}`);
        console.log(`   GET /api/bills?isPaid=false    (unpaid bills)`);
        console.log(`   GET /api/bills?isPaid=true     (paid bills)`);
        console.log(`   GET /api/bills?roomId=${room1.id}`);
        console.log();

        console.log(`${c.bold}7. Mark Bill as Paid${c.reset}`);
        console.log(`   PATCH /api/bills/{billId}/pay`);
        console.log();

        console.log(`${c.bold}8. Delete Bill${c.reset}`);
        console.log(`   DELETE /api/bills/{billId}`);
        console.log();

        console.log(`${c.yellow}💡 Tip: Save the room IDs above for easy copy-paste in Postman!${c.reset}\n`);

    } catch (error: any) {
        console.error(`${c.red}✗ Error seeding database:${c.reset}`, error.message);
        console.error(error);
        throw error;
    } finally {
        await pool.end();
    }
}

main();
