require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Availability = require('../models/Availability');

const seedAvailability = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Find first tutor user
    const tutor = await User.findOne({ role: 'tutor' });
    if (!tutor) {
      console.error('❌ No tutor user found. Please register as a tutor first.');
      process.exit(1);
    }
    console.log(`✅ Found tutor: ${tutor.name} (${tutor.email})`);

    // Generate sample availability slots for the next 7 days
    const slots = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      // Add 4 slots per day: 09:00-10:30, 10:30-12:00, 14:00-15:30, 15:30-17:00
      const timeSlots = [
        { startTime: '09:00', endTime: '10:30', notes: 'Morning Session - Flexible' },
        { startTime: '10:30', endTime: '12:00', notes: 'Late Morning Session' },
        { startTime: '14:00', endTime: '15:30', notes: 'Afternoon Session' },
        { startTime: '15:30', endTime: '17:00', notes: 'Late Afternoon Session' }
      ];

      timeSlots.forEach(slot => {
        slots.push({
          tutorId: tutor._id,
          date: new Date(date),
          startTime: slot.startTime,
          endTime: slot.endTime,
          notes: slot.notes,
          status: 'available',
          isRecurring: false,
          recurringPattern: null,
          recurringEndDate: null
        });
      });
    }

    // Insert all slots
    const created = await Availability.insertMany(slots);
    console.log(`✅ Created ${created.length} availability slots`);

    // Display summary
    const summary = {};
    created.forEach(slot => {
      const dateStr = slot.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (!summary[dateStr]) {
        summary[dateStr] = [];
      }
      summary[dateStr].push(`${slot.startTime}-${slot.endTime}`);
    });

    console.log('\n📅 Sample Availability Schedule:');
    Object.entries(summary).forEach(([date, times]) => {
      console.log(`  ${date}: ${times.join(', ')}`);
    });

    console.log('\n✅ Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedAvailability();
