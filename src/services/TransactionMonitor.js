import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther, 
  formatEther,
  formatGwei,
  parseGwei
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';
import { Histogram, Counter, Gauge } from 'prom-client';
import { logger } from '../utils/logger.js';

export class TransactionMonitor {
  constructor(register) {
    this.monitoringInterval = parseInt(process.env.MONITOR_INTERVAL || "60000");
    
    this.publicClient = createPublicClient({
      transport: http(process.env.SHARDEUM_RPC_URL, {
        batch: false,
        retryCount: 0,
        retryDelay: 0, 
        headers: { 'Content-Type': 'application/json' }
      })
    });

    // Ensure private key has 0x prefix
    const formatPrivateKey = (key) => {
      if (!key) throw new Error('Private key is required');
      return key.startsWith('0x') ? key : `0x${key}`;
    };

    // Initialize wallet clients for both pairs
    this.walletPairs = [
      {
        client: createWalletClient({
          account: privateKeyToAccount(formatPrivateKey(process.env.PRIMARY_SENDER_PRIVATE_KEY)),
          transport: http(process.env.SHARDEUM_RPC_URL, {
            retryCount: 0,
            retryDelay: 0  
          })
        }),
        receiverAddress: process.env.PRIMARY_RECEIVER_ADDRESS
      },
      {
        client: createWalletClient({
          account: privateKeyToAccount(formatPrivateKey(process.env.SECONDARY_SENDER_PRIVATE_KEY)),
          transport: http(process.env.SHARDEUM_RPC_URL, {
            retryCount: 0,
            retryDelay: 0 
          })
        }),
        receiverAddress: process.env.SECONDARY_RECEIVER_ADDRESS
      }
    ];

    this.currentWalletIndex = 0;
    this.lastWalletSwitch = Date.now();
    this.amount = parseEther(process.env.TRANSACTION_AMOUNT || "0.001");
    
    this.initializeMetrics(register);
    this.initializeTracking();
    this.lastError = null;
  }

  initializeMetrics(register) {
    this.metrics = {
      confirmationTime: new Histogram({
        name: 'shardeum_transaction_confirmation_time_seconds',
        help: 'Time taken for transaction confirmation in seconds',
        buckets: [10, 30, 60, 120, 300, 600],
        registers: [register]
      }),
      success: new Counter({
        name: 'shardeum_transaction_success_total',
        help: 'Total number of successful transactions',
        registers: [register]
      }),
      failure: new Counter({
        name: 'shardeum_transaction_failure_total',
        help: 'Total number of failed transactions',
        registers: [register]
      }),
      pending: new Gauge({
        name: 'shardeum_pending_transactions',
        help: 'Number of pending transactions',
        registers: [register]
      })
    };
  }

  initializeTracking() {
    this.pendingTxs = new Map();
    this.transactionHistory = {
      success: new Map(),
      failure: new Map(),
      confirmationTimes: new Map()
    };
    this.gasUsageHistory = new Map();
    this.totalGasUsed = 0n;
    this.fastestTx = Infinity;
    this.slowestTx = 0;
  }

  async checkWalletBalance(walletPair) {
    try {
      const account = walletPair.client.account;
      const balance = await this.publicClient.getBalance({
        address: account.address,
      });
      
      // Add buffer for gas (21000 gas * current gas price)
      const gasPrice = await this.publicClient.getGasPrice();
      const gasCost = gasPrice * 21000n;
      const requiredAmount = this.amount + gasCost;
      
      return balance >= requiredAmount;
    } catch (error) {
      logger.error('Failed to check wallet balance', error);
      return false;
    }
  }

  async getCurrentWallet() {
    const now = Date.now();
    const currentWallet = this.walletPairs[this.currentWalletIndex];
    
    // Check if current wallet has sufficient balance
    const hasBalance = await this.checkWalletBalance(currentWallet);
    
    // Switch wallet if current wallet is low on funds or has been active for an hour
    if (!hasBalance || (now - this.lastWalletSwitch >= 3600000)) { // 1 hour
      // Try the other wallet
      const otherIndex = (this.currentWalletIndex + 1) % 2;
      const otherWallet = this.walletPairs[otherIndex];
      
      // Check if other wallet has sufficient balance
      const otherHasBalance = await this.checkWalletBalance(otherWallet);
      
      if (otherHasBalance) {
        this.currentWalletIndex = otherIndex;
        this.lastWalletSwitch = now;
        logger.info(`Switched to wallet ${otherIndex} due to ${!hasBalance ? 'insufficient balance' : 'time rotation'}`);
      } else if (!hasBalance) {
        // If both wallets are insufficient, log error but keep current wallet
        logger.error('Both wallets have insufficient balance');
      }
    }
    
    return this.walletPairs[this.currentWalletIndex];
  }

  async start() {
    await this.sendMonitoringTransaction();
    this.intervalHandle = setInterval(
      () => this.sendMonitoringTransaction(),
      this.monitoringInterval
    );
  }

