import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import {
    users, properties, rooms, tenants, rentBills, utilityBills,
    expenses, expenseCategories, paymentMethodEnum, roleEnum,
    meterReadings, propertySettings
} from './schema';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function main() {
    console.log('Seeding Reports Data...');

    try {
        // --- CLEANUP ---
        // --- CLEANUP ---
        console.log('Cleaning existing data (preserving users)...');
        // Delete children first
        console.log('Deleting rentBills...'); await db.delete(rentBills);
        console.log('Deleting utilityBills...'); await db.delete(utilityBills);

        try {
            console.log('Deleting meterReadings...');
            await db.delete(meterReadings);
        } catch (e) {
            console.log('Skipping meterReadings cleanup (table might not exist).');
        }

        console.log('Deleting expenses...'); await db.delete(expenses);

        try {
            console.log('Deleting propertySettings...');
            await db.delete(propertySettings);
        } catch (e) {
            console.log('Skipping propertySettings cleanup.');
        }

        console.log('Deleting rooms...'); await db.delete(rooms);
        console.log('Deleting tenants...'); await db.delete(tenants);
        console.log('Deleting properties...'); await db.delete(properties);
        console.log('Deleting expenseCategories...'); await db.delete(expenseCategories);

        console.log('Data cleaned.');

        // --- FETCH USER ---
        const user = await db.select().from(users).where(eq(users.email, 'admin@example.com')).limit(1);
        if (!user.length) {
            console.error('Admin user not found, please run basic seed first.');
            return;
        }
        const userId = user[0].id;

        // --- SEED EXPENSE CATEGORIES ---
        console.log('Seeding Expense Categories...');
        const categoriesData = [
            { name: 'Maintenance', type: 'maintenance' },
            { name: 'Utilities', type: 'utilities' },
            { name: 'Salary', type: 'salary' },
            { name: 'Marketing', type: 'marketing' },
            { name: 'Tax', type: 'tax' },
            { name: 'Consumables', type: 'cleaning' }
        ];
        // Note: 'type' might be restricted by enum or just string. Schema usually has 'category' table with name. 
        // Let's assume standardized names.

        try {
            await db.insert(expenseCategories).values(
                categoriesData.map(c => ({
                    userId, // Fix: Schema requires userId
                    name: c.name,
                    description: `Expenses for ${c.name}`
                }))
            ).returning();
        } catch (e) {
            console.error('Error seeding categories:' + JSON.stringify(e));
            throw e;
        }

        // --- SEED PROPERTIES ---
        console.log('Seeding Properties...');
        const propsData = [
            { name: 'Kost Mawar (Premium)', address: 'Jl. Mawar No. 1' },
            { name: 'Kost Melati (Budget)', address: 'Jl. Melati No. 5' }
        ];

        let propertiesResult: any[] = [];
        try {
            propertiesResult = await db.insert(properties).values(
                propsData.map(p => ({
                    userId,
                    name: p.name,
                    address: p.address,
                    description: 'Generated Property'
                }))
            ).returning();
        } catch (e) {
            console.error('Error seeding properties:' + JSON.stringify(e));
            throw e;
        }

        const prop1 = propertiesResult[0]; // Mawar
        const prop2 = propertiesResult[1]; // Melati

        if (!prop1 || !prop2) {
            throw new Error("Failed to seed properties");
        }

        // --- SEED TENANTS ---
        console.log('Seeding Tenants...');
        const tenantsData = [
            { name: 'Budi Santoso', contact: '081234567890', status: 'active' },
            { name: 'Siti Nurhaliza', contact: '081234567891', status: 'active' },
            { name: 'Andi Wijaya', contact: '081234567892', status: 'active' },
            { name: 'Dewi Lestari', contact: '081234567893', status: 'active' },
            { name: 'Rina Kurnia', contact: '081234567894', status: 'active' },
            { name: 'Joko Anwar', contact: '081234567895', status: 'inactive' }, // Past tenant
            { name: 'Maya Putri', contact: '081234567896', status: 'inactive' },
            { name: 'Eko Prasetyo', contact: '081234567897', status: 'active' }
        ];

        // Schema requires idCardNumber
        let tenantsResult: any[] = [];
        try {
            tenantsResult = await db.insert(tenants).values(
                tenantsData.map((t, idx) => ({
                    name: t.name,
                    contact: t.contact,
                    idCardNumber: `123456789012345${idx}`, // Unique ID
                    status: t.status as any
                }))
            ).returning();
        } catch (e) {
            console.error('Error seeding tenants:' + JSON.stringify(e));
            throw e;
        }

        // --- SEED ROOMS ---
        console.log('Seeding Rooms...');
        const roomsToInsert = [];

        // Prop 1 Rooms (Premium) - 2.5jt
        // Assign tenants 0, 1, 2, 7 (Active)
        // Tenant 5, 6 (Inactive) were here
        // We only link ACTIVE tenants to rooms in 'tenantId' column usually.

        // Room 101 - Active (Budi)
        roomsToInsert.push({ propertyId: prop1.id, name: '101', price: '2500000', tenantId: tenantsResult[0]?.id, status: 'occupied' as any, moveInDate: '2025-08-01' });
        // Room 102 - Active (Siti)
        roomsToInsert.push({ propertyId: prop1.id, name: '102', price: '2500000', tenantId: tenantsResult[1]?.id, status: 'occupied' as any, moveInDate: '2025-09-01' });
        // Room 103 - Active (Andi)
        roomsToInsert.push({ propertyId: prop1.id, name: '103', price: '2600000', tenantId: tenantsResult[2]?.id, status: 'occupied' as any, moveInDate: '2025-10-15' });
        // Room 104 - Available (Previously Joko)
        roomsToInsert.push({ propertyId: prop1.id, name: '104', price: '2500000', tenantId: null, status: 'available' as any });
        // Room 105 - Active (Eko)
        roomsToInsert.push({ propertyId: prop1.id, name: '105', price: '2800000', tenantId: tenantsResult[7]?.id, status: 'occupied' as any, moveInDate: '2026-01-01' });

        // Prop 2 Rooms (Budget) - 1.2jt
        // Assign tenants 3, 4 (Active)
        // Room 201 - Active (Dewi)
        roomsToInsert.push({ propertyId: prop2.id, name: '201', price: '1200000', tenantId: tenantsResult[3]?.id, status: 'occupied' as any, moveInDate: '2025-06-01' });
        // Room 202 - Active (Rina)
        roomsToInsert.push({ propertyId: prop2.id, name: '202', price: '1200000', tenantId: tenantsResult[4]?.id, status: 'occupied' as any, moveInDate: '2025-07-01' });
        // Room 203 - Available
        roomsToInsert.push({ propertyId: prop2.id, name: '203', price: '1100000', tenantId: null, status: 'available' as any });

        let roomsResult: any[] = [];
        try {
            roomsResult = await db.insert(rooms).values(roomsToInsert).returning();
        } catch (e) {
            console.error('Error seeding rooms:' + JSON.stringify(e));
            throw e;
        }

        // --- SEED BILLS (History) ---
        console.log('Seeding Bills History (6 Months)...');

        const months = [
            { period: '2025-08', start: '2025-08-01', end: '2025-08-31' },
            { period: '2025-09', start: '2025-09-01', end: '2025-09-30' },
            { period: '2025-10', start: '2025-10-01', end: '2025-10-31' },
            { period: '2025-11', start: '2025-11-01', end: '2025-11-30' },
            { period: '2025-12', start: '2025-12-01', end: '2025-12-31' },
            { period: '2026-01', start: '2026-01-01', end: '2026-01-31' }
        ];

        const rentBillsData: any[] = [];
        const utilityBillsData: any[] = [];
        const paymentMethods = ['cash', 'transfer', 'credit_card', 'e_wallet'];

        // Debug lengths
        console.log(`Seeded ${tenantsResult.length} tenants and ${roomsResult.length} rooms.`);

        for (const month of months) {
            // For each Active Tenant, check if they were active in this month
            // Budi (Aug), Siti (Sep), Andi (Oct), Dewi (Jun), Rina (Jul), Eko (Jan 26)

            if (roomsResult.length < 8 || tenantsResult.length < 8) {
                console.error("Not enough rooms/tenants seeded to proceed with bills generation.");
                break;
            }

            // Map Active Tenants to their current rooms (simplification: assume they stayed in same room)
            // Need to match tenant to room from roomsResult
            const activeMap = [
                { t: tenantsResult[0], r: roomsResult[0], start: '2025-08-01', end: undefined }, // Budi -> 101
                { t: tenantsResult[1], r: roomsResult[1], start: '2025-09-01', end: undefined }, // Siti -> 102
                { t: tenantsResult[2], r: roomsResult[2], start: '2025-10-15', end: undefined }, // Andi -> 103
                { t: tenantsResult[3], r: roomsResult[5], start: '2025-06-01', end: undefined }, // Dewi -> 201
                { t: tenantsResult[4], r: roomsResult[6], start: '2025-07-01', end: undefined }, // Rina -> 202
                { t: tenantsResult[7], r: roomsResult[4], start: '2026-01-01', end: undefined }, // Eko -> 105
            ];

            // Add Inactive tenants history (Joko, Maya)
            // Joko was in 104 (Aug-Oct), Maya in 203 (Aug-Nov) - Hypothetical
            const inactiveMap = [
                { t: tenantsResult[5], r: roomsResult[3], start: '2025-01-01', end: '2025-10-31' }, // Joko
                { t: tenantsResult[6], r: roomsResult[7], start: '2025-01-01', end: '2025-11-30' }  // Maya
            ];

            const allMappings = [...activeMap, ...inactiveMap];

            for (const map of allMappings) {
                // Safety check
                if (!map.t || !map.r) {
                    console.warn(`Skipping mapping due to missing tenant/room. Tenant: ${map.t?.id}, Room: ${map.r?.id}`);
                    continue;
                }
                const mapStart = new Date(map.start);
                const mapEnd = map.end ? new Date(map.end) : new Date('2099-12-31');
                const monthEnd = new Date(month.end);

                // If tenancy covers this month
                if (mapStart <= monthEnd && mapEnd >= new Date(month.start)) {
                    // Generate Rent Bill
                    const isPaid = Math.random() > 0.1; // 90% paid
                    const paidDate = isPaid ? new Date(month.start) : null;
                    if (paidDate) paidDate.setDate(paidDate.getDate() + 5); // Paid 1-5 days after

                    const paymentMethod = isPaid ? paymentMethods[Math.floor(Math.random() * paymentMethods.length)] : null; // Should be null if not paid? Schema allows null.

                    rentBillsData.push({
                        roomId: map.r.id,
                        tenantId: map.t.id,
                        periodStartDate: month.start,
                        periodEndDate: month.end,
                        dueDate: month.start, // Due on 1st
                        period: month.period,
                        roomPrice: map.r.price,
                        totalAmount: map.r.price,
                        isPaid: isPaid,
                        paidAt: isPaid ? paidDate : null, // Pass Date object
                        paymentMethod: paymentMethod as any, // Schema change added this
                        generatedAt: new Date(month.start) // Pass Date object
                    });

                    // Generate Utility Bill (Random usage)
                    const meterStart = Math.floor(Math.random() * 1000);
                    const usage = 50 + Math.floor(Math.random() * 150); // 50-200 kWh
                    const meterEnd = meterStart + usage;
                    const costPerKwh = 1500;
                    const usageCost = usage * costPerKwh;
                    const totalUtil = usageCost + 15000 + 20000; // + Water 15k, Trash 20k

                    // Create Date for 'generatedAt' usually end of month
                    const genDate = new Date(month.end);
                    const isUtilPaid = Math.random() > 0.1;
                    const utilPaidDate = isUtilPaid ? new Date(month.end) : null;
                    if (utilPaidDate) utilPaidDate.setDate(utilPaidDate.getDate() + 2);

                    utilityBillsData.push({
                        roomId: map.r.id,
                        tenantId: map.t.id,
                        period: month.period,
                        meterStart: meterStart,
                        meterEnd: meterEnd,
                        costPerKwh: String(costPerKwh),
                        usageCost: String(usageCost),
                        waterFee: '15000',
                        trashFee: '20000',
                        totalAmount: String(totalUtil),
                        isPaid: isUtilPaid,
                        paidAt: isUtilPaid ? utilPaidDate : null, // Pass Date object
                        paymentMethod: isUtilPaid ? paymentMethods[Math.floor(Math.random() * paymentMethods.length)] : null,
                        generatedAt: genDate // Pass Date object
                    });
                }
            }
        }

        console.log(`Prepared ${rentBillsData.length} rent bills and ${utilityBillsData.length} utility bills.`);

        // Batch insert bills 
        try {
            if (rentBillsData.length) {
                console.log('Sample rent bill:', JSON.stringify(rentBillsData[0]));
                await db.insert(rentBills).values(rentBillsData);
            }
        } catch (e) {
            console.error('Error inserting rent bills:' + JSON.stringify(e));
            // console.log('Sample data:', JSON.stringify(rentBillsData[0])); // Optional debug
            throw e;
        }

        try {
            if (utilityBillsData.length) await db.insert(utilityBills).values(utilityBillsData);
        } catch (e) {
            console.error('Error inserting utility bills:' + JSON.stringify(e));
            throw e;
        }

        // --- SEED EXPENSES ---
        console.log('Seeding Expenses...');
        const expensesData: any[] = [];

        for (const month of months) {
            // 3-5 expenses per month per property
            const props = [prop1, prop2];
            for (const prop of props) {
                const count = 3 + Math.floor(Math.random() * 3);
                for (let i = 0; i < count; i++) {
                    const cat = categoriesData[Math.floor(Math.random() * categoriesData.length)];
                    const amount = 50000 + Math.floor(Math.random() * 1000000); // 50k - 1jt
                    const expDate = new Date(month.start);
                    expDate.setDate(Math.floor(Math.random() * 28) + 1);

                    expensesData.push({
                        propertyId: prop.id,
                        userId: userId,
                        // Fix: expense schema uses 'category' (string) not 'categoryId'
                        category: cat.name,
                        description: `${cat.name} Expense - ${month.period}`,
                        amount: String(amount),
                        expenseDate: expDate.toISOString().split('T')[0], // YYYY-MM-DD
                        paidDate: expDate.toISOString().split('T')[0], // Cash basis
                        isPaid: true,
                        paymentMethod: 'cash',
                        type: 'property'
                    });
                }
            }
        }

        if (expensesData.length) await db.insert(expenses).values(expensesData);

        console.log('Seeding Complete! 🚀');

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await pool.end();
    }
}

main();
