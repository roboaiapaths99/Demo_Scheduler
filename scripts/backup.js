#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Backup configuration
const backupConfig = {
  database: {
    uri: process.env.MONGODB_URI,
    name: 'tutor-availability-backup'
  },
  storage: {
    path: process.env.BACKUP_PATH || path.join(__dirname, '../backups'),
    retention: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30
  },
  compression: process.env.BACKUP_COMPRESSION !== 'false'
};

// Create backup directory
const createBackupDir = () => {
  if (!fs.existsSync(backupConfig.storage.path)) {
    fs.mkdirSync(backupConfig.storage.path, { recursive: true });
    console.log(`Created backup directory: ${backupConfig.storage.path}`);
  }
};

// Generate backup filename
const generateBackupFilename = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = backupConfig.compression ? '.gz' : '';
  return `backup-${timestamp}${extension}`;
};

// Backup MongoDB database
const backupDatabase = async () => {
  const filename = generateBackupFilename();
  const filepath = path.join(backupConfig.storage.path, filename);
  
  try {
    console.log('Starting database backup...');
    
    // Extract database name from URI
    const uri = new URL(backupConfig.database.uri);
    const dbName = uri.pathname.substring(1);
    
    // Create mongodump command
    let command = `mongodump --uri="${backupConfig.database.uri}" --db="${dbName}" --out="${filepath}"`;
    
    if (backupConfig.compression) {
      command += ' --gzip';
    }
    
    // Execute backup
    execSync(command, { stdio: 'inherit' });
    
    console.log(`Database backup completed: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('Database backup failed:', error);
    throw error;
  }
};

// Backup application files
const backupFiles = async () => {
  const filename = `files-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`;
  const filepath = path.join(backupConfig.storage.path, filename);
  
  try {
    console.log('Starting files backup...');
    
    // Files to exclude from backup
    const excludePatterns = [
      'node_modules',
      'logs',
      'backups',
      'uploads',
      '.git',
      '.env',
      '*.log'
    ];
    
    // Create tar command
    let command = `tar -czf "${filepath}"`;
    excludePatterns.forEach(pattern => {
      command += ` --exclude="${pattern}"`;
    });
    command += ' .';
    
    // Execute backup from project root
    const projectRoot = path.join(__dirname, '..');
    execSync(command, { cwd: projectRoot, stdio: 'inherit' });
    
    console.log(`Files backup completed: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('Files backup failed:', error);
    throw error;
  }
};

// Clean old backups
const cleanupOldBackups = () => {
  try {
    console.log('Cleaning up old backups...');
    
    const files = fs.readdirSync(backupConfig.storage.path);
    const cutoffTime = Date.now() - (backupConfig.storage.retention * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
      const filepath = path.join(backupConfig.storage.path, file);
      const stats = fs.statSync(filepath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        fs.unlinkSync(filepath);
        console.log(`Deleted old backup: ${file}`);
      }
    });
    
    console.log('Backup cleanup completed');
  } catch (error) {
    console.error('Backup cleanup failed:', error);
  }
};

// Get backup size
const getBackupSize = (filepath) => {
  const stats = fs.statSync(filepath);
  return Math.round(stats.size / 1024 / 1024 * 100) / 100; // Size in MB
};

// Create backup manifest
const createManifest = (backups) => {
  const manifest = {
    timestamp: new Date().toISOString(),
    backups: backups.map(backup => ({
      type: backup.type,
      filename: path.basename(backup.path),
      size: backup.size,
      created: new Date(backup.created).toISOString()
    }))
  };
  
  const manifestPath = path.join(backupConfig.storage.path, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`Backup manifest created: ${manifestPath}`);
};

// Main backup function
const performBackup = async () => {
  const startTime = Date.now();
  const backups = [];
  
  try {
    console.log('Starting backup process...');
    console.log(`Backup retention: ${backupConfig.storage.retention} days`);
    console.log(`Compression: ${backupConfig.compression ? 'enabled' : 'disabled'}`);
    
    // Create backup directory
    createBackupDir();
    
    // Backup database
    const dbBackup = await backupDatabase();
    backups.push({
      type: 'database',
      path: dbBackup,
      size: getBackupSize(dbBackup),
      created: fs.statSync(dbBackup).mtime
    });
    
    // Backup files
    const filesBackup = await backupFiles();
    backups.push({
      type: 'files',
      path: filesBackup,
      size: getBackupSize(filesBackup),
      created: fs.statSync(filesBackup).mtime
    });
    
    // Create manifest
    createManifest(backups);
    
    // Clean old backups
    cleanupOldBackups();
    
    const duration = Date.now() - startTime;
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    
    console.log('\nBackup Summary:');
    console.log(`Duration: ${Math.round(duration / 1000)}s`);
    console.log(`Total size: ${totalSize} MB`);
    console.log(`Files created: ${backups.length}`);
    backups.forEach(backup => {
      console.log(`- ${backup.type}: ${backup.filename} (${backup.size} MB)`);
    });
    
    console.log('\nBackup completed successfully!');
    
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
};

// Restore backup
const restoreBackup = async (type, filename) => {
  try {
    console.log(`Starting restore of ${type} backup: ${filename}`);
    
    const filepath = path.join(backupConfig.storage.path, filename);
    
    if (!fs.existsSync(filepath)) {
      throw new Error(`Backup file not found: ${filename}`);
    }
    
    if (type === 'database') {
      // Extract database name from URI
      const uri = new URL(backupConfig.database.uri);
      const dbName = uri.pathname.substring(1);
      
      // Create mongorestore command
      let command = `mongorestore --uri="${backupConfig.database.uri}" --db="${dbName}" --drop "${filepath}"`;
      
      if (backupConfig.compression) {
        command += ' --gzip';
      }
      
      // Execute restore
      execSync(command, { stdio: 'inherit' });
      
      console.log('Database restore completed');
    } else if (type === 'files') {
      // Extract files
      const command = `tar -xzf "${filepath}"`;
      execSync(command, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
      
      console.log('Files restore completed');
    } else {
      throw new Error('Invalid backup type. Use "database" or "files"');
    }
    
    console.log('Restore completed successfully!');
    
  } catch (error) {
    console.error('Restore failed:', error);
    process.exit(1);
  }
};

// List available backups
const listBackups = () => {
  try {
    const manifestPath = path.join(backupConfig.storage.path, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      console.log('No backup manifest found');
      return;
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    console.log('\nAvailable Backups:');
    console.log(`Created: ${manifest.timestamp}`);
    console.log('---');
    
    manifest.backups.forEach(backup => {
      console.log(`${backup.type}: ${backup.filename}`);
      console.log(`  Size: ${backup.size} MB`);
      console.log(`  Created: ${new Date(backup.created).toLocaleString()}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Failed to list backups:', error);
  }
};

// Command line interface
const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'backup':
      await performBackup();
      break;
      
    case 'restore':
      if (args.length < 3) {
        console.log('Usage: node backup.js restore <type> <filename>');
        console.log('Type: database or files');
        process.exit(1);
      }
      await restoreBackup(args[1], args[2]);
      break;
      
    case 'list':
      listBackups();
      break;
      
    case 'cleanup':
      cleanupOldBackups();
      break;
      
    default:
      console.log('Usage: node backup.js <command>');
      console.log('Commands:');
      console.log('  backup   - Create a new backup');
      console.log('  restore  - Restore from backup');
      console.log('  list     - List available backups');
      console.log('  cleanup  - Clean old backups');
      process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  performBackup,
  restoreBackup,
  listBackups,
  cleanupOldBackups
};
