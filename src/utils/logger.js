import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define both log file paths
const dockerLogFile = path.join(__dirname, '../../logs/transactions.log');
const localLogFile = path.join(__dirname, '../../transaction-monitor.log');

// Ensure logs directory exists for Docker volume
if (!fs.existsSync(path.join(__dirname, '../../logs'))) {
  fs.mkdirSync(path.join(__dirname, '../../logs'));
}

export const logger = {
  error: (message, error) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}\n${error.stack || error}\n\n`;
    
    // Write to Docker volume log
    fs.appendFile(dockerLogFile, logMessage, (err) => {
      if (err) console.error('Failed to write to Docker log file:', err);
    });
    
    // Write to local log file
    fs.appendFile(localLogFile, logMessage, (err) => {
      if (err) console.error('Failed to write to local log file:', err);
    });
    
    console.error(message, error);
  },
  
  info: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}\n`;
    
    // Write to Docker volume log
    fs.appendFile(dockerLogFile, logMessage, (err) => {
      if (err) console.error('Failed to write to Docker log file:', err);
    });
    
    // Write to local log file
    fs.appendFile(localLogFile, logMessage, (err) => {
      if (err) console.error('Failed to write to local log file:', err);
    });
    
    console.log(message);
  }
}; 