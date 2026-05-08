const axios = require("axios");

// Test admin login and registration flow
async function testAdminFlow() {
  try {
    console.log("Testing admin login...");

    // First, login as admin to get a valid token
    const loginResponse = await axios.post(
      "http://localhost:8000/api/admin-auth/login",
      {
        login: "superadmin@cedi.com",
        password: "SuperAdmin123!",
      },
    );

    console.log("Login successful!");
    console.log(
      "Token received:",
      loginResponse.data.token.substring(0, 50) + "...",
    );

    const token = loginResponse.data.token;

    // Now test the registration endpoint with the valid token
    console.log("\nTesting registration with valid token...");

    const randomNum = Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, "0");
    const phoneNumber = `05${randomNum}`;
    console.log("Generated phone number:", phoneNumber);

    const testData = {
      phoneNumber: phoneNumber,
      pin: "1234",
      personalInfo: {
        firstName: "Test",
        lastName: "User",
        email: `test${randomNum}@example.com`,
        dateOfBirth: "1990-01-01",
        gender: "male",
        maritalStatus: "single",
        address: {
          street: "123 Test St",
          city: "Accra",
          region: "Greater Accra",
          country: "Ghana",
        },
      },
      workInfo: {
        employmentStatus: "employed",
        employer: "Test Company",
        jobTitle: "Developer",
        monthlyIncome: "5000",
        workAddress: "Test Address",
        yearsOfEmployment: "2",
      },
      educationInfo: {
        highestLevel: "bachelor",
        institution: "Test University",
        fieldOfStudy: "Computer Science",
        graduationYear: "2020",
      },
      emergencyContacts: [
        {
          name: "Emergency Contact",
          relationship: "friend",
          phoneNumber: `06${randomNum}`,
          email: "emergency.test@example.com",
        },
      ],
      idVerification: {
        idType: "national-id",
        idNumber: "GHA123456789",
        idFrontImage: null,
        idBackImage: null,
        selfieImage: null,
      },
      assignedLoanLevel: 1,
    };

    const registrationResponse = await axios.post(
      "http://localhost:5000/api/users/admin-register",
      testData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("Registration successful!");
    console.log("Response:", registrationResponse.data);
  } catch (error) {
    console.error("Error occurred:");
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Data:", error.response.data);
    } else {
      console.log("Error message:", error.message);
    }
  }
}

testAdminFlow();
