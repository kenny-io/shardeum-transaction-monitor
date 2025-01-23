import { useState, useEffect } from 'react';
import { Fuel } from 'lucide-react';

interface GasMetrics {
  averageGasPrice: number;
  totalGasUsed: number;
}

const API_URL = process.env.NODE_ENV === 'production' 
  ? `${import.meta.env.VITE_API_URL}`
  : 'http://localhost:3000/api';

export function GasMetricsCard() {
  const [metrics, setMetrics] = useState<GasMetrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`${API_URL}/metrics/gas`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        const newMetrics = {
          averageGasPrice: (Number(data.averageGasPrice) || 0) * 1e9,
          totalGasUsed: (Number(data.totalGasUsed) || 0) * 1e9
        };
        
        setMetrics(newMetrics);
      } catch (error) {
        console.error('Failed to fetch gas metrics:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6 h-[200px] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading gas metrics...</div>
      </div>
    );
  }

  const formatGasValue = (value: number) => {
    const roundedValue = Math.round(value * 100) / 100;
    
    if (roundedValue === 0) return '0';
    
    if (roundedValue >= 1_000_000) {
      return `${(roundedValue / 1_000_000).toFixed(2)}M`;
    }
    if (roundedValue >= 1_000) {
      return `${(roundedValue / 1_000).toFixed(2)}K`;
    }
    return roundedValue.toFixed(2);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-4">
        <Fuel className="h-6 w-6 text-indigo-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900">Gas Metrics</h2>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm font-medium text-purple-700">Average Gas Price</div>
          <div className="mt-2">
            <span className="text-2xl font-semibold text-purple-700">
              {formatGasValue(metrics.averageGasPrice)}
            </span>
            <span className="text-sm text-purple-600 ml-1">nano Gwei</span>
          </div>
          <div className="text-xs text-purple-500 mt-1">
            ≈ {(metrics.averageGasPrice / 1e9).toFixed(9)} Gwei
          </div>
        </div>

        <div className="bg-indigo-50 rounded-lg p-4">
          <div className="text-sm font-medium text-indigo-700">Total Gas Used</div>
          <div className="mt-2">
            <span className="text-2xl font-semibold text-indigo-700">
              {formatGasValue(metrics.totalGasUsed)}
            </span>
            <span className="text-sm text-indigo-600 ml-1">nano Gwei</span>
          </div>
          <div className="text-xs text-indigo-500 mt-1">
            ≈ {(metrics.totalGasUsed / 1e9).toFixed(9)} Gwei
          </div>
        </div>
      </div>
    </div>
  );
}