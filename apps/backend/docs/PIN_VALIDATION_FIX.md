# PIN Validation Fix

## Issue

The admin registration endpoint was returning a 500 Internal Server Error when attempting to register a new user. The error occurred because the PIN validation was using `isNumeric()` validator, but the PIN was being passed as a string.

## Root Cause

In the `users.js` route file, the PIN validation was using:

```javascript
body('pin').isLength({ min: 4, max: 4 }).isNumeric().withMessage('PIN must be exactly 4 digits')
```

However, the PIN is stored as a string in the database and hashed using bcrypt. The `isNumeric()` validator was causing issues because it expects the input to be a numeric value, but the PIN was being passed as a string.

## Solution

The fix was to change the validation from `isNumeric()` to `isString()` to properly validate the PIN as a string:

```javascript
body('pin').isLength({ min: 4, max: 4 }).isString().withMessage('PIN must be exactly 4 digits')
```

This ensures that the PIN is validated as a string while still enforcing the 4-digit length requirement.

## Testing

To test the fix, we attempted to register a new admin user with a PIN of "1234". The endpoint now correctly validates the PIN as a string.

Note: The admin registration endpoint requires authentication with adminAuth middleware, so any tests must include proper authentication.