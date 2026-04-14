#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Cleanup configuration
const cleanupConfig = {
  logs: {
    path: path.join(__dirname, '../logs'),
    retention: parseInt(process.env.LOG_RETENTION_DAYS) || 14
  },
  uploads: {
    path: path.join(__dirname, '../uploads'),
    retention: parseInt(process.env.UPLOAD_RETENTION_DAYS) || 30
  },
  temp: {
    path: path.join(__dirname, '../temp'),
    retention: parseInt(process.env.TEMP_RETENTION_DAYS) || 1
  },
  database: {
    notifications: parseInt(process.env.NOTIFICATION_RETENTION_DAYS) || 90,
    auditLogs: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 30
  }
};

// Connect to database
const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

// Clean old log files
const cleanupLogs = () => {
  try {
    console.log('Cleaning up old log files...');
    
    if (!fs.existsSync(cleanupConfig.logs.path)) {
      console.log('Logs directory does not exist');
      return;
    }
    
    const files = fs.readdirSync(cleanupConfig.logs.path);
    const cutoffTime = Date.now() - (cleanupConfig.logs.retention * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    files.forEach(file => {
      const filepath = path.join(cleanupConfig.logs.path, file);
      const stats = fs.statSync(filepath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        fs.unlinkSync(filepath);
        deletedCount++;
        console.log(`Deleted old log: ${file}`);
      }
    });
    
    console.log(`Cleanup completed. Deleted ${deletedCount} log files.`);
  } catch (error) {
    console.error('Log cleanup failed:', error);
  }
};

// Clean old upload files
const cleanupUploads = () => {
  try {
    console.log('Cleaning up old upload files...');
    
    if (!fs.existsSync(cleanupConfig.uploads.path)) {
      console.log('Uploads directory does not exist');
      return;
    }
    
    const files = fs.readdirSync(cleanupConfig.uploads.path);
    const cutoffTime = Date.now() - (cleanupConfig.uploads.retention * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    files.forEach(file => {
      const filepath = path.join(cleanupConfig.uploads.path, file);
      const stats = fs.statSync(filepath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        fs.unlinkSync(filepath);
        deletedCount++;
        console.log(`Deleted old upload: ${file}`);
      }
    });
    
    console.log(`Cleanup completed. Deleted ${deletedCount} upload files.`);
  } catch (error) {
    console.error('Upload cleanup failed:', error);
  }
};

// Clean temporary files
const cleanupTemp = () => {
  try {
    console.log('Cleaning up temporary files...');
    
    if (!fs.existsSync(cleanupConfig.temp.path)) {
      console.log('Temp directory does not exist');
      return;
    }
    
    const files = fs.readdirSync(cleanupConfig.temp.path);
    const cutoffTime = Date.now() - (cleanupConfig.temp.retention * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    files.forEach(file => {
      const filepath = path.join(cleanupConfig.temp.path, file);
      const stats = fs.statSync(filepath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        fs.unlinkSync(filepath);
        deletedCount++;
        console.log(`Deleted temp file: ${file}`);
      }
    });
    
    console.log(`Cleanup completed. Deleted ${deletedCount} temp files.`);
  } catch (error) {
    console.error('Temp cleanup failed:', error);
  }
};

// Clean old notifications
const cleanupNotifications = async () => {
  try {
    console.log('Cleaning up old notifications...');
    
    const Notification = require('../models/Notification');
    const cutoffDate = new Date(Date.now() - cleanupConfig.database.notifications * 24 * 60 * 60 * 1000);
    
    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      isRead: true
    });
    
    console.log(`Deleted ${result.deletedCount} old notifications.`);
  } catch (error) {
    console.error('Notification cleanup failed:', error);
  }
};

// Clean old availability slots
const cleanupAvailability = async () => {
  try {
    console.log('Cleaning up old availability slots...');
    
    const Availability = require('../models/Availability');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const result = await Availability.deleteMany({
      date: { $lt: yesterday },
      status: 'available',
      bookingId: { $exists: false }
    });
    
    console.log(`Deleted ${result.deletedCount} old availability slots.`);
  } catch (error) {
    console.error('Availability cleanup failed:', error);
  }
};

// Optimize database indexes
const optimizeDatabase = async () => {
  try {
    console.log('Optimizing database indexes...');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      await db.collection(collection.name).reIndex();
      console.log(`Reindexed collection: ${collection.name}`);
    }
    
    console.log('Database optimization completed.');
  } catch (error) {
    console.error('Database optimization failed:', error);
  }
};

