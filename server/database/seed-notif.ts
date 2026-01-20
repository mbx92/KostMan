#!/usr/bin/env tsx
/**
 * Comprehensive Notification Testing Data Seeder
 * 
 * This script seeds a large realistic dataset for testing:
 * - 5 Properties
 * - 50 Rooms with Tenants
 * - Meter Readings for all rooms
 * - 50+ Bills distributed across Overdue, Due Soon, Upcoming
 * 
 * Usage:
 *   npm run db:seed-notif
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
    rentBills,
    utilityBills
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

// --- Helpers ---
const formatDate = (date: Date) => date.toISOString().split('T')[0];
const getPeriod = (date: Date) => date.toISOString().substring(0, 7);

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Indonesian Names Generator
const firstNames = ['Budi', 'Siti', 'Ahmad', 'Dewi', 'Rudi', 'Putri', 'Joko', 'Maya', 'Eka', 'Rina',
    'Dimas', 'Anisa', 'Bagus', 'Lina', 'Hendra', 'Sari', 'Arif', 'Tari', 'Yusuf', 'Intan',
    'Rizki', 'Fajar', 'Indah', 'Wahyu', 'Mega', 'Bayu', 'Citra', 'Gilang', 'Wulan', 'Andi'];
const lastNames = ['Santoso', 'Wijaya', 'Kurniawan', 'Pratama', 'Setiawan', 'Lestari', 'Hidayat',
    'Rahmawati', 'Putra', 'Wati', 'Saputra', 'Nugroho', 'Susanto', 'Hartono', 'Suryadi'];

function randomName(): string {
    return `${firstNames[randomInt(0, firstNames.length - 1)]} ${lastNames[randomInt(0, lastNames.length - 1)]}`;
}

function randomPhone(): string {
    return `08${randomInt(10, 99)}${randomInt(1000000, 9999999)}`;
}

function randomIdCard(): string {
    return `31710${randomInt(10000000000, 99999999999)}`;
}

async function main() {
    console.log(`${c.cyan}╔════════════════════════════════════════════╗${c.reset}`);
    console.log(`${c.cyan}║   Comprehensive Test Data Seeder           ║${c.reset}`);
    console.log(`${c.cyan}╚════════════════════════════════════════════╝${c.reset}\n`);

    try {
        // 1. Get existing owner user
        console.log(`${c.cyan}[1/6] Fetching existing owner...${c.reset}`);
        const [owner] = await db.select().from(users).where(eq(users.email, 'owner@example.com'));
        if (!owner) {
            throw new Error('Owner user not found. Please run "npm run db:seed" first.');
        }
        console.log(`${c.green}✓ Found owner: ${owner.email}${c.reset}\n`);

        // 2. Create 5 Properties
        console.log(`${c.cyan}[2/6] Creating 5 properties...${c.reset}`);
        const propertyData = [
            { name: 'Kost Mawar Indah', address: 'Jl. Mawar No. 10, Jakarta Selatan', roomPrefix: 'MW' },
            { name: 'Kost Melati Asri', address: 'Jl. Melati No. 25, Jakarta Barat', roomPrefix: 'ML' },
            { name: 'Kost Anggrek Jaya', address: 'Jl. Anggrek No. 5, Jakarta Utara', roomPrefix: 'AG' },
            { name: 'Kost Kenanga Permai', address: 'Jl. Kenanga No. 8, Jakarta Timur', roomPrefix: 'KN' },
            { name: 'Kost Dahlia Sakti', address: 'Jl. Dahlia No. 15, Tangerang', roomPrefix: 'DH' },
        ];

        const createdProperties: any[] = [];
        for (const p of propertyData) {
            const [prop] = await db.insert(properties).values({
                userId: owner.id,
                name: p.name,
                address: p.address,
                description: `Kost nyaman dan strategis di ${p.address}`,
            }).returning();

            await db.insert(propertySettings).values({
                propertyId: prop.id,
                costPerKwh: `${randomInt(1500, 2000)}`,
                waterFee: `${randomInt(40000, 60000)}`,
                trashFee: `${randomInt(20000, 35000)}`,
            });

            createdProperties.push({ ...prop, roomPrefix: p.roomPrefix });
            console.log(`${c.green}✓ Created: ${p.name}${c.reset}`);
        }
        console.log();

        // 3. Create 50 Tenants
        console.log(`${c.cyan}[3/6] Creating 50 tenants...${c.reset}`);
        const createdTenants: any[] = [];
        for (let i = 0; i < 50; i++) {
            const [tenant] = await db.insert(tenants).values({
                name: randomName(),
                contact: randomPhone(),
                idCardNumber: randomIdCard(),
                status: 'active',
            }).returning();
            createdTenants.push(tenant);
        }
        console.log(`${c.green}✓ Created 50 tenants${c.reset}\n`);

        // 4. Create 50 Rooms (10 per property) with Tenants
        console.log(`${c.cyan}[4/6] Creating 50 rooms with meter readings...${c.reset}`);
        const createdRooms: any[] = [];
        let tenantIndex = 0;
        const today = new Date();

        for (const prop of createdProperties) {
            for (let i = 1; i <= 10; i++) {
                const tenant = createdTenants[tenantIndex++];
                const roomPrice = randomInt(1000000, 2000000);
                const moveInDate = addDays(today, -randomInt(30, 180)); // Moved in 1-6 months ago

                const [room] = await db.insert(rooms).values({
                    propertyId: prop.id,
                    tenantId: tenant.id,
                    name: `${prop.roomPrefix}-${String(i).padStart(2, '0')}`,
                    price: `${roomPrice}`,
                    status: 'occupied',
                    useTrashService: randomInt(0, 1) === 1,
                    occupantCount: randomInt(1, 3),
                    moveInDate: formatDate(moveInDate),
                }).returning();

                // Create meter reading for this month
                const meterStart = randomInt(1000, 5000);
                const kwhUsage = randomInt(50, 200);
                await db.insert(meterReadings).values({
                    roomId: room.id,
                    period: getPeriod(today),
                    meterStart: meterStart,
                    meterEnd: meterStart + kwhUsage,
                    recordedAt: today,
                    recordedBy: owner.id,
                });

                createdRooms.push({
                    ...room,
                    tenantId: tenant.id,
                    meterStart,
                    meterEnd: meterStart + kwhUsage,
                    propertyName: prop.name
                });
            }
        }
        console.log(`${c.green}✓ Created 50 rooms with meter readings${c.reset}\n`);

        // 5. Create Bills: ~15 Overdue, ~15 Due Soon, ~20 Upcoming
        console.log(`${c.cyan}[5/6] Creating bills (Overdue, Due Soon, Upcoming)...${c.reset}`);

        const currentPeriod = getPeriod(today);
        let overdueCount = 0, dueSoonCount = 0, upcomingCount = 0;

        for (let i = 0; i < createdRooms.length; i++) {
            const room = createdRooms[i];
            const tenant = createdTenants[i];

            // Distribute: First 15 = Overdue, Next 15 = Due Soon, Rest = Upcoming
            let dueDays: number;
            if (i < 15) {
                // Overdue: Due date in the past (1-10 days ago)
                dueDays = -randomInt(1, 10);
                overdueCount++;
            } else if (i < 30) {
                // Due Soon: Due in 1-7 days
                dueDays = randomInt(1, 7);
                dueSoonCount++;
            } else {
                // Upcoming: Due in 8-30 days
                dueDays = randomInt(8, 30);
                upcomingCount++;
            }

            const dueDate = addDays(today, dueDays);
            const lastMonth = addDays(today, -30);

            // Random: Create Rent Bill or Utility Bill or Both
            const billType = randomInt(1, 3); // 1=Rent, 2=Utility, 3=Both

            if (billType === 1 || billType === 3) {
                // Rent Bill
                const roomPrice = parseInt(room.price);
                const monthsCovered = randomInt(1, 3);
                const waterFee = randomInt(40000, 60000);
                const trashFee = room.useTrashService ? randomInt(20000, 35000) : 0;
                const totalRent = (roomPrice * monthsCovered) + waterFee + trashFee;

                await db.insert(rentBills).values({
                    roomId: room.id,
                    tenantId: tenant.id,
                    period: currentPeriod,
                    periodStartDate: formatDate(lastMonth),
                    periodEndDate: formatDate(today),
                    dueDate: formatDate(dueDate),
                    monthsCovered: monthsCovered,
                    roomPrice: `${roomPrice}`,
                    waterFee: `${waterFee}`,
                    trashFee: `${trashFee}`,
                    totalAmount: `${totalRent}`,
                    isPaid: false,
                    generatedAt: new Date(),
                });
            }

            if (billType === 2 || billType === 3) {
                // Utility Bill
                const costPerKwh = randomInt(1500, 2000);
                const usageCost = (room.meterEnd - room.meterStart) * costPerKwh;
                const waterFee = randomInt(40000, 60000);
                const trashFee = room.useTrashService ? randomInt(20000, 35000) : 0;
                const totalUtility = usageCost + waterFee + trashFee;

                await db.insert(utilityBills).values({
                    roomId: room.id,
                    tenantId: tenant.id,
                    period: currentPeriod,
                    meterStart: room.meterStart,
                    meterEnd: room.meterEnd,
                    costPerKwh: `${costPerKwh}`,
                    usageCost: `${usageCost}`,
                    waterFee: `${waterFee}`,
                    trashFee: `${trashFee}`,
                    totalAmount: `${totalUtility}`,
                    isPaid: false,
                    generatedAt: new Date(),
                });
            }
        }

        console.log(`${c.green}✓ Created Overdue Bills: ${overdueCount}${c.reset}`);
        console.log(`${c.green}✓ Created Due Soon Bills: ${dueSoonCount}${c.reset}`);
        console.log(`${c.green}✓ Created Upcoming Bills: ${upcomingCount}${c.reset}\n`);

        // Summary
        console.log(`${c.bold}${c.green}╔═══════════════════════════════════════════╗${c.reset}`);
        console.log(`${c.bold}${c.green}║    ✓ Test data seeded successfully!      ║${c.reset}`);
        console.log(`${c.bold}${c.green}╚═══════════════════════════════════════════╝${c.reset}\n`);

        console.log(`${c.bold}${c.cyan}📊 Summary:${c.reset}`);
        console.log(`  • Properties:    5`);
        console.log(`  • Tenants:       50`);
        console.log(`  • Rooms:         50 (all occupied)`);
        console.log(`  • Meter Readings: 50`);
        console.log(`  • Bills:         ~${overdueCount + dueSoonCount + upcomingCount}+ (Rent + Utility)`);
        console.log(`    - Overdue:     ${overdueCount}`);
        console.log(`    - Due Soon:    ${dueSoonCount}`);
        console.log(`    - Upcoming:    ${upcomingCount}`);
        console.log();

    } catch (error: any) {
        console.error(`${c.red}✗ Error seeding database:${c.reset}`, error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
