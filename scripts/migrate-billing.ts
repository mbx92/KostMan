/**
 * Migration Script: Old Billing System to New Consolidated Billing System
 * 
 * This script migrates data from the old billing tables (rent_bills, utility_bills)
 * to the new consolidated billing system (billings, billing_details, payments).
 * 
 * WARNING: This is a one-way migration. Make sure to backup your database before running.
 */

import { db } from '../database';
import {
    rentBills,
    utilityBills,
    billings,
    billingDetails,
    payments
} from '../database/schema';
import { eq, and } from 'drizzle-orm';

interface MigrationStats {
    rentBillsMigrated: number;
    utilityBillsMigrated: number;
    consolidatedBillsCreated: number;
    errors: string[];
}

/**
 * Migrate old rent bills to new billing system
 */
async function migrateRentBills(): Promise<MigrationStats> {
    const stats: MigrationStats = {
        rentBillsMigrated: 0,
        utilityBillsMigrated: 0,
        consolidatedBillsCreated: 0,
        errors: [],
    };

    try {
        // Fetch all rent bills
        const oldRentBills = await db.select().from(rentBills);

        console.log(`Found ${oldRentBills.length} rent bills to migrate`);

        for (const rentBill of oldRentBills) {
            try {
                // Convert period (YYYY-MM) to date range (YYYY-MM-DD)
                const [year, month] = rentBill.period.split('-');
                const periodStart = `${year}-${month}-01`;

                // Calculate period end
                let periodEnd: string;
                if (rentBill.periodEnd) {
                    const [endYear, endMonth] = rentBill.periodEnd.split('-');
                    const lastDay = new Date(parseInt(endYear), parseInt(endMonth), 0).getDate();
                    periodEnd = `${endYear}-${endMonth}-${String(lastDay).padStart(2, '0')}`;
                } else {
                    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                    periodEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
                }

                // Generate billing code
                const billingCode = `MIGR-RENT-${rentBill.id.substring(0, 8)}`;

                // Determine bill status
                const billStatus = rentBill.isPaid ? 'paid' : 'unpaid';

                // Create consolidated bill
                const [newBill] = await db
                    .insert(billings)
                    .values({
                        roomId: rentBill.roomId,
                        tenantId: rentBill.tenantId || rentBill.roomId, // Fallback if no tenant
                        billingCode,
                        billStatus,
                        periodStart,
                        periodEnd,
                        monthsCovered: (rentBill.monthsCovered || 1).toString(),
                        notes: 'Migrated from old rent_bills table',
                        totalChargedAmount: rentBill.totalAmount,
                        generatedBy: null,
                        createdAt: rentBill.generatedAt,
                    })
                    .returning();

                // Create billing detail for rent
                await db.insert(billingDetails).values({
                    billId: newBill.id,
                    itemType: 'rent',
                    itemName: `Sewa Kamar (${rentBill.monthsCovered || 1} bulan)`,
                    itemQty: (rentBill.monthsCovered || 1).toString(),
                    itemUnitPrice: rentBill.roomPrice,
                    itemSubAmount: rentBill.totalAmount,
                    itemDiscount: '0',
                    itemTotalAmount: rentBill.totalAmount,
                    notes: 'Migrated from rent_bills',
                });

                // Create payment record if paid
                if (rentBill.isPaid && rentBill.paidAt) {
                    const paidDate = new Date(rentBill.paidAt);
                    const paymentDate = paidDate.toISOString().split('T')[0];

                    await db.insert(payments).values({
                        billId: newBill.id,
                        paymentMethod: 'cash', // Default to cash for migrated data
                        paymentAmount: rentBill.totalAmount,
                        paymentDate,
                        notes: 'Migrated payment from rent_bills',
                        createdAt: rentBill.paidAt,
                    });
                }

                stats.rentBillsMigrated++;
                stats.consolidatedBillsCreated++;

            } catch (error: any) {
                stats.errors.push(`Error migrating rent bill ${rentBill.id}: ${error.message}`);
                console.error(`Error migrating rent bill ${rentBill.id}:`, error);
            }
        }

    } catch (error: any) {
        stats.errors.push(`Fatal error in rent bills migration: ${error.message}`);
        console.error('Fatal error in rent bills migration:', error);
    }

    return stats;
}

/**
 * Migrate old utility bills to new billing system
 * Note: Utility bills will be migrated as separate bills since they don't have
 * a direct correlation with rent bills in the old system
 */
