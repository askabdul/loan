// Using axios instead of fetch for CommonJS compatibility
const axios = require('axios');

async function testAdminRegister() {
  try {
    const response = await axios.post('http://localhost:5000/api/users/admin-register', {
        email: 'admin@example.com',
        username: 'admin123',
        password: 'password123',
        phoneNumber: '0201234567',
        pin: '1234',
        personalInfo: {
          firstName: 'Admin',
          lastName: 'User'
        },
        designation: 'Manager',
        dateJoined: '2023-01-01',
        dateOfExpiry: '2024-01-01'
      }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error status:', error.response?.status);
    console.error('Error data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Error message:', error.message);
  }
}

testAdminRegister();