  async sendMonitoringTransaction() {
    try {
      logger.info('Attempting to send monitoring transaction...');
      const { client, receiverAddress } = await this.getCurrentWallet();
      
      // Get gas price using legacy method
      const gasPrice = await this.publicClient.getGasPrice();
      logger.info(`Current gas price: ${formatGwei(gasPrice)} Gwei`);
      
      const tx = {
        to: receiverAddress,
        value: this.amount,
        gas: 21000n,
        gasPrice 
      };

      logger.info(`Sending transaction to: ${receiverAddress}`);
      const startTime = Date.now();
      
      // Send transaction 
      const hash = await client.sendTransaction(tx);
      logger.info(`Transaction sent: ${hash}`);
      
      this.pendingTxs.set(hash, { 
        startTime,
        status: 'pending',
        gasPrice
      });
      this.metrics.pending.set(this.pendingTxs.size);

      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      const timestamp = Math.floor(Date.now() / 1000);
      const confirmationTime = (Date.now() - startTime) / 1000;
      
      logger.info(`Transaction confirmed in ${confirmationTime} seconds`);
      
      this.updateMetrics(receipt, timestamp, confirmationTime, gasPrice);
      this.cleanupOldData();
      
      this.pendingTxs.delete(hash);
      this.metrics.pending.set(this.pendingTxs.size);
    } catch (error) {
      logger.error('Transaction failed', {
        message: error.message,
        timestamp: new Date().toISOString(),
        walletIndex: this.currentWalletIndex,
        stack: error.stack
      });
      
      const timestamp = Math.floor(Date.now() / 1000);
      this.transactionHistory.failure.set(timestamp, 1);
      this.metrics.failure.inc();
      this.lastError = {
        message: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  updateMetrics(receipt, timestamp, confirmationTime, gasPrice) {
    this.fastestTx = Math.min(this.fastestTx, confirmationTime);
    this.slowestTx = Math.max(this.slowestTx, confirmationTime);
    
    this.gasUsageHistory.set(timestamp, gasPrice);
    
    this.totalGasUsed += receipt.gasUsed * gasPrice;
    this.transactionHistory.confirmationTimes.set(timestamp, confirmationTime);

    if (receipt.status === 'success') {
      this.transactionHistory.success.set(timestamp, 1);
      this.metrics.success.inc();
    } else {
      this.transactionHistory.failure.set(timestamp, 1);
      this.metrics.failure.inc();
    }
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    console.log('[TransactionMonitor] Stopped monitoring');
  }

  cleanupOldData() {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;  
    
    [
      this.transactionHistory.success,
      this.transactionHistory.failure,
      this.transactionHistory.confirmationTimes
    ].forEach(map => {
      for (const [timestamp] of map) {
        if (timestamp < oneHourAgo) {
          map.delete(timestamp);
        }
      }
    });
  }

  getConfirmationTimes() {
    return Array.from(this.transactionHistory.confirmationTimes.entries())
      .sort(([a], [b]) => a - b)
      .map(([timestamp, time]) => ({
        timestamp,
        value: time
      }));
  }

  getTransactionCounts() {
    const success = Array.from(this.transactionHistory.success.keys()).length;
    const failure = Array.from(this.transactionHistory.failure.keys()).length;
    const total = success + failure;
    const successRate = total > 0 ? (success / total) * 100 : 0;
    
    const result = { 
      success, 
      failure, 
      total,
      successRate: parseFloat(successRate.toFixed(2))
    };
    
    console.log('Transaction counts:', result);
    return result;
  }

  getAverageGasPrice() {
    const prices = Array.from(this.gasUsageHistory.values());
    if (prices.length === 0) return 0;
    
    const pricesInGwei = prices.map(price => 
      Number(formatGwei(price))
    );
    
    const avgPrice = pricesInGwei.reduce((a, b) => a + b, 0) / prices.length;
    console.log('Average gas price calculation:', {
      numPrices: prices.length,
      pricesInGwei,
      average: avgPrice
    });
    return avgPrice;
  }

  getTotalGasUsed() {
    if (this.totalGasUsed === 0n) return 0;
    
    const totalGasGwei = Number(formatGwei(this.totalGasUsed));
    console.log('Total gas calculation:', {
      rawTotal: this.totalGasUsed.toString(),
      inGwei: totalGasGwei
    });
    return totalGasGwei;
  }

 
  getAverageConfirmationTime() {
    const times = Array.from(this.transactionHistory.confirmationTimes.values());
    const avgTime = times.length > 0 
      ? times.reduce((a, b) => a + b, 0) / times.length 
      : 0;
    console.log('Average confirmation time:', avgTime, 'from', times.length, 'transactions');
    return avgTime;
  }

  getFastestTransaction() {
    const fastest = this.fastestTx === Infinity ? 0 : this.fastestTx;
    console.log('Fastest transaction:', fastest);
    return fastest;
  }

  getSlowestTransaction() {
    console.log('Slowest transaction:', this.slowestTx);
    return this.slowestTx || 0;
  }

  getPendingTransactionCount() {
    const pending = this.pendingTxs.size;
    console.log('Pending transactions:', pending);
    return pending;
  }

  getLastError() {
    return this.lastError;
  }
}

