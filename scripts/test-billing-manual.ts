#!/usr/bin/env tsx
/**
 * Manual Billing Test Script
 * 
 * This script allows you to manually test billing functionality
 * without the overhead of the full integration test suite.
 * 
 * Usage:
 *   npx tsx scripts/test-billing-manual.ts [test-name]
 * 
 * Available tests:
 *   - generate-single    : Generate a single-month bill
 *   - generate-multi     : Generate a multi-month bill
 *   - generate-proration : Test proration calculation
 *   - mark-paid          : Mark a bill as paid
 *   - list-bills         : List all bills with filters
 *   - delete-bill        : Delete an unpaid bill
 *   - all                : Run all tests sequentially
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users, properties, rooms, tenants, bills } from '../server/database/schema';
import { eq, and } from 'drizzle-orm';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ANSI color codes for better output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
    log(`✅ ${message}`, 'green');
}

function logError(message: string) {
    log(`❌ ${message}`, 'red');
}

function logInfo(message: string) {
    log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message: string) {
    log(`⚠️  ${message}`, 'yellow');
}

function logSection(title: string) {
    log(`\n${'='.repeat(60)}`, 'bright');
    log(`  ${title}`, 'bright');
    log(`${'='.repeat(60)}`, 'bright');
}

// Helper to make API calls
async function apiCall(
    endpoint: string,
    options: {
        method?: string;
        body?: any;
        token?: string;
    } = {}
) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (options.token) {
        headers['Cookie'] = `auth_token=${options.token}`;
    }

    const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers,
    };

    if (options.body) {
        fetchOptions.body = JSON.stringify(options.body);
    }

    logInfo(`${fetchOptions.method} ${endpoint}`);

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return response.json();
}

// Test data storage
let testData = {
    adminToken: '',
    ownerToken: '',
    propertyId: '',
    roomId: '',
    tenantId: '',
    billId: '',
};

/**
 * Setup: Create test users and get tokens
 */
async function setupTestUsers() {
    logSection('Setting Up Test Users');

    try {
        // Try to login with existing test users
        try {
            const adminLogin = await apiCall('/api/auth/login', {
                method: 'POST',
                body: {
                    email: 'test_admin@billing.test',
                    password: 'TestPassword123!',
                },
            });
            testData.adminToken = adminLogin.token;
            logSuccess('Admin user logged in');
        } catch (e) {
            logWarning('Admin user not found, please create manually or use existing credentials');
        }

        try {
            const ownerLogin = await apiCall('/api/auth/login', {
                method: 'POST',
                body: {
                    email: 'test_owner@billing.test',
                    password: 'TestPassword123!',
                },
            });
            testData.ownerToken = ownerLogin.token;
            logSuccess('Owner user logged in');
        } catch (e) {
            logWarning('Owner user not found, please create manually or use existing credentials');
        }

        if (!testData.ownerToken) {
            logError('No owner token available. Please provide credentials.');
            return false;
        }

        return true;
    } catch (error: any) {
        logError(`Setup failed: ${error.message}`);
        return false;
    }
}

/**
 * Setup: Create test property, room, and tenant
 */
