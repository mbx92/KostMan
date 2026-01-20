/**
 * Error Handler Middleware for KostMan
 * 
 * This middleware:
 * - Logs all unhandled errors with context
 * - Formats error responses consistently
 * - Hides stack traces in production
 */

import { H3Event, H3Error, getRequestURL, getMethod, defineEventHandler } from 'h3';
import { logger } from '../utils/logger';
import { isAppError } from '../utils/errors';

export default defineEventHandler((event) => {
  // Add error handler that runs after the main handler
  event.node.res.on('finish', () => {
    const statusCode = event.node.res.statusCode;
    
    // Log request info for non-2xx responses
    if (statusCode >= 400) {
      const method = getMethod(event);
      const url = getRequestURL(event);
      
      const logContext = {
        method,
        path: url.pathname,
        statusCode,
        userAgent: event.node.req.headers['user-agent'],
        ip: event.node.req.headers['x-forwarded-for'] || event.node.req.socket.remoteAddress,
      };
      
      if (statusCode >= 500) {
        logger.error(`Server Error: ${method} ${url.pathname}`, logContext);
      } else if (statusCode >= 400) {
        logger.warn(`Client Error: ${method} ${url.pathname}`, logContext);
      }
    }
  });
});

/**
 * Nitro error handler hook
 * Configure in nuxt.config.ts: nitro.errorHandler
 */
export function handleError(error: H3Error, event: H3Event) {
  const isProduction = process.env.NODE_ENV === 'production';
  const method = getMethod(event);
  const url = getRequestURL(event);
  
  // Convert AppError to H3Error if needed
  if (isAppError(error)) {
    error = error.toH3Error();
  }
  
  // Log the error
  logger.exception(`Unhandled Error: ${method} ${url.pathname}`, error, {
    method,
    path: url.pathname,
    statusCode: error.statusCode || 500,
    userId: event.context.user?.id,
  });
  
  // Return formatted error response
  const response: Record<string, unknown> = {
    statusCode: error.statusCode || 500,
    statusMessage: error.statusMessage || 'Internal Server Error',
    message: error.message,
  };
  
  if (error.data) {
    response.data = error.data;
  }
  
  if (!isProduction && error.stack) {
    response.stack = error.stack;
  }
  
  const statusCode = response.statusCode as number;
  event.node.res.statusCode = statusCode;
  event.node.res.setHeader('Content-Type', 'application/json');
  event.node.res.end(JSON.stringify(response));
}
