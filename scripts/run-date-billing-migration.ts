/**
 * Run custom migration: Add date-based billing columns
 * Usage: npx tsx scripts/run-date-billing-migration.ts
 */
import pg from 'pg';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const { Pool } = pg;

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🚀 Starting date-based billing migration...');

  try {
    const client = await pool.connect();

    try {
      // Read migration SQL
      const migrationPath = resolve(__dirname, '../server/database/migrations/0007_date_based_billing.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf-8');

      console.log('📄 Running migration SQL...');
      
      // Execute migration
      await client.query(migrationSQL);

      console.log('✅ Migration completed successfully!');

      // Verify the changes
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'rent_bills' 
        AND column_name IN ('period_start_date', 'period_end_date', 'due_date', 'billing_cycle_day')
        ORDER BY column_name
      `);

      console.log('\n📊 New columns verified:');
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });

      // Check existing data migration
      const dataCheck = await client.query(`
        SELECT COUNT(*) as total, 
               COUNT(period_start_date) as with_start_date
        FROM rent_bills
      `);

      console.log('\n📈 Data migration status:');
      console.log(`  - Total bills: ${dataCheck.rows[0].total}`);
      console.log(`  - Bills with start_date: ${dataCheck.rows[0].with_start_date}`);

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