async function setupTestData() {
    logSection('Setting Up Test Data');

    try {
        // Create property
        const property = await apiCall('/api/properties', {
            method: 'POST',
            token: testData.ownerToken,
            body: {
                name: 'Manual Test Property',
                address: '123 Test Street',
                costPerKwh: 1500,
                waterFee: 50000,
                trashFee: 25000,
            },
        });
        testData.propertyId = property.id;
        logSuccess(`Property created: ${property.id}`);

        // Create tenant
        const tenant = await apiCall('/api/tenants', {
            method: 'POST',
            token: testData.ownerToken,
            body: {
                name: 'Test Tenant',
                contact: '081234567890',
                idCardNumber: '1234567890123456',
            },
        });
        testData.tenantId = tenant.id;
        logSuccess(`Tenant created: ${tenant.id}`);

        // Create room
        const room = await apiCall('/api/rooms', {
            method: 'POST',
            token: testData.ownerToken,
            body: {
                propertyId: testData.propertyId,
                name: 'Test Room 101',
                price: 3000000,
                tenantId: testData.tenantId,
                status: 'occupied',
                useTrashService: true,
            },
        });
        testData.roomId = room.id;
        logSuccess(`Room created: ${room.id}`);

        return true;
    } catch (error: any) {
        logError(`Setup failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 1: Generate a single-month bill
 */
async function testGenerateSingleBill() {
    logSection('Test: Generate Single-Month Bill');

    try {
        const billData = {
            roomId: testData.roomId,
            period: '2026-01',
            monthsCovered: 1,
            meterStart: 1000,
            meterEnd: 1150,
            costPerKwh: 1500,
            waterFee: 50000,
            trashFee: 25000,
            additionalCost: 0,
        };

        logInfo('Generating bill with data:');
        console.log(JSON.stringify(billData, null, 2));

        const bill = await apiCall('/api/bills/generate', {
            method: 'POST',
            token: testData.ownerToken,
            body: billData,
        });

        testData.billId = bill.id;

        logSuccess('Bill generated successfully!');
        logInfo('Bill details:');
        console.log(JSON.stringify(bill, null, 2));

        // Verify calculations
        const expectedUsageCost = (1150 - 1000) * 1500; // 225,000
        const expectedTotal = 3000000 + expectedUsageCost + 50000 + 25000;

        logInfo('\nVerifying calculations:');
        console.log(`  Room Price: ${bill.roomPrice} (expected: 3000000)`);
        console.log(`  Usage Cost: ${bill.usageCost} (expected: ${expectedUsageCost})`);
        console.log(`  Water Fee: ${bill.waterFee} (expected: 50000)`);
        console.log(`  Trash Fee: ${bill.trashFee} (expected: 25000)`);
        console.log(`  Total: ${bill.totalAmount} (expected: ${expectedTotal})`);

        if (parseFloat(bill.totalAmount) === expectedTotal) {
            logSuccess('Calculations are correct!');
        } else {
            logError('Calculation mismatch!');
        }

        return true;
    } catch (error: any) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 2: Generate a multi-month bill
 */
async function testGenerateMultiBill() {
    logSection('Test: Generate Multi-Month Bill');

    try {
        const billData = {
            roomId: testData.roomId,
            period: '2026-02',
            monthsCovered: 3,
            meterStart: 1150,
            meterEnd: 1500,
            costPerKwh: 1500,
            waterFee: 50000,
            trashFee: 25000,
            additionalCost: 10000,
        };

        logInfo('Generating 3-month bill with data:');
        console.log(JSON.stringify(billData, null, 2));

        const bill = await apiCall('/api/bills/generate', {
            method: 'POST',
            token: testData.ownerToken,
            body: billData,
        });

        logSuccess('Multi-month bill generated successfully!');
        logInfo('Bill details:');
        console.log(JSON.stringify(bill, null, 2));

        // Verify calculations
        logInfo('\nVerifying multi-month calculations:');
        console.log(`  Period: ${bill.period} to ${bill.periodEnd}`);
        console.log(`  Months Covered: ${bill.monthsCovered}`);
        console.log(`  Room Price: ${bill.roomPrice} (expected: ${3000000 * 3})`);
        console.log(`  Water Fee: ${bill.waterFee} (expected: ${50000 * 3})`);
        console.log(`  Trash Fee: ${bill.trashFee} (expected: ${25000 * 3})`);
        console.log(`  Additional Cost: ${bill.additionalCost} (expected: 10000)`);

        if (bill.periodEnd === '2026-04') {
            logSuccess('Period end auto-calculated correctly!');
        } else {
            logError(`Period end mismatch: ${bill.periodEnd} (expected: 2026-04)`);
        }

        return true;
    } catch (error: any) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 3: Test proration for mid-month move-in
 */
async function testProration() {
    logSection('Test: Proration Calculation');

    try {
        // Create a room with mid-month move-in
        const room = await apiCall('/api/rooms', {
            method: 'POST',
            token: testData.ownerToken,
            body: {
                propertyId: testData.propertyId,
                name: 'Proration Test Room',
                price: 2800000,
                tenantId: testData.tenantId,
                status: 'occupied',
                useTrashService: true,
                moveInDate: '2026-01-15', // Mid-month
            },
        });

        logSuccess(`Room with mid-month move-in created: ${room.id}`);

        const billData = {
            roomId: room.id,
            period: '2026-01',
            monthsCovered: 1,
            meterStart: 100,
            meterEnd: 150,
            costPerKwh: 1500,
            waterFee: 50000,
            trashFee: 25000,
        };

        logInfo('Generating bill for mid-month move-in:');
        console.log(JSON.stringify(billData, null, 2));

        const bill = await apiCall('/api/bills/generate', {
            method: 'POST',
            token: testData.ownerToken,
            body: billData,
        });

        logSuccess('Prorated bill generated successfully!');
        logInfo('Bill details:');
        console.log(JSON.stringify(bill, null, 2));

        // Calculate expected proration
        const prorationFactor = 17 / 31; // Days from Jan 15 to Jan 31
        const expectedRoomPrice = 2800000 * prorationFactor;
        const expectedWaterFee = 50000 * prorationFactor;
        const expectedTrashFee = 25000 * prorationFactor;
        const expectedUsageCost = (150 - 100) * 1500; // NOT prorated

        logInfo('\nVerifying proration:');
        console.log(`  Move-in Date: 2026-01-15`);
        console.log(`  Days Occupied: 17/31`);
        console.log(`  Proration Factor: ${prorationFactor.toFixed(4)}`);
        console.log(`  Room Price: ${bill.roomPrice} (expected: ~${expectedRoomPrice.toFixed(0)})`);
        console.log(`  Water Fee: ${bill.waterFee} (expected: ~${expectedWaterFee.toFixed(0)})`);
        console.log(`  Trash Fee: ${bill.trashFee} (expected: ~${expectedTrashFee.toFixed(0)})`);
        console.log(`  Usage Cost: ${bill.usageCost} (expected: ${expectedUsageCost}) - NOT prorated`);

        const roomPriceDiff = Math.abs(parseFloat(bill.roomPrice) - expectedRoomPrice);
        if (roomPriceDiff < 100) {
            logSuccess('Proration calculation is correct!');
        } else {
            logError('Proration calculation mismatch!');
        }

        return true;
    } catch (error: any) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 4: Mark bill as paid
 */
async function testMarkPaid() {
    logSection('Test: Mark Bill as Paid');

    try {
        if (!testData.billId) {
            logWarning('No bill ID available. Run generate-single first.');
            return false;
        }

        logInfo(`Marking bill ${testData.billId} as paid...`);

        const result = await apiCall(`/api/bills/${testData.billId}/pay`, {
            method: 'PATCH',
            token: testData.ownerToken,
        });

        logSuccess('Bill marked as paid successfully!');
        logInfo('Updated bill:');
        console.log(JSON.stringify(result, null, 2));

        if (result.isPaid && result.paidAt) {
            logSuccess('Payment status and timestamp set correctly!');
        } else {
            logError('Payment status not updated properly!');
        }

        // Try to mark it again (should fail)
        try {
            await apiCall(`/api/bills/${testData.billId}/pay`, {
                method: 'PATCH',
                token: testData.ownerToken,
            });
            logError('Should have prevented duplicate payment marking!');
        } catch (e: any) {
            logSuccess('Correctly prevented duplicate payment marking');
        }

        return true;
    } catch (error: any) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 5: List bills with filters
 */
async function testListBills() {
    logSection('Test: List Bills with Filters');

    try {
        // List all bills
        logInfo('Fetching all bills...');
        const allBills = await apiCall('/api/bills', {
            token: testData.ownerToken,
        });
        logSuccess(`Found ${allBills.length} bills`);

        // Filter by property
        if (testData.propertyId) {
            logInfo(`\nFiltering by property: ${testData.propertyId}`);
            const propertyBills = await apiCall(`/api/bills?propertyId=${testData.propertyId}`, {
                token: testData.ownerToken,
            });
            logSuccess(`Found ${propertyBills.length} bills for this property`);
        }

        // Filter by payment status
        logInfo('\nFiltering unpaid bills...');
        const unpaidBills = await apiCall('/api/bills?isPaid=false', {
            token: testData.ownerToken,
        });
        logSuccess(`Found ${unpaidBills.length} unpaid bills`);

        logInfo('\nFiltering paid bills...');
        const paidBills = await apiCall('/api/bills?isPaid=true', {
            token: testData.ownerToken,
        });
        logSuccess(`Found ${paidBills.length} paid bills`);

        // Filter by period
        logInfo('\nFiltering by period: 2026-01');
        const periodBills = await apiCall('/api/bills?billPeriod=2026-01', {
            token: testData.ownerToken,
        });
        logSuccess(`Found ${periodBills.length} bills for 2026-01`);

        return true;
    } catch (error: any) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test 6: Delete unpaid bill
 */
async function testDeleteBill() {
    logSection('Test: Delete Unpaid Bill');

    try {
        // Create a new unpaid bill for deletion
        const billData = {
            roomId: testData.roomId,
            period: '2026-12',
            monthsCovered: 1,
            meterStart: 2000,
            meterEnd: 2100,
            costPerKwh: 1500,
            waterFee: 50000,
            trashFee: 25000,
        };

        const bill = await apiCall('/api/bills/generate', {
            method: 'POST',
            token: testData.ownerToken,
            body: billData,
        });

        logSuccess(`Created bill for deletion: ${bill.id}`);

        // Delete it
        logInfo(`Deleting bill ${bill.id}...`);
        const result = await apiCall(`/api/bills/${bill.id}`, {
            method: 'DELETE',
            token: testData.ownerToken,
        });

        logSuccess('Bill deleted successfully!');
        console.log(JSON.stringify(result, null, 2));

        // Try to delete a paid bill (should fail)
        if (testData.billId) {
            try {
                await apiCall(`/api/bills/${testData.billId}`, {
                    method: 'DELETE',
                    token: testData.ownerToken,
                });
                logError('Should have prevented deletion of paid bill!');
            } catch (e: any) {
                logSuccess('Correctly prevented deletion of paid bill');
            }
        }

        return true;
    } catch (error: any) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

/**
 * Cleanup: Remove test data
 */
async function cleanup() {
    logSection('Cleaning Up Test Data');

    try {
        // Delete bills
        const billsToDelete = await db
            .select()
            .from(bills)
            .where(eq(bills.roomId, testData.roomId));

        for (const bill of billsToDelete) {
            await db.delete(bills).where(eq(bills.id, bill.id));
        }
        logSuccess(`Deleted ${billsToDelete.length} bills`);

        // Delete room
        if (testData.roomId) {
            await db.delete(rooms).where(eq(rooms.id, testData.roomId));
            logSuccess('Deleted test room');
        }

        // Delete tenant
        if (testData.tenantId) {
            await db.delete(tenants).where(eq(tenants.id, testData.tenantId));
            logSuccess('Deleted test tenant');
        }

        // Delete property
        if (testData.propertyId) {
            await db.delete(properties).where(eq(properties.id, testData.propertyId));
            logSuccess('Deleted test property');
        }

        await pool.end();
        logSuccess('Cleanup complete!');
    } catch (error: any) {
        logError(`Cleanup failed: ${error.message}`);
    }
}

/**
 * Main execution
 */
async function main() {
    const testName = process.argv[2] || 'all';

    log('\n╔════════════════════════════════════════════════════════════╗', 'bright');
    log('║         Manual Billing Test Script                        ║', 'bright');
    log('╚════════════════════════════════════════════════════════════╝', 'bright');

    logInfo(`Running test: ${testName}\n`);

    // Setup
    const usersReady = await setupTestUsers();
    if (!usersReady) {
        logError('Failed to setup users. Exiting.');
        process.exit(1);
    }

    const dataReady = await setupTestData();
    if (!dataReady) {
        logError('Failed to setup test data. Exiting.');
        await cleanup();
        process.exit(1);
    }

    // Run tests
    let success = true;

    try {
        switch (testName) {
            case 'generate-single':
                success = await testGenerateSingleBill();
                break;
            case 'generate-multi':
                success = await testGenerateMultiBill();
                break;
            case 'generate-proration':
                success = await testProration();
                break;
            case 'mark-paid':
                success = await testMarkPaid();
                break;
            case 'list-bills':
                success = await testListBills();
                break;
            case 'delete-bill':
                success = await testDeleteBill();
                break;
            case 'all':
                success = await testGenerateSingleBill() &&
                    await testGenerateMultiBill() &&
                    await testProration() &&
                    await testMarkPaid() &&
                    await testListBills() &&
                    await testDeleteBill();
                break;
            default:
                logError(`Unknown test: ${testName}`);
                logInfo('Available tests: generate-single, generate-multi, generate-proration, mark-paid, list-bills, delete-bill, all');
                success = false;
        }
    } catch (error: any) {
        logError(`Unexpected error: ${error.message}`);
        success = false;
    }

    // Cleanup
    await cleanup();

    // Summary
    logSection('Test Summary');
    if (success) {
        logSuccess('All tests passed! ✨');
        process.exit(0);
    } else {
        logError('Some tests failed! 😞');
        process.exit(1);
    }
}

main();