// Get database statistics
const getDatabaseStats = async () => {
  try {
    console.log('Getting database statistics...');
    
    const db = mongoose.connection.db;
    const stats = await db.stats();
    
    console.log('Database Statistics:');
    console.log(`Collections: ${stats.collections}`);
    console.log(`Documents: ${stats.objects}`);
    console.log(`Data Size: ${Math.round(stats.dataSize / 1024 / 1024)} MB`);
    console.log(`Index Size: ${Math.round(stats.indexSize / 1024 / 1024)} MB`);
    console.log(`Storage Size: ${Math.round(stats.storageSize / 1024 / 1024)} MB`);
    
    // Collection-specific stats
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      const collStats = await db.collection(collection.name).stats();
      console.log(`\n${collection.name}:`);
      console.log(`  Documents: ${collStats.count}`);
      console.log(`  Size: ${Math.round(collStats.size / 1024)} KB`);
      console.log(`  Indexes: ${collStats.nindexes}`);
    }
    
  } catch (error) {
    console.error('Failed to get database stats:', error);
  }
};

// Check disk space
const checkDiskSpace = () => {
  try {
    console.log('Checking disk space...');
    
    const paths = [
      cleanupConfig.logs.path,
      cleanupConfig.uploads.path,
      cleanupConfig.temp.path,
      path.join(__dirname, '../backups')
    ];
    
    paths.forEach(dirPath => {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        let totalSize = 0;
        
        files.forEach(file => {
          const filepath = path.join(dirPath, file);
          const stats = fs.statSync(filepath);
          totalSize += stats.size;
        });
        
        const sizeMB = Math.round(totalSize / 1024 / 1024);
        console.log(`${path.basename(dirPath)}: ${files.length} files, ${sizeMB} MB`);
      }
    });
    
  } catch (error) {
    console.error('Disk space check failed:', error);
  }
};

// Main cleanup function
const performCleanup = async () => {
  const startTime = Date.now();
  
  try {
    console.log('Starting cleanup process...');
    console.log(`Log retention: ${cleanupConfig.logs.retention} days`);
    console.log(`Upload retention: ${cleanupConfig.uploads.retention} days`);
    console.log(`Temp retention: ${cleanupConfig.temp.retention} days`);
    console.log(`Notification retention: ${cleanupConfig.database.notifications} days`);
    
    // Connect to database
    await connectDatabase();
    
    // File cleanup
    cleanupLogs();
    cleanupUploads();
    cleanupTemp();
    
    // Database cleanup
    await cleanupNotifications();
    await cleanupAvailability();
    
    // Database optimization
    await optimizeDatabase();
    
    // Statistics
    await getDatabaseStats();
    checkDiskSpace();
    
    const duration = Date.now() - startTime;
    console.log(`\nCleanup completed in ${Math.round(duration / 1000)}s`);
    
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// Command line interface
const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'all':
      await performCleanup();
      break;
      
    case 'logs':
      cleanupLogs();
      break;
      
    case 'uploads':
      cleanupUploads();
      break;
      
    case 'temp':
      cleanupTemp();
      break;
      
    case 'notifications':
      await connectDatabase();
      await cleanupNotifications();
      await mongoose.connection.close();
      break;
      
    case 'availability':
      await connectDatabase();
      await cleanupAvailability();
      await mongoose.connection.close();
      break;
      
    case 'optimize':
      await connectDatabase();
      await optimizeDatabase();
      await mongoose.connection.close();
      break;
      
    case 'stats':
      await connectDatabase();
      await getDatabaseStats();
      checkDiskSpace();
      await mongoose.connection.close();
      break;
      
    default:
      console.log('Usage: node cleanup.js <command>');
      console.log('Commands:');
      console.log('  all          - Run all cleanup tasks');
      console.log('  logs         - Clean old log files');
      console.log('  uploads      - Clean old upload files');
      console.log('  temp         - Clean temporary files');
      console.log('  notifications - Clean old notifications');
      console.log('  availability - Clean old availability slots');
      console.log('  optimize     - Optimize database indexes');
      console.log('  stats        - Show statistics');
      process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  performCleanup,
  cleanupLogs,
  cleanupUploads,
  cleanupTemp,
  cleanupNotifications,
  cleanupAvailability,
  optimizeDatabase,
  getDatabaseStats
};
