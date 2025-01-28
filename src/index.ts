import dotenv from 'dotenv';
import { BinanceExchange } from './exchange/binance';
import { SMACrossoverStrategy } from './strategies/sma-crossover';
import { logger } from './utils/logger';

dotenv.config();

class TradingBot {
  private isRunning: boolean = false;
  private exchange: BinanceExchange;
  private strategy: SMACrossoverStrategy;
  
  constructor() {
    const config = {
      apiKey: process.env.BINANCE_API_KEY || '',
      secretKey: process.env.BINANCE_SECRET_KEY || '',
      sandbox: process.env.NODE_ENV !== 'production'
    };
    
    this.exchange = new BinanceExchange(config);
    
    const fastPeriod = parseInt(process.env.EMA_FAST || '12');
    const slowPeriod = parseInt(process.env.EMA_SLOW || '26');
    this.strategy = new SMACrossoverStrategy(fastPeriod, slowPeriod);
    
    logger.info('Trading Bot initialized');
  }

  async start() {
    this.isRunning = true;
    logger.info('Starting trading bot...');
    
    try {
      await this.exchange.connect();
      
      const tradingPair = process.env.TRADING_PAIR || 'BTCUSDT';
      const isDryRun = process.env.DRY_RUN === 'true';
      
      while (this.isRunning) {
        const marketData = await this.exchange.getMarketData(tradingPair);
        logger.debug(`${tradingPair} price: $${marketData.price}`);
        
        const signal = this.strategy.addPriceData(marketData);
        
        if (signal.action !== 'HOLD') {
          logger.info(`Trading signal: ${signal.action} (confidence: ${signal.confidence.toFixed(2)})`);
          
          if (!isDryRun && process.env.TRADING_ENABLED === 'true') {
            // TODO: Implement actual trading logic
            logger.info('Would execute trade here in live mode');
          } else {
            logger.info(`DRY RUN: Would ${signal.action} ${tradingPair}`);
          }
        }
        
        await this.sleep(30000); // Check every 30 seconds
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