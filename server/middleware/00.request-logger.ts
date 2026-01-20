/**
 * Request Logger Middleware for KostMan
 * 
 * Logs all incoming API requests with timing information.
 * Saves to database for persistence and analysis.
 */

import { getRequestURL, getMethod, defineEventHandler } from 'h3';
import { logger } from '../utils/logger';

export default defineEventHandler((event) => {
  const startTime = Date.now();
  const method = getMethod(event);
  const url = getRequestURL(event);
  
  // Skip logging for static assets and internal routes
  if (url.pathname.startsWith('/_nuxt') || 
      url.pathname.startsWith('/__nuxt') ||
      url.pathname.startsWith('/api/logs') || // Don't log log requests to avoid noise
      url.pathname.includes('.')) {
    return;
  }
  
  // Log request start (debug level, console only)
  logger.debug(`→ ${method} ${url.pathname}`);
  
  // Log response when finished
  event.node.res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = event.node.res.statusCode;
    const userId = event.context.user?.id;
    const ip = (event.node.req.headers['x-forwarded-for'] as string) || 
               event.node.req.socket.remoteAddress || 
               'unknown';
    const userAgent = event.node.req.headers['user-agent'];
    
    // Determine log level based on status code
    const level = statusCode >= 500 ? 'error' : 
                  statusCode >= 400 ? 'warn' : 'info';
    
    const message = `${method} ${url.pathname} ${statusCode} (${duration}ms)`;
    
    // Log with full request data (saved to database)
    logger.request(level, message, {
      method,
      path: url.pathname,
      statusCode,
      duration,
      userId,
      ip: typeof ip === 'string' ? ip.split(',')[0].trim() : ip,
      userAgent,
    });
  });
});
