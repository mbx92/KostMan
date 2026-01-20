/**
 * Get System Logs API
 * 
 * Returns logs with filtering, pagination, and search.
 * Admin only.
 */

import { defineEventHandler, getQuery } from 'h3';
import { requireRole, Role } from '../../utils/permissions';
import { db } from '../../utils/drizzle';
import { systemLogs, users } from '../../database/schema';
import { desc, eq, and, gte, lte, like, or, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  requireRole(event, [Role.ADMIN]);
  
  const query = getQuery(event);
  
  // Pagination
  const page = parseInt(query.page as string) || 1;
  const limit = Math.min(parseInt(query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;
  
  // Filters
  const level = query.level as string | undefined;
  const startDate = query.startDate as string | undefined;
  const endDate = query.endDate as string | undefined;
  const search = query.search as string | undefined;
  const method = query.method as string | undefined;
  
  // Build where conditions
  const conditions = [];
  
  if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
    conditions.push(eq(systemLogs.level, level as 'debug' | 'info' | 'warn' | 'error'));
  }
  
  if (startDate) {
    conditions.push(gte(systemLogs.createdAt, new Date(startDate)));
  }
  
  if (endDate) {
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);
    conditions.push(lte(systemLogs.createdAt, endDateTime));
  }
  
  if (search) {
    conditions.push(
      or(
        like(systemLogs.message, `%${search}%`),
        like(systemLogs.path, `%${search}%`)
      )
    );
  }
  
  if (method) {
    conditions.push(eq(systemLogs.method, method.toUpperCase()));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(systemLogs)
    .where(whereClause);
  
  const total = Number(countResult[0]?.count) || 0;
  
  // Get logs with user info
  const logs = await db
    .select({
      id: systemLogs.id,
      level: systemLogs.level,
      message: systemLogs.message,
      method: systemLogs.method,
      path: systemLogs.path,
      statusCode: systemLogs.statusCode,
      duration: systemLogs.duration,
      userId: systemLogs.userId,
      ip: systemLogs.ip,
      userAgent: systemLogs.userAgent,
      context: systemLogs.context,
      createdAt: systemLogs.createdAt,
    })
    .from(systemLogs)
    .where(whereClause)
    .orderBy(desc(systemLogs.createdAt))
    .limit(limit)
    .offset(offset);
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
});
