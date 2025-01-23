const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');
const { TransactionMonitor } = require('./src/services/TransactionMonitor');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Prometheus registry
const register = new promClient.Registry();

// Initialize transaction monitor
const monitor = new TransactionMonitor(register);

// CORS configuration
const corsOptions = {
  origin: [
    'http://34.18.31.242:3000',     // Production frontend
    'http://localhost:3000',         // Local frontend
    'http://localhost:5173'          // Vite dev server
  ],
  methods: ['GET', 'POST'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// API routes
app.get('/api/metrics/confirmation-times', async (req, res) => {
  try {
    const times = monitor.getConfirmationTimes();
    res.json(times);
  } catch (error) {
    console.error('Error fetching confirmation times:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/metrics/transaction-counts', async (req, res) => {
  try {
    const counts = monitor.getTransactionCounts();
    res.json(counts);
  } catch (error) {
    console.error('Error fetching transaction counts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/metrics/gas', async (req, res) => {
  try {
    const gasMetrics = {
      averagePrice: monitor.getAverageGasPrice(),
      totalUsed: monitor.getTotalGasUsed()
    };
    res.json(gasMetrics);
  } catch (error) {
    console.error('Error fetching gas metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/metrics/speed', async (req, res) => {
  try {
    const speedMetrics = {
      average: monitor.getAverageConfirmationTime(),
      fastest: monitor.getFastestTransaction(),
      slowest: monitor.getSlowestTransaction(),
      pending: monitor.getPendingTransactionCount()
    };
    res.json(speedMetrics);
  } catch (error) {
    console.error('Error fetching speed metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).end();
  }
});

// Start the monitor and server
monitor.start().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}).catch(error => {
  console.error('Failed to start monitor:', error);
  process.exit(1);
});