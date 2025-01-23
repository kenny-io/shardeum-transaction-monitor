# Shardeum Transaction Monitor

A real-time monitoring system for tracking transaction performance and gas usage on the Shardeum network. This tool helps monitor the state of transactions on the Shardeum network through continuous automated transactions.

## Features

- Real-time transaction monitoring
- Automatic wallet rotation (hourly)
- Gas price tracking
- Transaction speed metrics
- Success rate monitoring
- Prometheus metrics export
- Intuitive UI

## Prerequisites

- Node.js v18+
- npm or yarn
- Two funded wallets for transaction monitoring

## Installation

1. Clone the repository:

```bash
git clone https://github.com/your-repo/shardeum-transaction-monitor.git
cd shardeum-transaction-monitor
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your private keys and other configuration:
```bash
cp .env.example .env
```

## Usage

1. Start the development server:
```bash
npm run dev
```

This will start:
- Backend server on port 3000
- Frontend development server on port 5173

## Monitoring Endpoints

- `/health` - Service health check
- `/metrics` - Prometheus metrics
- `/api/metrics/gas` - Gas usage metrics
- `/api/metrics/speed` - Transaction speed metrics
- `/api/metrics/transaction-counts` - Transaction success/failure counts
- `/api/metrics/confirmation-times` - Transaction confirmation times

## Architecture

- Frontend: React + Vite + TailwindCSS
- Backend: Express.js
- Blockchain Interaction: ethers.js
- Metrics: Prometheus client
- State Management: React hooks

## Prometheus Integration

The service exposes metrics in Prometheus format at `/metrics`. Configure your Prometheus instance using:

```
scrape_configs:
  - job_name: 'prometheus-metrics'
    static_configs:
      - targets: ['localhost:3000']
        labels:
          __metrics_path__: '/metrics'
```


## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
