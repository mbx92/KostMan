/**
 * Get Log Settings API
 * 
 * Returns current log retention settings.
 * Admin only.
 */

import { defineEventHandler } from 'h3';
import { requireRole, Role } from '../../utils/permissions';
import { logger } from '../../utils/logger';

export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN]);
  
  const retentionDays = await logger.getRetentionDays();
  
  return {
    retentionDays,
  };
});
