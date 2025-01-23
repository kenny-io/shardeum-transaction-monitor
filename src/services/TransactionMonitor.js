import { ethers } from 'ethers';
import 'dotenv/config';
import { Histogram, Counter, Gauge } from 'prom-client';

export class TransactionMonitor {
  constructor(register) {
    this.monitoringInterval = parseInt(process.env.MONITOR_INTERVAL || "60000");
    this.provider = new ethers.JsonRpcProvider(
      process.env.SHARDEUM_RPC_URL,
      undefined,
      {
        batchMaxCount: 1,
        polling: true,
        staticNetwork: true,
        cacheTimeout: -1,
        fetchOptions: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-cache'
        }
      }
    );

    // Initialize both wallet pairs
    this.walletPairs = [
      {
        signer: new ethers.Wallet(process.env.PRIMARY_SENDER_PRIVATE_KEY, this.provider),
        receiverAddress: process.env.PRIMARY_RECEIVER_ADDRESS
      },
      {
        signer: new ethers.Wallet(process.env.SECONDARY_SENDER_PRIVATE_KEY, this.provider),
        receiverAddress: process.env.SECONDARY_RECEIVER_ADDRESS
      }
    ];

    this.currentWalletIndex = 0;
    this.lastWalletSwitch = Date.now();
    this.amount = ethers.parseEther(process.env.TRANSACTION_AMOUNT || "0.001");
    
    this.initializeMetrics(register);
    this.initializeTracking();
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

  getCurrentWallet() {
    // Switch wallet every hour
    const now = Date.now();
    if (now - this.lastWalletSwitch >= 3600000) { // 1 hour in milliseconds
      this.currentWalletIndex = (this.currentWalletIndex + 1) % 2;
      this.lastWalletSwitch = now;
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
      const { signer, receiverAddress } = this.getCurrentWallet();
      const gasPrice = await this.provider.getFeeData();
      
      const tx = {
        to: receiverAddress,
        value: this.amount,
        gasLimit: 21000n,
        maxFeePerGas: gasPrice.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
      };

      const startTime = Date.now();
      const transaction = await signer.sendTransaction(tx);
      
      this.pendingTxs.set(transaction.hash, { 
        startTime, 
        status: 'pending',
        gasPrice: gasPrice.gasPrice
      });
      this.metrics.pending.set(this.pendingTxs.size);

      const receipt = await transaction.wait();
      const timestamp = Math.floor(Date.now() / 1000);
      const confirmationTime = (Date.now() - startTime) / 1000;
      
      this.updateMetrics(receipt, timestamp, confirmationTime, gasPrice.gasPrice);
      this.cleanupOldData();
      
      this.pendingTxs.delete(transaction.hash);
      this.metrics.pending.set(this.pendingTxs.size);
    } catch (error) {
      console.error('Transaction error:', error);
      this.metrics.failure.inc();
    }
  }

  updateMetrics(receipt, timestamp, confirmationTime, gasPrice) {
    this.fastestTx = Math.min(this.fastestTx, confirmationTime);
    this.slowestTx = Math.max(this.slowestTx, confirmationTime);
    
    this.gasUsageHistory.set(timestamp, gasPrice);
    
    const gasUsedBigInt = BigInt(receipt.gasUsed.toString());
    this.totalGasUsed += gasUsedBigInt * gasPrice;

    this.transactionHistory.confirmationTimes.set(timestamp, confirmationTime);

    if (receipt.status === 1) {
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
    
    // Cleanup old data from all history maps
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
    
    // Convert all BigInts to Gwei before averaging
    const pricesInGwei = prices.map(price => 
      Number(ethers.formatUnits(price, "gwei"))
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
    
    const totalGasGwei = Number(ethers.formatUnits(this.totalGasUsed, "gwei"));
    console.log('Total gas calculation:', {
      rawTotal: this.totalGasUsed.toString(),
      inGwei: totalGasGwei
    });
    return totalGasGwei;
  }

  // Methods for speed metrics
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
}