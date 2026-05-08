const express = require('express');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(express.json());

// Test route with string PIN validation
app.post('/test-pin-string', [
  body('pin').isLength({ min: 4, max: 4 }).isString().withMessage('PIN must be exactly 4 digits')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  res.json({ success: true, message: 'PIN validation passed with isString()' });
});

// Test route with numeric PIN validation
app.post('/test-pin-numeric', [
  body('pin').isLength({ min: 4, max: 4 }).isNumeric().withMessage('PIN must be exactly 4 digits')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  res.json({ success: true, message: 'PIN validation passed with isNumeric()' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('To test string validation: curl -X POST http://localhost:3001/test-pin-string -H "Content-Type: application/json" -d "{\"pin\":\"1234\"}"');
  console.log('To test numeric validation: curl -X POST http://localhost:3001/test-pin-numeric -H "Content-Type: application/json" -d "{\"pin\":\"1234\"}"');
});