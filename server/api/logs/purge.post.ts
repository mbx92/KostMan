/**
 * Purge Logs API
 * 
 * Manually purge logs older than retention days.
 * Admin only.
 */

import { defineEventHandler, readBody } from 'h3';
import { requireRole, Role } from '../../utils/permissions';
import { logger } from '../../utils/logger';

export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN]);
  
  const body = await readBody(event);
  const retentionDays = body?.retentionDays;
  
  // Use provided days or get from settings
  const days = retentionDays || await logger.getRetentionDays();
  
  const purgedCount = await logger.purgeOldLogs(days);
  
  return {
    success: true,
    message: `Purged ${purgedCount} log entries older than ${days} days`,
    purgedCount,
    retentionDays: days,
  };
});
