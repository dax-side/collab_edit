export const ErrorMessages = {
  DOCUMENT_NOT_FOUND: 'Document not found',
  INVALID_JSON: 'Invalid JSON',
  UNKNOWN_MESSAGE_TYPE: 'Unknown message type',
  DOCUMENT_APPLY_FAILED: 'Failed to apply operation to document',
  MIGRATION_FAILED: 'Database migration failed',
  INTERNAL_ERROR: 'An unexpected error occurred',

  // Auth errors
  UNAUTHORIZED: 'Unauthorized - please log in',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_EXISTS: 'Email already registered',
  USER_NOT_FOUND: 'User not found',
  INVALID_TOKEN: 'Invalid or expired token',

  // Document access errors
  FORBIDDEN: 'You do not have permission to access this document',
  INVALID_SHARE_TOKEN: 'Invalid or expired share link',
} as const;
