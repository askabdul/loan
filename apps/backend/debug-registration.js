const axios = require('axios');

// Test the admin-register endpoint
async function testRegistration() {
  try {
    console.log('Testing admin-register endpoint...');
    
    // Get admin token from localStorage simulation
    const testData = {
      phoneNumber: '+233123456789',
      pin: '1234',
      personalInfo: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        maritalStatus: 'single',
        address: {
          street: '123 Test St',
          city: 'Accra',
          region: 'Greater Accra',
          country: 'Ghana'
        }
      },
      workInfo: {
        employmentStatus: 'employed',
        employer: 'Test Company',
        jobTitle: 'Developer',
        monthlyIncome: '5000',
        workAddress: 'Test Address',
        yearsOfEmployment: '2'
      },
      educationInfo: {
        highestLevel: 'bachelor',
        institution: 'Test University',
        fieldOfStudy: 'Computer Science',
        graduationYear: '2020'
      },
      emergencyContacts: [{
        name: 'Emergency Contact',
        relationship: 'friend',
        phoneNumber: '+233987654321',
        email: 'emergency@example.com'
      }],
      idVerification: {
        idType: 'national_id',
        idNumber: 'GHA123456789',
        idFrontImage: null,
        idBackImage: null,
        selfieImage: null
      },
      assignedLoanLevel: 1
    };

    // Test without token first
    console.log('Testing without token...');
    try {
      const response = await axios.post('http://localhost:5000/api/users/admin-register', testData);
      console.log('Unexpected success:', response.data);
    } catch (error) {
      console.log('Expected error without token:', error.response?.status, error.response?.data?.message);
    }

    // Test with a mock token
    console.log('\nTesting with mock token...');
    try {
      const response = await axios.post('http://localhost:5000/api/users/admin-register', testData, {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YjVhM2UxMjk5ZWVkODczNWVhM2EyMSIsInR5cGUiOiJhZG1pbiIsImlhdCI6MTc1NzQ0NzAzN30.invalid'
        }
      });
      console.log('Response:', response.data);
    } catch (error) {
      console.log('Error with mock token:', error.response?.status, error.response?.data);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testRegistration();