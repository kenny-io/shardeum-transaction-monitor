import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, PieChart } from 'lucide-react';
import { API_URL } from '../config/api';

interface TransactionCounts {
  success: number;
  failure: number;
  total: number;
  successRate: number;
}

export function SummaryCard() {
  const [stats, setStats] = useState<TransactionCounts | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/metrics/transaction-counts`);
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch success rate:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mt-6 h-[200px] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading statistics...</div>
      </div>
    );
  }

  const getStatusColor = (rate: number) => {
    if (rate >= 90) return 'text-green-500';
    if (rate >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Transaction Summary
        </h2>
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 sm:mt-0">
          Last 1 hour
        </span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <PieChart className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Success Rate</h3>
        </div>
        <div className={`text-4xl font-bold ${getStatusColor(stats.successRate)}`}>
          {stats.successRate}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Successful</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-semibold text-green-700 dark:text-green-300">{stats.success}</span>
            <span className="text-sm text-green-600 dark:text-green-400 ml-1">txns</span>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Failed</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-semibold text-red-700 dark:text-red-300">{stats.failure}</span>
            <span className="text-sm text-red-600 dark:text-red-400 ml-1">txns</span>
          </div>
        </div>        
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
          <span>Total Transactions</span>
          <span className="font-semibold text-gray-900 dark:text-white">{stats.total}</span>
        </div>
      </div>
    </div>
  );
} 