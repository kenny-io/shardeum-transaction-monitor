import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import { SummaryCard } from './components/SummaryCard';
import { GasMetricsCard } from './components/GasMetricsCard';
import { TransactionSpeedCard } from './components/TransactionSpeedCard';
import { API_URL } from './config/api';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';

interface MetricData {
  timestamp: number;
  value: number;
}


function App() {
  const [confirmationTimes, setConfirmationTimes] = useState<MetricData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const filterLastHourData = (data: MetricData[]) => {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    return data.filter(item => item.timestamp >= oneHourAgo);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const timesRes = await fetch(`${API_URL}/metrics/confirmation-times`);
        const times = await timesRes.json();
        setConfirmationTimes(filterLastHourData(times));
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <nav className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-white">
                  Shardeum Transaction Monitor
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <ThemeToggle />
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Transaction Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <SummaryCard />
            <TransactionSpeedCard />
          </div>

          {/* Gas Metrics Section */}
          <div className="mb-6">
            <GasMetricsCard />
          </div>

          {/* Confirmation Times Chart */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Confirmation Times</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">Last Hour</span>
            </div>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={confirmationTimes}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTime}
                    interval="preserveStartEnd"
                    stroke="#9CA3AF"
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <YAxis
                    label={{ 
                      value: 'Seconds', 
                      angle: -90, 
                      position: 'insideLeft',
                      className: "text-gray-600 dark:text-gray-400" 
                    }}
                    stroke="#9CA3AF"
                    className="text-gray-600 dark:text-gray-400"
                  />
                  <Tooltip
                    labelFormatter={formatTime}
                    formatter={(value: number) => [`${value.toFixed(2)}s`, 'Confirmation Time']}
                    contentStyle={{
                      backgroundColor: 'rgb(31 41 55)',
                      border: 'none',
                      borderRadius: '0.375rem',
                      color: '#fff'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#818CF8"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;