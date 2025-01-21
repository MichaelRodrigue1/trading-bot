import dotenv from 'dotenv';
import { BinanceExchange } from './exchange/binance';
import { logger } from './utils/logger';

dotenv.config();

class TradingBot {
  private isRunning: boolean = false;
  private exchange: BinanceExchange;
  
  constructor() {
    const config = {
      apiKey: process.env.BINANCE_API_KEY || '',
      secretKey: process.env.BINANCE_SECRET_KEY || '',
      sandbox: process.env.NODE_ENV !== 'production'
    };
    
    this.exchange = new BinanceExchange(config);
    logger.info('Trading Bot initialized');
  }

  async start() {
    this.isRunning = true;
    logger.info('Starting trading bot...');
    
    try {
      await this.exchange.connect();
      
      const tradingPair = process.env.TRADING_PAIR || 'BTCUSDT';
      
      while (this.isRunning) {
        if (process.env.DRY_RUN === 'true') {
          const marketData = await this.exchange.getMarketData(tradingPair);
          logger.info(`${tradingPair} price: $${marketData.price}`);
        }
        
        await this.sleep(5000);
      }
    } catch (error) {
      logger.error('Trading bot error:', error);
      this.stop();
    }
  }

  stop() {
    this.isRunning = false;
    this.exchange.disconnect();
    logger.info('Trading bot stopped');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

if (require.main === module) {
  const bot = new TradingBot();
  
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    bot.stop();
    process.exit(0);
  });
  
  bot.start().catch(console.error);
}