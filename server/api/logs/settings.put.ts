/**
 * Update Log Settings API
 * 
 * Updates log retention settings.
 * Admin only.
 */

import { defineEventHandler, readBody, createError } from 'h3';
import { requireRole, Role } from '../../utils/permissions';
import { logger } from '../../utils/logger';

export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN]);
  
  const body = await readBody(event);
  const { retentionDays } = body;
  
  if (!retentionDays || retentionDays < 1 || retentionDays > 365) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Retention days must be between 1 and 365',
    });
  }
  
  await logger.setRetentionDays(retentionDays);
  
  return {
    success: true,
    message: `Log retention set to ${retentionDays} days`,
    retentionDays,
  };
});
