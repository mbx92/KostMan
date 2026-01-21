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
    console.log('Seeding Reports Data with 40+ entries...');

    try {
        // --- CLEANUP ---
        console.log('Cleaning existing data (preserving users)...');
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

        try {
            await db.insert(expenseCategories).values(
                categoriesData.map(c => ({
                    userId,
                    name: c.name,
                    description: `Expenses for ${c.name}`
                }))
            ).returning();
        } catch (e) {
            console.error('Error seeding categories:' + JSON.stringify(e));
            throw e;
        }

        // --- SEED PROPERTIES ---
        console.log('Seeding Properties (4 properties for more data)...');
        const propsData = [
            { name: 'Kost Mawar (Premium)', address: 'Jl. Mawar No. 1' },
            { name: 'Kost Melati (Budget)', address: 'Jl. Melati No. 5' },
            { name: 'Kost Anggrek (Mid-Range)', address: 'Jl. Anggrek No. 10' },
            { name: 'Kost Dahlia (Luxury)', address: 'Jl. Dahlia No. 15' }
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
        const prop3 = propertiesResult[2]; // Anggrek
        const prop4 = propertiesResult[3]; // Dahlia

        if (!prop1 || !prop2 || !prop3 || !prop4) {
            throw new Error("Failed to seed properties");
        }

        // --- SEED TENANTS (50 tenants for more data) ---
        console.log('Seeding Tenants (50 tenants)...');
        const tenantsData = [];
        const firstNames = ['Budi', 'Siti', 'Andi', 'Dewi', 'Rina', 'Joko', 'Maya', 'Eko', 'Putri', 'Agus',
            'Lina', 'Rudi', 'Sari', 'Doni', 'Fitri', 'Hadi', 'Indah', 'Jaya', 'Kartika', 'Lukman',
            'Mega', 'Nanda', 'Oki', 'Prita', 'Qori', 'Reza', 'Sinta', 'Tono', 'Umar', 'Vina',
            'Wati', 'Xena', 'Yudi', 'Zahra', 'Arif', 'Bella', 'Citra', 'Dimas', 'Elsa', 'Fajar',
            'Gita', 'Hendra', 'Ika', 'Johan', 'Kiki', 'Lani', 'Mira', 'Nina', 'Omar', 'Pandu'];
        const lastNames = ['Santoso', 'Wijaya', 'Lestari', 'Kurnia', 'Anwar', 'Putri', 'Prasetyo', 'Kusuma',
            'Hidayat', 'Sari', 'Rahman', 'Susanto', 'Wibowo', 'Setiawan', 'Nugroho'];

        for (let i = 0; i < 50; i++) {
            const firstName = firstNames[i % firstNames.length];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            tenantsData.push({
                name: `${firstName} ${lastName}`,
                contact: `08123456${String(7890 + i).padStart(4, '0')}`,
                status: i < 40 ? 'active' : 'inactive' // 40 active, 10 inactive
            });
        }

        let tenantsResult: any[] = [];
        try {
            tenantsResult = await db.insert(tenants).values(
                tenantsData.map((t, idx) => ({
                    name: t.name,
                    contact: t.contact,
                    idCardNumber: `${String(1234567890123450 + idx).slice(0, 16)}`,
                    status: t.status as any
                }))
            ).returning();
        } catch (e) {
            console.error('Error seeding tenants:' + JSON.stringify(e));
            throw e;
        }

        // --- SEED ROOMS (50 rooms across 4 properties) ---
        console.log('Seeding Rooms (50 rooms)...');
        const roomsToInsert = [];
        const prices = {
            premium: [2500000, 2600000, 2700000, 2800000, 2900000],
            budget: [1100000, 1200000, 1300000, 1400000],
            midRange: [1800000, 1900000, 2000000, 2100000],
            luxury: [3000000, 3200000, 3500000, 3800000, 4000000]
        };

        let roomIndex = 0;

        // Property 1 (Mawar - Premium): 15 rooms
        for (let i = 1; i <= 15; i++) {
            const price = prices.premium[i % prices.premium.length];
            const tenant = roomIndex < 40 ? tenantsResult[roomIndex] : null;
            roomsToInsert.push({
                propertyId: prop1.id,
                name: `${100 + i}`,
                price: String(price),
                tenantId: tenant?.id || null,
                status: tenant ? 'occupied' : 'available' as any,
                moveInDate: tenant ? '2025-12-01' : null
            });
            if (tenant) roomIndex++;
        }

        // Property 2 (Melati - Budget): 12 rooms
        for (let i = 1; i <= 12; i++) {
            const price = prices.budget[i % prices.budget.length];
            const tenant = roomIndex < 40 ? tenantsResult[roomIndex] : null;
            roomsToInsert.push({
                propertyId: prop2.id,
                name: `${200 + i}`,
                price: String(price),
                tenantId: tenant?.id || null,
                status: tenant ? 'occupied' : 'available' as any,
                moveInDate: tenant ? '2025-12-01' : null
            });
            if (tenant) roomIndex++;
        }

        // Property 3 (Anggrek - Mid-Range): 13 rooms
        for (let i = 1; i <= 13; i++) {
            const price = prices.midRange[i % prices.midRange.length];
            const tenant = roomIndex < 40 ? tenantsResult[roomIndex] : null;
            roomsToInsert.push({
                propertyId: prop3.id,
                name: `${300 + i}`,
                price: String(price),
                tenantId: tenant?.id || null,
                status: tenant ? 'occupied' : 'available' as any,
                moveInDate: tenant ? '2025-12-01' : null
            });
            if (tenant) roomIndex++;
        }

        // Property 4 (Dahlia - Luxury): 10 rooms
        for (let i = 1; i <= 10; i++) {
            const price = prices.luxury[i % prices.luxury.length];
            const tenant = roomIndex < 40 ? tenantsResult[roomIndex] : null;
            roomsToInsert.push({
                propertyId: prop4.id,
                name: `${400 + i}`,
                price: String(price),
                tenantId: tenant?.id || null,
                status: tenant ? 'occupied' : 'available' as any,
                moveInDate: tenant ? '2025-12-01' : null
            });
            if (tenant) roomIndex++;
        }

        let roomsResult: any[] = [];
        try {
            roomsResult = await db.insert(rooms).values(roomsToInsert).returning();
        } catch (e) {
            console.error('Error seeding rooms:' + JSON.stringify(e));
            throw e;
        }

        console.log(`Seeded ${roomsResult.length} rooms with ${roomIndex} occupied rooms`);

        // --- SEED BILLS (Last Month & This Month for trend analysis) ---
        console.log('Seeding Bills for Last Month and This Month...');

        const months = [
            { period: '2025-12', start: '2025-12-01', end: '2025-12-31' }, // Last month (20 data)
            { period: '2026-01', start: '2026-01-01', end: '2026-01-31' }  // This month (20 data)
        ];

        const rentBillsData: any[] = [];
        const utilityBillsData: any[] = [];
        const paymentMethods = ['cash', 'transfer', 'credit_card', 'e_wallet'];

        console.log(`Processing bills for ${roomsResult.length} rooms...`);

        for (const month of months) {
            // Generate bills for all occupied rooms
            for (let i = 0; i < roomsResult.length; i++) {
                const room = roomsResult[i];

                // Only generate bills for occupied rooms
                if (!room.tenantId) continue;

                // Generate Rent Bill
                const isPaid = Math.random() > 0.15; // 85% paid
                const paidDate = isPaid ? new Date(month.start) : null;
                if (paidDate) paidDate.setDate(paidDate.getDate() + Math.floor(Math.random() * 10) + 1);

                const paymentMethod = isPaid ? paymentMethods[Math.floor(Math.random() * paymentMethods.length)] : null;

                rentBillsData.push({
                    roomId: room.id,
                    tenantId: room.tenantId,
                    periodStartDate: month.start,
                    periodEndDate: month.end,
                    dueDate: month.start,
                    period: month.period,
                    roomPrice: room.price,
                    totalAmount: room.price,
                    isPaid: isPaid,
                    paidAt: isPaid ? paidDate : null,
                    paymentMethod: paymentMethod as any,
                    generatedAt: new Date(month.start)
                });

                // Generate Utility Bill with varying usage
                const baseUsage = 50 + Math.floor(Math.random() * 150); // 50-200 kWh
                // Add trend: this month usage slightly higher than last month
                const trendFactor = month.period === '2026-01' ? 1.1 : 1.0;
                const usage = Math.floor(baseUsage * trendFactor);

                const meterStart = 1000 + (i * 200) + (month.period === '2026-01' ? baseUsage : 0);
                const meterEnd = meterStart + usage;
                const costPerKwh = 1500;
                const usageCost = usage * costPerKwh;
                const totalUtil = usageCost + 15000 + 20000;

                const genDate = new Date(month.end);
                const isUtilPaid = Math.random() > 0.15;
                const utilPaidDate = isUtilPaid ? new Date(month.end) : null;
                if (utilPaidDate) utilPaidDate.setDate(utilPaidDate.getDate() + Math.floor(Math.random() * 5) + 1);

                utilityBillsData.push({
                    roomId: room.id,
                    tenantId: room.tenantId,
                    period: month.period,
                    meterStart: meterStart,
                    meterEnd: meterEnd,
                    costPerKwh: String(costPerKwh),
                    usageCost: String(usageCost),
                    waterFee: '15000',
                    trashFee: '20000',
                    totalAmount: String(totalUtil),
                    isPaid: isUtilPaid,
                    paidAt: isUtilPaid ? utilPaidDate : null,
                    paymentMethod: isUtilPaid ? paymentMethods[Math.floor(Math.random() * paymentMethods.length)] : null,
                    generatedAt: genDate
                });
            }
        }

        console.log(`Prepared ${rentBillsData.length} rent bills and ${utilityBillsData.length} utility bills.`);

        // Insert bills
        try {
            if (rentBillsData.length) {
                console.log('Inserting rent bills...');
                await db.insert(rentBills).values(rentBillsData);
            }
        } catch (e) {
            console.error('Error inserting rent bills:' + JSON.stringify(e));
            throw e;
        }

        try {
            if (utilityBillsData.length) {
                console.log('Inserting utility bills...');
                await db.insert(utilityBills).values(utilityBillsData);
            }
        } catch (e) {
            console.error('Error inserting utility bills:' + JSON.stringify(e));
            throw e;
        }

        // --- SEED EXPENSES (20 per month = 40 total) ---
        console.log('Seeding Expenses (40+ entries)...');
        const expensesData: any[] = [];

        for (const month of months) {
            const props = [prop1, prop2, prop3, prop4];

            // Generate 5 expenses per property per month = 20 expenses per month
            for (const prop of props) {
                for (let i = 0; i < 5; i++) {
                    const cat = categoriesData[Math.floor(Math.random() * categoriesData.length)];
                    const baseAmount = 100000 + Math.floor(Math.random() * 900000);
                    // Add trend: this month expenses slightly higher
                    const trendFactor = month.period === '2026-01' ? 1.15 : 1.0;
                    const amount = Math.floor(baseAmount * trendFactor);

                    const expDate = new Date(month.start);
                    expDate.setDate(Math.floor(Math.random() * 28) + 1);

                    expensesData.push({
                        propertyId: prop.id,
                        userId: userId,
                        category: cat.name,
                        description: `${cat.name} - ${prop.name.split(' ')[1]} - ${month.period}`,
                        amount: String(amount),
                        expenseDate: expDate.toISOString().split('T')[0],
                        paidDate: expDate.toISOString().split('T')[0],
                        isPaid: true,
                        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)] as any,
                        type: 'property'
                    });
                }
            }
        }

        if (expensesData.length) {
            console.log(`Inserting ${expensesData.length} expenses...`);
            await db.insert(expenses).values(expensesData);
        }

        console.log('\n=== SEEDING SUMMARY ===');
        console.log(`✓ Properties: ${propertiesResult.length}`);
        console.log(`✓ Tenants: ${tenantsResult.length} (${tenantsData.filter(t => t.status === 'active').length} active)`);
        console.log(`✓ Rooms: ${roomsResult.length} (${roomIndex} occupied)`);
        console.log(`✓ Rent Bills: ${rentBillsData.length} (across 2 months)`);
        console.log(`✓ Utility Bills: ${utilityBillsData.length} (across 2 months)`);
        console.log(`✓ Expenses: ${expensesData.length} (across 2 months)`);
        console.log('\nData Distribution:');
        console.log(`  - December 2025: ~${Math.floor(rentBillsData.length / 2)} rent bills, ~${Math.floor(utilityBillsData.length / 2)} utility bills, ${expensesData.length / 2} expenses`);
        console.log(`  - January 2026: ~${Math.floor(rentBillsData.length / 2)} rent bills, ~${Math.floor(utilityBillsData.length / 2)} utility bills, ${expensesData.length / 2} expenses`);
        console.log('\nSeeding Complete! 🚀\n');

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await pool.end();
    }
}

main();
