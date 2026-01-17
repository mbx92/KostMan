#!/usr/bin/env tsx
/**
 * Quick Billing Test - Minimal overhead, fast execution
 * 
 * This script performs a quick smoke test of billing functionality
 * using your existing data in the database.
 * 
 * Usage:
 *   npx tsx scripts/quick-bill-test.ts
 */

import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Colors
const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
};

async function api(endpoint: string, options: any = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers: any = { 'Content-Type': 'application/json' };

    if (options.token) {
        headers['Cookie'] = `auth_token=${options.token}`;
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

async function main() {
    console.log(`${c.cyan}╔═══════════════════════════════════════╗${c.reset}`);
    console.log(`${c.cyan}║   Quick Billing Test                  ║${c.reset}`);
    console.log(`${c.cyan}╚═══════════════════════════════════════╝${c.reset}\n`);

    try {
        // 1. Login
        console.log(`${c.cyan}[1/6] Logging in...${c.reset}`);
        const email = process.env.TEST_EMAIL || 'test_owner@billing.test';
        const password = process.env.TEST_PASSWORD || 'TestPassword123!';

        const { token } = await api('/api/auth/login', {
            method: 'POST',
            body: { email, password },
        });
        console.log(`${c.green}✓ Logged in successfully${c.reset}\n`);

        // 2. Get existing rooms
        console.log(`${c.cyan}[2/6] Fetching rooms...${c.reset}`);
        const rooms = await api('/api/rooms', { token });

        if (rooms.length === 0) {
            throw new Error('No rooms found. Please create a room first.');
        }

        const room = rooms[0];
        console.log(`${c.green}✓ Using room: ${room.name} (${room.id})${c.reset}\n`);

        // 3. Generate a test bill
        console.log(`${c.cyan}[3/6] Generating test bill...${c.reset}`);
        const billData = {
            roomId: room.id,
            period: '2026-01',
            monthsCovered: 1,
            meterStart: 1000,
            meterEnd: 1150,
            costPerKwh: 1500,
            waterFee: 50000,
            trashFee: 25000,
            additionalCost: 0,
        };

        const bill = await api('/api/bills/generate', {
            method: 'POST',
            token,
            body: billData,
        });

        console.log(`${c.green}✓ Bill generated: ${bill.id}${c.reset}`);
        console.log(`  Room Price: Rp ${parseInt(bill.roomPrice).toLocaleString()}`);
        console.log(`  Usage Cost: Rp ${parseInt(bill.usageCost).toLocaleString()}`);
        console.log(`  Water Fee: Rp ${parseInt(bill.waterFee).toLocaleString()}`);
        console.log(`  Trash Fee: Rp ${parseInt(bill.trashFee).toLocaleString()}`);
        console.log(`  Total: Rp ${parseInt(bill.totalAmount).toLocaleString()}\n`);

        // 4. List bills
        console.log(`${c.cyan}[4/6] Listing bills...${c.reset}`);
        const allBills = await api('/api/bills', { token });
        console.log(`${c.green}✓ Found ${allBills.length} bills${c.reset}\n`);

        // 5. Mark as paid
        console.log(`${c.cyan}[5/6] Marking bill as paid...${c.reset}`);
        const paidBill = await api(`/api/bills/${bill.id}/pay`, {
            method: 'PATCH',
            token,
        });
        console.log(`${c.green}✓ Bill marked as paid at ${paidBill.paidAt}${c.reset}\n`);

        // 6. Verify filters work
        console.log(`${c.cyan}[6/6] Testing filters...${c.reset}`);
        const paidBills = await api('/api/bills?isPaid=true', { token });
        const unpaidBills = await api('/api/bills?isPaid=false', { token });
        console.log(`${c.green}✓ Paid bills: ${paidBills.length}${c.reset}`);
        console.log(`${c.green}✓ Unpaid bills: ${unpaidBills.length}${c.reset}\n`);

        // Summary
        console.log(`${c.green}╔═══════════════════════════════════════╗${c.reset}`);
        console.log(`${c.green}║   ✓ All tests passed!                 ║${c.reset}`);
        console.log(`${c.green}╚═══════════════════════════════════════╝${c.reset}\n`);

        console.log(`${c.yellow}Note: Bill ${bill.id} was created and marked as paid.${c.reset}`);
        console.log(`${c.yellow}You may want to delete it manually if needed.${c.reset}\n`);

    } catch (error: any) {
        console.log(`\n${c.red}✗ Test failed: ${error.message}${c.reset}\n`);
        process.exit(1);
    }
}

main();
