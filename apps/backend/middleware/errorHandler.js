const crypto = require('crypto');

// Error codes mapping for consistent responses
const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'AUTH_001',
  FORBIDDEN: 'AUTH_002',
  INVALID_TOKEN: 'AUTH_003',
  TOKEN_EXPIRED: 'AUTH_004',
  
  // Validation
  VALIDATION_ERROR: 'VAL_001',
  INVALID_INPUT: 'VAL_002',
  MISSING_REQUIRED_FIELD: 'VAL_003',
  
  // Database
  DATABASE_ERROR: 'DB_001',
  DUPLICATE_ENTRY: 'DB_002',
  RECORD_NOT_FOUND: 'DB_003',
  
  // Business Logic
  INSUFFICIENT_FUNDS: 'BIZ_001',
  LOAN_LIMIT_EXCEEDED: 'BIZ_002',
  INVALID_OPERATION: 'BIZ_003',
  
  // System
  INTERNAL_ERROR: 'SYS_001',
  SERVICE_UNAVAILABLE: 'SYS_002',
  RATE_LIMIT_EXCEEDED: 'SYS_003'
};

// Generic user-friendly messages
const USER_MESSAGES = {
  [ERROR_CODES.UNAUTHORIZED]: 'Authentication required. Please log in to continue.',
  [ERROR_CODES.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ERROR_CODES.INVALID_TOKEN]: 'Invalid authentication token. Please log in again.',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  
  [ERROR_CODES.VALIDATION_ERROR]: 'The provided information is invalid. Please check your input.',
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input provided. Please verify your data.',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Required information is missing. Please complete all fields.',
  
  [ERROR_CODES.DATABASE_ERROR]: 'A temporary system error occurred. Please try again later.',
  [ERROR_CODES.DUPLICATE_ENTRY]: 'This information already exists in our system.',
  [ERROR_CODES.RECORD_NOT_FOUND]: 'The requested information could not be found.',
  
  [ERROR_CODES.INSUFFICIENT_FUNDS]: 'Insufficient funds for this transaction.',
  [ERROR_CODES.LOAN_LIMIT_EXCEEDED]: 'Loan limit exceeded. Please contact support for assistance.',
  [ERROR_CODES.INVALID_OPERATION]: 'This operation is not allowed at this time.',
  
  [ERROR_CODES.INTERNAL_ERROR]: 'An unexpected error occurred. Our team has been notified.',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait before trying again.'
};

// Generate unique error ID for tracking
const generateErrorId = () => {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
};

// Log error details for developers
const logError = (error, req, errorId) => {
  const errorDetails = {
    errorId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id || req.admin?.id || 'anonymous',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    }
  };
  
  console.error('ERROR DETAILS:', JSON.stringify(errorDetails, null, 2));
  
  // In production, you might want to send this to a logging service
  // like Winston, Sentry, or CloudWatch
};

// Determine error code based on error type
const getErrorCode = (error) => {
  // JWT errors
  if (error.name === 'JsonWebTokenError') return ERROR_CODES.INVALID_TOKEN;
  if (error.name === 'TokenExpiredError') return ERROR_CODES.TOKEN_EXPIRED;
  
  // Mongoose/MongoDB errors
  if (error.name === 'ValidationError') return ERROR_CODES.VALIDATION_ERROR;
  if (error.name === 'CastError') return ERROR_CODES.INVALID_INPUT;
  if (error.code === 11000) return ERROR_CODES.DUPLICATE_ENTRY;
  if (error.name === 'MongoError') return ERROR_CODES.DATABASE_ERROR;
  
  // Custom application errors
  if (error.statusCode === 401) return ERROR_CODES.UNAUTHORIZED;
  if (error.statusCode === 403) return ERROR_CODES.FORBIDDEN;
  if (error.statusCode === 404) return ERROR_CODES.RECORD_NOT_FOUND;
  if (error.statusCode === 429) return ERROR_CODES.RATE_LIMIT_EXCEEDED;
  
  // Default to internal error
  return ERROR_CODES.INTERNAL_ERROR;
};

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  const errorId = generateErrorId();
  const errorCode = getErrorCode(err);
  const statusCode = err.statusCode || 500;
  
  // Log detailed error information
  logError(err, req, errorId);
  
  // Prepare response
  const response = {
    success: false,
    error: {
      code: errorCode,
      message: USER_MESSAGES[errorCode] || USER_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
      id: errorId
    }
  };
  
  // In development, include additional debug information
  if (process.env.NODE_ENV === 'development') {
    response.debug = {
      originalMessage: err.message,
      stack: err.stack,
      statusCode: statusCode
    };
  }
  
  res.status(statusCode).json(response);
};

// Custom error class for application-specific errors
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Helper function to create standardized errors
const createError = {
  unauthorized: (message = 'Unauthorized access') => 
    new AppError(message, 401, ERROR_CODES.UNAUTHORIZED),
    
  forbidden: (message = 'Access forbidden') => 
    new AppError(message, 403, ERROR_CODES.FORBIDDEN),
    
  notFound: (message = 'Resource not found') => 
    new AppError(message, 404, ERROR_CODES.RECORD_NOT_FOUND),
    
  validation: (message = 'Validation failed') => 
    new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR),
    
  internal: (message = 'Internal server error') => 
    new AppError(message, 500, ERROR_CODES.INTERNAL_ERROR),
    
  rateLimit: (message = 'Rate limit exceeded') => 
    new AppError(message, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED)
};

module.exports = {
  errorHandler,
  AppError,
  createError,
  ERROR_CODES
};