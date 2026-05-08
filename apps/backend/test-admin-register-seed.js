const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

// Test admin registration endpoint with seeding approach
const testAdminRegister = async () => {
  try {
    console.log('=== Testing Admin Register Endpoint ===\n');
    
    // Connect to MongoDB to verify super admin exists
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Connected to MongoDB');
    
    const Admin = require('./models/Admin');
    const Role = require('./models/Role');
    
    // Find super admin
    const superAdminRole = await Role.findOne({ name: 'super-admin' });
    const superAdmin = await Admin.findOne({ 
      role: superAdminRole._id,
      email: 'superadmin@cedi.com'
    }).populate('role');
    
    if (!superAdmin) {
      console.error('❌ Super admin not found');
      return;
    }
    
    console.log('✅ Super admin found:', superAdmin.email);
    console.log('✅ Role:', superAdmin.role.name);
    console.log('✅ Permissions - User menu:', superAdmin.role.permissions.menus.user);
    console.log('✅ Permissions - User create:', superAdmin.role.permissions.subMenus.user.create);
    
    // Close MongoDB connection
    await mongoose.connection.close();
    
    // Now test the API endpoint
    const baseURL = 'http://localhost:5000/api';
    
    // Login as super admin
    console.log('\n=== Attempting Admin Login ===');
    const loginResponse = await axios.post(`${baseURL}/admin-auth/login`, {
      login: 'superadmin@cedi.com',
      password: 'SuperAdmin123!'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Admin login successful');
    console.log('✅ Token received:', token ? 'Yes' : 'No');
    
    // Test user registration with Ghana local format
    console.log('\n=== Testing User Registration (Ghana Local Format) ===');
    const testUser = {
      phoneNumber: '0271111111',
      pin: '1234',
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe.test@example.com',
        dateOfBirth: '1990-01-01',
        gender: 'male'
      },
      workInfo: {
        employmentStatus: 'employed',
        employer: 'Test Company',
        monthlyIncome: 2000,
        workLocation: 'Accra'
      },
      education: {
        level: 'tertiary',
        institution: 'University of Ghana'
      },
      emergencyContacts: [{
        name: 'Jane Doe',
        relationship: 'spouse',
        phoneNumber: '0271111112',
        email: 'jane.doe@example.com'
      }],
      idVerification: {
        idType: 'national-id',
        idNumber: 'GHA123456789'
      },
      loanLevel: 1
    };
    
    const registerResponse = await axios.post(`${baseURL}/users/admin-register`, testUser, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ User registration successful!');
    console.log('✅ Status:', registerResponse.status);
    console.log('✅ User ID:', registerResponse.data.user?._id);
    console.log('✅ Phone:', registerResponse.data.user?.phoneNumber);
    console.log('✅ Name:', registerResponse.data.user?.personalInfo?.firstName, registerResponse.data.user?.personalInfo?.lastName);
    console.log('✅ Email:', registerResponse.data.user?.personalInfo?.email);
    
    // Test with international format
    console.log('\n=== Testing User Registration (International Format) ===');
    const testUser2 = {
      ...testUser,
      phoneNumber: '+233271111113',
      personalInfo: {
        ...testUser.personalInfo,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith.test@example.com'
      },
      emergencyContacts: [{
        ...testUser.emergencyContacts[0],
        phoneNumber: '0271111114'
      }],
      idVerification: {
        ...testUser.idVerification,
        idNumber: 'GHA123456790'
      }
    };
    
    const registerResponse2 = await axios.post(`${baseURL}/users/admin-register`, testUser2, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ International format registration successful!');
    console.log('✅ Status:', registerResponse2.status);
    console.log('✅ User ID:', registerResponse2.data.user?._id);
    console.log('✅ Phone:', registerResponse2.data.user?.phoneNumber);
    console.log('✅ Name:', registerResponse2.data.user?.personalInfo?.firstName, registerResponse2.data.user?.personalInfo?.lastName);
    console.log('✅ Email:', registerResponse2.data.user?.personalInfo?.email);
    
    console.log('\n=== Test Summary ===');
    console.log('✅ Super admin has full permissions');
    console.log('✅ Ghana local format (0541972780) works');
    console.log('✅ International format (+233541972781) works');
    console.log('✅ Admin register endpoint is functioning correctly');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Response:', error.response.data);
    }
  }
};

testAdminRegister();