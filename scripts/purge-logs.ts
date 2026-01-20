/**
 * Purge Logs Script
 * 
 * CLI script for cron job to purge old logs.
 * 
 * Usage:
 *   npx tsx scripts/purge-logs.ts
 *   npx tsx scripts/purge-logs.ts --days=30
 * 
 * Cron example (run daily at 2am):
 *   0 2 * * * cd /path/to/KostMan && npx tsx scripts/purge-logs.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { systemLogs, systemSettings } from '../server/database/schema';
import { lt, eq } from 'drizzle-orm';

const DEFAULT_RETENTION_DAYS = 7;

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let overrideDays: number | undefined;
  
  for (const arg of args) {
    const match = arg.match(/^--days=(\d+)$/);
    if (match) {
      overrideDays = parseInt(match[1], 10);
    }
  }

  // Connect to database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  const db = drizzle(pool);
  
  try {
    // Get retention days from settings or use override/default
    let retentionDays = overrideDays;
    
    if (!retentionDays) {
      const setting = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'log_retention_days'))
        .limit(1);
      
      if (setting.length > 0) {
        retentionDays = parseInt(setting[0].value, 10) || DEFAULT_RETENTION_DAYS;
      } else {
        retentionDays = DEFAULT_RETENTION_DAYS;
      }
    }
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    console.log(`[purge-logs] Purging logs older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);
    
    // Delete old logs
    const result = await db
      .delete(systemLogs)
      .where(lt(systemLogs.createdAt, cutoffDate))
      .returning({ id: systemLogs.id });
    
    const count = result.length;
    console.log(`[purge-logs] Deleted ${count} log entries`);
    
    process.exit(0);
  } catch (error) {
    console.error('[purge-logs] Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
