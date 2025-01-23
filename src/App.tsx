import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import { SuccessRateCard } from './components/SuccessRateCard';
import { GasMetricsCard } from './components/GasMetricsCard';
import { TransactionSpeedCard } from './components/TransactionSpeedCard';

interface MetricData {
  timestamp: number;
  value: number;
}

// Get the API URL from environment variables
const API_URL = import.meta.env.VITE_PUBLIC_API_URL || 'http://localhost:3001/api';

function App() {
  const [confirmationTimes, setConfirmationTimes] = useState<MetricData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const filterLastHourData = (data: MetricData[]) => {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    return data.filter(item => item.timestamp >= oneHourAgo);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const timesRes = await fetch(`${API_URL}/metrics/confirmation-times`);
        if (!timesRes.ok) {
          throw new Error(`HTTP error! status: ${timesRes.status}`);
        }
        const times = await timesRes.json();
        setConfirmationTimes(filterLastHourData(times));
        setLastUpdate(new Date());
        setError(null);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        setError('Failed to fetch metrics. Please check your connection.');
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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">Shardeum Transaction Monitor</span>
            </div>
            <div className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Transaction Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SuccessRateCard apiUrl={API_URL} />
          <TransactionSpeedCard apiUrl={API_URL} />
        </div>

        {/* Gas Metrics Section */}
        <div className="mb-6">
          <GasMetricsCard apiUrl={API_URL} />
        </div>

        {/* Confirmation Times Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Confirmation Times (Last Hour)</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={confirmationTimes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  interval="preserveStartEnd"
                />
                <YAxis
                  label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  labelFormatter={formatTime}
                  formatter={(value: number) => [`${value.toFixed(2)}s`, 'Confirmation Time']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;