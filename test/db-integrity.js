import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const DB_PATH = '/litefs/comprehendo.sqlite';
const CHECK_INTERVAL = 5000; // 5 seconds

function checkDatabaseIntegrity() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Checking database integrity...`);

  // Check if database file exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[${timestamp}] Database file not found at ${DB_PATH}`);
    return;
  }

  // Run SQLite integrity check
  exec(`sqlite3 ${DB_PATH} "PRAGMA integrity_check;"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`[${timestamp}] Error checking database: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`[${timestamp}] Database check stderr: ${stderr}`);
      return;
    }

    // Log the result
    console.log(`[${timestamp}] Database integrity check result: ${stdout.trim()}`);

    // If integrity check failed, create a backup
    if (stdout.trim() !== 'ok') {
      const backupPath = path.join('/litefs', `comprehendo-backup-${timestamp}.sqlite`);
      exec(`cp ${DB_PATH} ${backupPath}`, (backupError) => {
        if (backupError) {
          console.error(`[${timestamp}] Failed to create backup: ${backupError.message}`);
        } else {
          console.log(`[${timestamp}] Created backup at ${backupPath}`);
        }
      });
    }
  });
}

// Run integrity check every CHECK_INTERVAL milliseconds
setInterval(checkDatabaseIntegrity, CHECK_INTERVAL);

// Initial check
checkDatabaseIntegrity();
