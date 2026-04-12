
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import {
    users,
    whatsappTemplates,
    properties,
    propertySettings,
    tenants,
    rooms,
    rentBills,
    utilityBills,
    meterReadings,
    globalSettings,
    integrationSettings,
    expenseCategories,
    expenses,
    systemLogs,
    systemSettings,
    backups,
    payments
} from './schema';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { getAllDefaultWhatsAppTemplates } from '../../shared/whatsapp-template-defaults';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function wipeData() {
    if (process.env.NODE_ENV !== 'development') {
        throw new Error('❌ wipeData can ONLY be run in development environment!');
    }
    console.log('Wiping data...');

    // Delete in reverse order of dependencies to avoid foreign key constraints
    await db.delete(payments);
    await db.delete(rentBills);
    await db.delete(utilityBills);
    await db.delete(meterReadings);
    await db.delete(rooms);
    await db.delete(propertySettings);
    await db.delete(expenses);
    await db.delete(tenants);
    await db.delete(properties);

    // Delete user-related settings and logs
    await db.delete(expenseCategories);
    await db.delete(integrationSettings);
    await db.delete(globalSettings);
    await db.delete(whatsappTemplates);
    await db.delete(systemLogs);
    await db.delete(backups);

    // Independent tables
    await db.delete(systemSettings);

    console.log('Data wiped successfully (keeping users)');
}

async function seedUsers() {
    console.log('Seeding users...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    await db.insert(users).values({
        name: 'Super Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
    }).onConflictDoNothing();
    console.log('Admin seeded successfully');

    await db.insert(users).values({
        name: 'Owner User',
        email: 'owner@example.com',
        password: hashedPassword,
        role: 'owner',
    }).onConflictDoNothing();
    console.log('Owner seeded successfully');

    await db.insert(users).values({
        name: 'Staff User',
        email: 'staff@example.com',
        password: hashedPassword,
        role: 'staff',
    }).onConflictDoNothing();
    console.log('Staff seeded successfully');
}

export async function seedWhatsAppTemplates(userId: string) {
    console.log('Seeding WhatsApp templates...');

    const templates = getAllDefaultWhatsAppTemplates().map((template) => ({
        ...template,
        userId,
    }));

    for (const template of templates) {
        await db.insert(whatsappTemplates)
            .values(template)
            .onConflictDoNothing();
    }

    console.log(`${templates.length} WhatsApp templates seeded successfully`);
}

async function main() {
    console.log('Starting seed process...');

    try {
        await wipeData();
        await seedUsers();
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await pool.end();
    }
}

main();
