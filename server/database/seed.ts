
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users } from './schema';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function main() {
    console.log('Seeding database...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    try {
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

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await pool.end();
    }
}

main();
