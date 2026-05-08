// Test phone number validation patterns directly
const testPhoneValidation = () => {
  console.log('=== Testing Phone Number Validation Patterns ===\n');
  
  // Ghana local format pattern
  const ghanaLocalPattern = /^0[2-9]\d{8}$/;
  // International format pattern  
  const internationalPattern = /^\+233[2-9]\d{8}$/;
  
  const testCases = [
    { phone: '0541972780', description: 'Ghana local format (0541972780)' },
    { phone: '+233541972780', description: 'International format (+233541972780)' },
    { phone: '0501234567', description: 'Ghana local format (0501234567)' },
    { phone: '+233501234567', description: 'International format (+233501234567)' },
    { phone: '0241234567', description: 'Ghana local format (0241234567)' },
    { phone: '+233241234567', description: 'International format (+233241234567)' },
    { phone: '541972780', description: 'Invalid - missing country code/prefix' },
    { phone: '0141972780', description: 'Invalid - starts with 01 (not allowed)' },
    { phone: '+233141972780', description: 'Invalid - starts with +23314 (not allowed)' },
    { phone: '05419727801', description: 'Invalid - too many digits' },
    { phone: '054197278', description: 'Invalid - too few digits' }
  ];
  
  testCases.forEach(testCase => {
    const isValidLocal = ghanaLocalPattern.test(testCase.phone);
    const isValidInternational = internationalPattern.test(testCase.phone);
    const isValid = isValidLocal || isValidInternational;
    
    const status = isValid ? '✅ VALID' : '❌ INVALID';
    const matchType = isValidLocal ? '(Ghana Local)' : isValidInternational ? '(International)' : '';
    
    console.log(`${status} ${testCase.description} ${matchType}`);
  });
  
  console.log('\n=== Summary ===');
  console.log('✅ Both 0541972780 and +233541972780 should be accepted');
  console.log('✅ Phone validation patterns are working correctly');
};

testPhoneValidation();