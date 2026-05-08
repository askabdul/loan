const mongoose = require('mongoose');
const Admin = require('./models/Admin');

mongoose.connect('mongodb://localhost:27017/cedi_loan')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const admin = await Admin.findOne({email: 'superadmin@cedi.com'}).populate('role');
    
    if (admin) {
      console.log('Admin found:');
      console.log('Email:', admin.email);
      console.log('Role ID:', admin.role?._id);
      console.log('Role Name:', admin.role?.name);
      console.log('Role Display Name:', admin.role?.displayName);
    } else {
      console.log('Admin not found');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });