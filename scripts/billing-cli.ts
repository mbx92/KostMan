#!/usr/bin/env tsx
/**
 * Interactive Billing Test CLI
 * 
 * An interactive command-line tool to test billing scenarios
 * 
 * Usage:
 *   npx tsx scripts/billing-cli.ts
 */

import 'dotenv/config';
import * as readline from 'readline';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let authToken = '';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function ask(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

async function api(endpoint: string, options: any = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers: any = { 'Content-Type': 'application/json' };

    if (authToken) {
        headers['Cookie'] = `auth_token=${authToken}`;
    }

    const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`${res.status}: ${error}`);
    }

    return res.json();
}

async function login() {
    console.log('\n=== Login ===');
    const email = await ask('Email: ');
    const password = await ask('Password: ');

    try {
        const { token } = await api('/api/auth/login', {
            method: 'POST',
            body: { email, password },
        });
        authToken = token;
        console.log('✓ Logged in successfully!\n');
    } catch (error: any) {
        console.log(`✗ Login failed: ${error.message}\n`);
    }
}

async function listRooms() {
    console.log('\n=== Available Rooms ===');
    try {
        const rooms = await api('/api/rooms', { token: authToken });

        if (rooms.length === 0) {
            console.log('No rooms found.\n');
            return;
        }

        rooms.forEach((room: any, index: number) => {
            console.log(`${index + 1}. ${room.name} (${room.id})`);
            console.log(`   Price: Rp ${parseInt(room.price).toLocaleString()}`);
            console.log(`   Status: ${room.status}`);
            console.log(`   Tenant: ${room.tenantId || 'None'}\n`);
        });
    } catch (error: any) {
        console.log(`✗ Error: ${error.message}\n`);
    }
}

async function generateBill() {
    console.log('\n=== Generate Bill ===');

    const roomId = await ask('Room ID: ');
    const period = await ask('Period (YYYY-MM): ');
    const monthsCovered = await ask('Months Covered (default: 1): ') || '1';
    const meterStart = await ask('Meter Start: ');
    const meterEnd = await ask('Meter End: ');
    const costPerKwh = await ask('Cost per kWh (default: 1500): ') || '1500';
    const waterFee = await ask('Water Fee (default: 50000): ') || '50000';
    const trashFee = await ask('Trash Fee (default: 25000): ') || '25000';
    const additionalCost = await ask('Additional Cost (default: 0): ') || '0';

    try {
        const bill = await api('/api/bills/generate', {
            method: 'POST',
            token: authToken,
            body: {
                roomId,
                period,
                monthsCovered: parseInt(monthsCovered),
                meterStart: parseInt(meterStart),
                meterEnd: parseInt(meterEnd),
                costPerKwh: parseInt(costPerKwh),
                waterFee: parseInt(waterFee),
                trashFee: parseInt(trashFee),
                additionalCost: parseInt(additionalCost),
            },
        });

        console.log('\n✓ Bill generated successfully!');
        console.log(`Bill ID: ${bill.id}`);
        console.log(`Period: ${bill.period}${bill.periodEnd ? ` to ${bill.periodEnd}` : ''}`);
        console.log(`Room Price: Rp ${parseInt(bill.roomPrice).toLocaleString()}`);
        console.log(`Usage Cost: Rp ${parseInt(bill.usageCost).toLocaleString()}`);
        console.log(`Water Fee: Rp ${parseInt(bill.waterFee).toLocaleString()}`);
        console.log(`Trash Fee: Rp ${parseInt(bill.trashFee).toLocaleString()}`);
        console.log(`Additional: Rp ${parseInt(bill.additionalCost).toLocaleString()}`);
        console.log(`Total: Rp ${parseInt(bill.totalAmount).toLocaleString()}`);
        console.log(`Paid: ${bill.isPaid ? 'Yes' : 'No'}\n`);
    } catch (error: any) {
        console.log(`✗ Error: ${error.message}\n`);
    }
}

async function listBills() {
    console.log('\n=== List Bills ===');

    const propertyId = await ask('Filter by Property ID (optional): ');
    const isPaid = await ask('Filter by Paid Status (true/false/leave empty): ');
    const billPeriod = await ask('Filter by Period (YYYY-MM, optional): ');

    let endpoint = '/api/bills?';
    if (propertyId) endpoint += `propertyId=${propertyId}&`;
    if (isPaid) endpoint += `isPaid=${isPaid}&`;
    if (billPeriod) endpoint += `billPeriod=${billPeriod}&`;

    try {
        const bills = await api(endpoint, { token: authToken });

        console.log(`\nFound ${bills.length} bills:\n`);

        bills.forEach((bill: any, index: number) => {
            console.log(`${index + 1}. Bill ${bill.id}`);
            console.log(`   Room: ${bill.roomId}`);
            console.log(`   Period: ${bill.period}${bill.periodEnd ? ` to ${bill.periodEnd}` : ''}`);
            console.log(`   Total: Rp ${parseInt(bill.totalAmount).toLocaleString()}`);
            console.log(`   Paid: ${bill.isPaid ? 'Yes' : 'No'}`);
            if (bill.isPaid && bill.paidAt) {
                console.log(`   Paid At: ${bill.paidAt}`);
            }
            console.log('');
        });
    } catch (error: any) {
        console.log(`✗ Error: ${error.message}\n`);
    }
}

async function markPaid() {
    console.log('\n=== Mark Bill as Paid ===');

    const billId = await ask('Bill ID: ');

    try {
        const bill = await api(`/api/bills/${billId}/pay`, {
            method: 'PATCH',
            token: authToken,
        });

        console.log('\n✓ Bill marked as paid!');
        console.log(`Paid At: ${bill.paidAt}\n`);
    } catch (error: any) {
        console.log(`✗ Error: ${error.message}\n`);
    }
}

async function deleteBill() {
    console.log('\n=== Delete Bill ===');

    const billId = await ask('Bill ID: ');
    const confirm = await ask('Are you sure? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
        console.log('Cancelled.\n');
        return;
    }

    try {
        await api(`/api/bills/${billId}`, {
            method: 'DELETE',
            token: authToken,
        });

        console.log('\n✓ Bill deleted successfully!\n');
    } catch (error: any) {
        console.log(`✗ Error: ${error.message}\n`);
    }
}

async function showMenu() {
    console.log('=== Billing Test CLI ===');
    console.log('1. Login');
    console.log('2. List Rooms');
    console.log('3. Generate Bill');
    console.log('4. List Bills');
    console.log('5. Mark Bill as Paid');
    console.log('6. Delete Bill');
    console.log('7. Exit');
    console.log('');

    const choice = await ask('Choose an option: ');

    switch (choice) {
        case '1':
            await login();
            break;
        case '2':
            await listRooms();
            break;
        case '3':
            await generateBill();
            break;
        case '4':
            await listBills();
            break;
        case '5':
            await markPaid();
            break;
        case '6':
            await deleteBill();
            break;
        case '7':
            console.log('Goodbye!\n');
            rl.close();
            process.exit(0);
        default:
            console.log('Invalid option.\n');
    }

    // Show menu again
    await showMenu();
}

async function main() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   Interactive Billing Test CLI         ║');
    console.log('╚════════════════════════════════════════╝\n');

    await showMenu();
}

main();
