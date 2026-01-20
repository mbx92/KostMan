/**
 * Custom Error Types for KostMan
 * 
 * Provides consistent error classes for common HTTP error scenarios.
 * These errors are automatically handled by the error middleware.
 */

import { H3Error, createError } from 'h3';

/**
 * Base application error with additional context
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly statusMessage: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.statusMessage = message;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to H3 error for proper HTTP response
   */
  toH3Error(): H3Error {
    return createError({
      statusCode: this.statusCode,
      statusMessage: this.statusMessage,
      data: this.context,
    });
  }
}

/**
 * 400 Bad Request - Invalid input or validation failed
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation Error', context?: Record<string, unknown>) {
    super(400, message, context);
  }
}

/**
 * 401 Unauthorized - User not authenticated
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Unauthorized', context?: Record<string, unknown>) {
    super(401, message, context);
  }
}

/**
 * 403 Forbidden - User lacks permission
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Forbidden', context?: Record<string, unknown>) {
    super(403, message, context);
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found', context?: Record<string, unknown>) {
    super(404, message, context);
  }
}

/**
 * 409 Conflict - Resource conflict (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', context?: Record<string, unknown>) {
    super(409, message, context);
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal Server Error', context?: Record<string, unknown>) {
    super(500, message, context);
  }
}

/**
 * Helper to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
