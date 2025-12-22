/**
 * Batch Update Service
 * Calls the Python batch_update.py script on a schedule
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// For timezone handling, we'll use a simple approach with date-fns-tz
// If not available, fall back to manual DST calculation
let getTimezoneDate;
try {
  // Try to use date-fns-tz if available (more accurate)
  const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');
  getTimezoneDate = (hour, minute = 0) => {
    const now = new Date();
    const timezone = 'America/New_York';
    
    // Get current time in ET
    const etNow = utcToZonedTime(now, timezone);
    
    // Create target time in ET
    const targetET = new Date(etNow);
    targetET.setHours(hour, minute, 0, 0);
    
    // If target time has passed today, move to tomorrow
    if (targetET <= etNow) {
      targetET.setDate(targetET.getDate() + 1);
    }
    
    // Convert ET time back to UTC
    return zonedTimeToUtc(targetET, timezone);
  };
} catch (e) {
  // Fallback: Manual calculation (approximate, handles DST reasonably)
  getTimezoneDate = (hour, minute = 0) => {
    const now = new Date();
    const timezone = 'America/New_York';
    
    // Get current time in ET (EST is UTC-5, EDT is UTC-4)
    // We'll use a simple approach: check if we're in DST period
    const jan = new Date(now.getFullYear(), 0, 1);
    const jul = new Date(now.getFullYear(), 6, 1);
    const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    const isDST = now.getTimezoneOffset() < stdTimezoneOffset;
    const etOffset = isDST ? -4 : -5; // EDT = UTC-4, EST = UTC-5
    
    // Create target time in ET
    const targetET = new Date(now);
    targetET.setUTCHours(hour - etOffset, minute, 0, 0);
    
    // If target time has passed today, move to tomorrow
    if (targetET <= now) {
      targetET.setUTCDate(targetET.getUTCDate() + 1);
    }
    
    return targetET;
  };
}

// Path to the Python batch update script
const repoRoot = path.join(__dirname, '..', '..', '..');
const batchUpdateScript = path.join(repoRoot, 'apps', 'sorcerers-ledger', 'scripts', 'batch_update.py');
const appDir = path.join(__dirname, '..');
const logsDir = path.join(appDir, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Run the Python batch update script
 * @returns {Promise<{success: boolean, output: string, error: string}>}
 */
function runBatchUpdate() {
  return new Promise((resolve) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const logFileName = `batch_update_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.log`;
    const logFilePath = path.join(logsDir, logFileName);
    
    // Create a write stream for the log file (append mode)
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf8' });
    
    const logMessage = (message) => {
      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const logLine = `[${timestamp}] ${message}\n`;
      logStream.write(logLine);
      process.stdout.write(logLine);
    };
    
    logMessage('='.repeat(60));
    logMessage('Starting batch update (Python script)...');
    logMessage(`Log file: ${logFilePath}`);
    logMessage('='.repeat(60));
    
    // Spawn Python process
    const pythonProcess = spawn('python', [batchUpdateScript], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Write to log file and console
      logStream.write(output);
      process.stdout.write(output);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      // Write to log file and console
      logStream.write(error);
      process.stderr.write(error);
    });

    pythonProcess.on('close', (code) => {
      const success = code === 0;
      
      if (success) {
        logMessage('='.repeat(60));
        logMessage('Batch update completed successfully');
        logMessage('='.repeat(60));
      } else {
        logMessage('='.repeat(60));
        logMessage(`Batch update failed with exit code ${code}`);
        logMessage('='.repeat(60));
      }
      
      logStream.end();
      
      resolve({
        success,
        output: stdout,
        error: stderr,
        exitCode: code,
        logFile: logFilePath
      });
    });

    pythonProcess.on('error', (error) => {
      const errorMsg = `Failed to start batch update process: ${error.message}`;
      logMessage(errorMsg);
      logStream.end();
      
      resolve({
        success: false,
        output: stdout,
        error: error.message,
        exitCode: -1,
        logFile: logFilePath
      });
    });
  });
}

/**
 * Start scheduled batch updates
 * Runs daily at 2 AM Eastern Time (handles DST automatically)
 */
function startScheduledBatchUpdate() {
  const scheduleNextRun = () => {
    // Get next 2 AM ET (handles DST automatically)
    const nextRun = getTimezoneDate(2, 0); // 2 AM ET
    const msUntilRun = nextRun.getTime() - Date.now();
    
    const nextRunET = nextRun.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'long'
    });
    
    console.log(`Batch update scheduled for: ${nextRunET} (ET)`);
    console.log(`Time until next run: ${Math.round(msUntilRun / 1000 / 60 / 60)} hours`);
    
    setTimeout(async () => {
      console.log('Running scheduled batch update...');
      await runBatchUpdate();
      
      // Schedule the next run (will recalculate for next day at 2 AM ET)
      scheduleNextRun();
    }, msUntilRun);
  };

  // Start the scheduling loop
  scheduleNextRun();
}

module.exports = {
  runBatchUpdate,
  startScheduledBatchUpdate
};

