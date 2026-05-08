const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cediloan');

async function fixUserIds() {
  try {
    console.log('Starting userId fix process...');
    
    // Find all users without userId
    const usersWithoutId = await User.find({
      $or: [
        { userId: { $exists: false } },
        { userId: null },
        { userId: '' }
      ]
    });
    
    console.log(`Found ${usersWithoutId.length} users without userId`);
    
    if (usersWithoutId.length === 0) {
      console.log('All users already have userId. No action needed.');
      return;
    }
    
    // Generate unique userIds for each user
    for (let i = 0; i < usersWithoutId.length; i++) {
      const user = usersWithoutId[i];
      let userId;
      let isUnique = false;
      
      // Generate a unique 6-digit user ID
      while (!isUnique) {
        userId = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Check if this number already exists
        const existingUser = await User.findOne({ userId });
        if (!existingUser) {
          isUnique = true;
        }
      }
      
      // Update the user with the new userId
      await User.findByIdAndUpdate(user._id, { userId });
      console.log(`Updated user ${user._id} with userId: ${userId}`);
    }
    
    console.log(`Successfully updated ${usersWithoutId.length} users with userId`);
    
  } catch (error) {
    console.error('Error fixing userIds:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

// Run the fix
fixUserIds();