import express from 'express';
import cors from 'cors';
import { TransactionMonitor } from './src/services/TransactionMonitor.js';
import { Registry } from 'prom-client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const router = express.Router();  // Create router
const port = process.env.PORT || 3000;
const register = new Registry();
const monitor = new TransactionMonitor(register);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update CORS setup to be more permissive in development
app.use(cors({
  origin: '*', // Be careful with this in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Centralized error handler
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Prometheus metrics endpoint
app.get('/metrics', asyncHandler(async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}));

// API endpoints with error handling
router.get('/metrics/confirmation-times', asyncHandler(async (req, res) => {
  res.json(monitor.getConfirmationTimes());
}));

router.get('/metrics/transaction-counts', asyncHandler(async (req, res) => {
  res.json(monitor.getTransactionCounts());
}));

router.get('/metrics/gas', asyncHandler(async (req, res) => {
  const avgGasPrice = monitor.getAverageGasPrice();
  const totalGasUsed = monitor.getTotalGasUsed();
  
  res.json({
    averageGasPrice: avgGasPrice,
    totalGasUsed: totalGasUsed
  });
}));

router.get('/metrics/speed', asyncHandler(async (req, res) => {
  res.json({
    averageConfirmationTime: monitor.getAverageConfirmationTime(),
    fastestTransaction: monitor.getFastestTransaction(),
    slowestTransaction: monitor.getSlowestTransaction(),
    pendingTransactions: monitor.getPendingTransactionCount()
  });
}));

// Mount API routes
app.use('/api', router);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message 
  });
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Received shutdown signal. Closing server...');
  monitor.stop();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start monitor and server
monitor.start().catch(console.error);
app.listen(port, () => console.log(`Server running on port ${port}`));