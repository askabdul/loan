const crypto = require('crypto');

// Error codes for consistent responses
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

// Helper functions to send standardized error responses
const sendErrorResponse = (res, statusCode, errorCode, customMessage = null) => {
  const errorId = generateErrorId();
  const message = customMessage || USER_MESSAGES[errorCode] || USER_MESSAGES[ERROR_CODES.INTERNAL_ERROR];
  
  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message,
      id: errorId
    }
  });
};

// Specific error response functions
const sendUnauthorizedError = (res, customMessage = null) => {
  return sendErrorResponse(res, 401, ERROR_CODES.UNAUTHORIZED, customMessage);
};

const sendForbiddenError = (res, customMessage = null) => {
  return sendErrorResponse(res, 403, ERROR_CODES.FORBIDDEN, customMessage);
};

const sendValidationError = (res, customMessage = null) => {
  return sendErrorResponse(res, 400, ERROR_CODES.VALIDATION_ERROR, customMessage);
};

const sendNotFoundError = (res, customMessage = null) => {
  return sendErrorResponse(res, 404, ERROR_CODES.RECORD_NOT_FOUND, customMessage);
};

const sendInternalError = (res, customMessage = null) => {
  return sendErrorResponse(res, 500, ERROR_CODES.INTERNAL_ERROR, customMessage);
};

const sendDuplicateError = (res, customMessage = null) => {
  return sendErrorResponse(res, 409, ERROR_CODES.DUPLICATE_ENTRY, customMessage);
};

const sendInvalidInputError = (res, customMessage = null) => {
  return sendErrorResponse(res, 400, ERROR_CODES.INVALID_INPUT, customMessage);
};

// Handle validation errors from express-validator
const handleValidationErrors = (errors, res) => {
  if (!errors.isEmpty()) {
    return sendValidationError(res);
  }
  return null;
};

// Async error wrapper to catch errors in async route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  ERROR_CODES,
  USER_MESSAGES,
  generateErrorId,
  sendErrorResponse,
  sendUnauthorizedError,
  sendForbiddenError,
  sendValidationError,
  sendNotFoundError,
  sendInternalError,
  sendDuplicateError,
  sendInvalidInputError,
  handleValidationErrors,
  asyncHandler
};