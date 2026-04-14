const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorAvailability', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Create test users
    const users = [
      {
        name: 'John Tutor',
        email: 'tutor@example.com',
        password: 'tutor123',
        role: 'tutor',
        isActive: true
      },
      {
        name: 'Sarah Sales',
        email: 'sales@example.com',
        password: 'sales123',
        role: 'sales',
        isActive: true
      },
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
        isActive: true
      }
    ];

    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      console.log(`Created ${userData.role}: ${userData.email}`);
    }

    console.log('\nSeed data created successfully!');
    console.log('\nTest Accounts:');
    console.log('Tutor: tutor@example.com / tutor123');
    console.log('Sales: sales@example.com / sales123');
    console.log('Admin: admin@example.com / admin123');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
  }
};

seedData();
