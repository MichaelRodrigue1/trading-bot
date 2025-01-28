# Cryptocurrency Trading Bot

A simple automated trading bot for cryptocurrency markets using technical analysis strategies.

## Features

- Binance API integration
- Technical indicators (SMA, EMA, RSI, MACD)
- SMA crossover trading strategy
- Dry run mode for testing
- Configurable logging

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment template:
   ```bash
   cp .env.example .env
   ```

4. Configure your API keys in `.env`:
   ```
   BINANCE_API_KEY=your_api_key
   BINANCE_SECRET_KEY=your_secret_key
   TRADING_PAIR=BTCUSDT
   DRY_RUN=true
   ```

5. Build and run:
   ```bash
   npm run build
   npm start
   ```

   Or run in development mode:
   ```bash
   npm run dev
   ```

## Configuration

- `DRY_RUN`: Set to `true` for testing without real trades
- `TRADING_PAIR`: The cryptocurrency pair to trade (e.g., BTCUSDT)
- `LOG_LEVEL`: Set logging level (debug, info, warn, error)

## Strategies

Currently implements:
- **SMA Crossover**: Buys when fast SMA crosses above slow SMA, sells when it crosses below

## Disclaimer

This software is for educational purposes only. Use at your own risk. Cryptocurrency trading involves significant financial risk.