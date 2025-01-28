import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { API_URL } from '../config/api';

interface SpeedMetrics {
  averageConfirmationTime: number;
  fastestTransaction: number;
  slowestTransaction: number;
  pendingTransactions: number;
}

export function TransactionSpeedCard() {
  const [metrics, setMetrics] = useState<SpeedMetrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`${API_URL}/metrics/speed`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Speed metrics response:', data);
        setMetrics(data);
      } catch (error) {
        console.error('Failed to fetch speed metrics:', error);
      }
    };

    fetchMetrics();
    // Update more frequently during debugging
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 h-[200px] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading speed metrics...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6">
      <div className="flex items-center mb-4">
        <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Transaction Speed
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Average Confirmation
          </div>
          <div className="mt-2">
            <span className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
              {metrics.averageConfirmationTime.toFixed(2)}
            </span>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 ml-1">seconds</span>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Pending Transactions
          </div>
          <div className="mt-2">
            <span className="text-2xl font-semibold text-amber-700 dark:text-amber-300">
              {metrics.pendingTransactions}
            </span>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="text-sm font-medium text-green-700 dark:text-green-300">
            Fastest Transaction
          </div>
          <div className="mt-2">
            <span className="text-2xl font-semibold text-green-700 dark:text-green-300">
              {metrics.fastestTransaction.toFixed(2)}
            </span>
            <span className="text-sm text-green-600 dark:text-green-400 ml-1">seconds</span>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <div className="text-sm font-medium text-red-700 dark:text-red-300">
            Slowest Transaction
          </div>
          <div className="mt-2">
            <span className="text-2xl font-semibold text-red-700 dark:text-red-300">
              {metrics.slowestTransaction.toFixed(2)}
            </span>
            <span className="text-sm text-red-600 dark:text-red-400 ml-1">seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
} 