async function migrateUtilityBills(): Promise<MigrationStats> {
    const stats: MigrationStats = {
        rentBillsMigrated: 0,
        utilityBillsMigrated: 0,
        consolidatedBillsCreated: 0,
        errors: [],
    };

    try {
        // Fetch all utility bills
        const oldUtilityBills = await db.select().from(utilityBills);

        console.log(`Found ${oldUtilityBills.length} utility bills to migrate`);

        for (const utilityBill of oldUtilityBills) {
            try {
                // Convert period (YYYY-MM) to date range (YYYY-MM-DD)
                const [year, month] = utilityBill.period.split('-');
                const periodStart = `${year}-${month}-01`;
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                const periodEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

                // Generate billing code
                const billingCode = `MIGR-UTIL-${utilityBill.id.substring(0, 8)}`;

                // Determine bill status
                const billStatus = utilityBill.isPaid ? 'paid' : 'unpaid';

                // Create consolidated bill
                const [newBill] = await db
                    .insert(billings)
                    .values({
                        roomId: utilityBill.roomId,
                        tenantId: utilityBill.tenantId || utilityBill.roomId,
                        billingCode,
                        billStatus,
                        periodStart,
                        periodEnd,
                        monthsCovered: '1.00',
                        notes: 'Migrated from old utility_bills table',
                        totalChargedAmount: utilityBill.totalAmount,
                        generatedBy: null,
                        createdAt: utilityBill.generatedAt,
                    })
                    .returning();

                // Create billing detail for electricity
                const consumption = utilityBill.meterEnd - utilityBill.meterStart;
                await db.insert(billingDetails).values({
                    billId: newBill.id,
                    itemType: 'utility',
                    itemName: `Listrik (${consumption} kWh)`,
                    itemQty: consumption.toString(),
                    itemUnitPrice: utilityBill.costPerKwh,
                    itemSubAmount: utilityBill.usageCost,
                    itemDiscount: '0',
                    itemTotalAmount: utilityBill.usageCost,
                    notes: `Meter: ${utilityBill.meterStart} - ${utilityBill.meterEnd}`,
                });

                // Create billing detail for water fee
                if (parseFloat(utilityBill.waterFee) > 0) {
                    await db.insert(billingDetails).values({
                        billId: newBill.id,
                        itemType: 'utility',
                        itemName: 'Biaya Air',
                        itemQty: '1',
                        itemUnitPrice: utilityBill.waterFee,
                        itemSubAmount: utilityBill.waterFee,
                        itemDiscount: '0',
                        itemTotalAmount: utilityBill.waterFee,
                    });
                }

                // Create billing detail for trash fee
                if (parseFloat(utilityBill.trashFee) > 0) {
                    await db.insert(billingDetails).values({
                        billId: newBill.id,
                        itemType: 'utility',
                        itemName: 'Biaya Sampah',
                        itemQty: '1',
                        itemUnitPrice: utilityBill.trashFee,
                        itemSubAmount: utilityBill.trashFee,
                        itemDiscount: '0',
                        itemTotalAmount: utilityBill.trashFee,
                    });
                }

                // Create billing detail for additional cost
                if (parseFloat(utilityBill.additionalCost || '0') > 0) {
                    await db.insert(billingDetails).values({
                        billId: newBill.id,
                        itemType: 'others',
                        itemName: 'Biaya Tambahan',
                        itemQty: '1',
                        itemUnitPrice: utilityBill.additionalCost!,
                        itemSubAmount: utilityBill.additionalCost!,
                        itemDiscount: '0',
                        itemTotalAmount: utilityBill.additionalCost!,
                    });
                }

                // Create payment record if paid
                if (utilityBill.isPaid && utilityBill.paidAt) {
                    const paidDate = new Date(utilityBill.paidAt);
                    const paymentDate = paidDate.toISOString().split('T')[0];

                    await db.insert(payments).values({
                        billId: newBill.id,
                        paymentMethod: 'cash',
                        paymentAmount: utilityBill.totalAmount,
                        paymentDate,
                        notes: 'Migrated payment from utility_bills',
                        createdAt: utilityBill.paidAt,
                    });
                }

                stats.utilityBillsMigrated++;
                stats.consolidatedBillsCreated++;

            } catch (error: any) {
                stats.errors.push(`Error migrating utility bill ${utilityBill.id}: ${error.message}`);
                console.error(`Error migrating utility bill ${utilityBill.id}:`, error);
            }
        }

    } catch (error: any) {
        stats.errors.push(`Fatal error in utility bills migration: ${error.message}`);
        console.error('Fatal error in utility bills migration:', error);
    }

    return stats;
}

/**
 * Main migration function
 */
export async function runBillingMigration() {
    console.log('🚀 Starting billing system migration...\n');

    const startTime = Date.now();

    // Migrate rent bills
    console.log('📦 Migrating rent bills...');
    const rentStats = await migrateRentBills();
    console.log(`✅ Rent bills migration complete: ${rentStats.rentBillsMigrated} migrated\n`);

    // Migrate utility bills
    console.log('⚡ Migrating utility bills...');
    const utilityStats = await migrateUtilityBills();
    console.log(`✅ Utility bills migration complete: ${utilityStats.utilityBillsMigrated} migrated\n`);

    // Combine stats
    const totalStats: MigrationStats = {
        rentBillsMigrated: rentStats.rentBillsMigrated,
        utilityBillsMigrated: utilityStats.utilityBillsMigrated,
        consolidatedBillsCreated: rentStats.consolidatedBillsCreated + utilityStats.consolidatedBillsCreated,
        errors: [...rentStats.errors, ...utilityStats.errors],
    };

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Print summary
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Rent Bills Migrated: ${totalStats.rentBillsMigrated}`);
    console.log(`Utility Bills Migrated: ${totalStats.utilityBillsMigrated}`);
    console.log(`Total Consolidated Bills Created: ${totalStats.consolidatedBillsCreated}`);
    console.log(`Errors: ${totalStats.errors.length}`);
    console.log(`Duration: ${duration}s`);
    console.log('='.repeat(50));

    if (totalStats.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        totalStats.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }

    console.log('\n✅ Migration complete!');

    return totalStats;
}

// Run migration if this file is executed directly
if (require.main === module) {
    runBillingMigration()
        .then(() => {
            console.log('Migration finished successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}
