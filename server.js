import express from 'express';
import cors from 'cors';
import { TransactionMonitor } from './src/services/TransactionMonitor.js';
import { Registry } from 'prom-client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const register = new Registry();
const monitor = new TransactionMonitor(register);

// Simplified CORS setup
app.use(cors());
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
app.get('/api/metrics/confirmation-times', asyncHandler(async (req, res) => {
  res.json(monitor.getConfirmationTimes());
}));

app.get('/api/metrics/transaction-counts', asyncHandler(async (req, res) => {
  res.json(monitor.getTransactionCounts());
}));

app.get('/api/metrics/gas', asyncHandler(async (req, res) => {
  const avgGasPrice = monitor.getAverageGasPrice();
  const totalGasUsed = monitor.getTotalGasUsed();
  
  res.json({
    averageGasPrice: avgGasPrice,
    totalGasUsed: totalGasUsed
  });
}));

app.get('/api/metrics/speed', asyncHandler(async (req, res) => {
  res.json({
    averageConfirmationTime: monitor.getAverageConfirmationTime(),
    fastestTransaction: monitor.getFastestTransaction(),
    slowestTransaction: monitor.getSlowestTransaction(),
    pendingTransactions: monitor.getPendingTransactionCount()
  });
}));

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