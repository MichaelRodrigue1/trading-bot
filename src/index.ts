import dotenv from 'dotenv';
import { BinanceExchange } from './exchange/binance';
import { SMACrossoverStrategy } from './strategies/sma-crossover';
import { RSIStrategy } from './strategies/rsi-strategy';
import { PortfolioManager } from './portfolio/manager';
import { RiskManager, RiskLimits } from './risk/manager';
import { TradeExecutor } from './execution/trade-executor';
import { TradeLogger } from './utils/trade-logger';
import { logger } from './utils/logger';

dotenv.config();

class TradingBot {
  private isRunning: boolean = false;
  private exchange: BinanceExchange;
  private strategy: SMACrossoverStrategy | RSIStrategy;
  private portfolio: PortfolioManager;
  private riskManager: RiskManager;
  private executor: TradeExecutor;
  private tradeLogger: TradeLogger;
  private isDryRun: boolean;
  
  constructor() {
    const config = {
      apiKey: process.env.BINANCE_API_KEY || '',
      secretKey: process.env.BINANCE_SECRET_KEY || '',
      sandbox: process.env.NODE_ENV !== 'production'
    };
    
    this.exchange = new BinanceExchange(config);
    this.isDryRun = process.env.DRY_RUN === 'true';
    
    // Initialize portfolio
    const initialBalance = parseFloat(process.env.INITIAL_BALANCE || '1000');
    this.portfolio = new PortfolioManager(initialBalance);
    
    // Initialize risk management
    const riskLimits: RiskLimits = {
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '20'),
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '5'),
      stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '3'),
      takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT || '6'),
      maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '3')
    };
    this.riskManager = new RiskManager(riskLimits);
    
    // Initialize trade logger
    this.tradeLogger = new TradeLogger();
    
    // Initialize strategy based on config
    const strategyType = process.env.STRATEGY || 'SMA';
    if (strategyType === 'RSI') {
      const period = parseInt(process.env.RSI_PERIOD || '14');
      const oversold = parseInt(process.env.RSI_OVERSOLD || '30');
      const overbought = parseInt(process.env.RSI_OVERBOUGHT || '70');
      this.strategy = new RSIStrategy(period, oversold, overbought);
    } else {
      const fastPeriod = parseInt(process.env.EMA_FAST || '12');
      const slowPeriod = parseInt(process.env.EMA_SLOW || '26');
      this.strategy = new SMACrossoverStrategy(fastPeriod, slowPeriod);
    }
    
    // Initialize trade executor
    this.executor = new TradeExecutor(
      this.exchange,
      this.portfolio,
      this.riskManager,
      this.tradeLogger,
      this.isDryRun
    );
    
    logger.info(`Trading Bot initialized with ${strategyType} strategy`);
  }

  async start() {
    this.isRunning = true;
    logger.info('Starting trading bot...');
    
    try {
      await this.exchange.connect();
      
      const tradingPair = process.env.TRADING_PAIR || 'BTCUSDT';
      const strategyName = process.env.STRATEGY || 'SMA';
      let iterationCount = 0;
      
      while (this.isRunning) {
        const marketData = await this.exchange.getMarketData(tradingPair);
        
        // Update portfolio with current prices
        this.portfolio.updatePrice(tradingPair, marketData.price);
        
        // Generate trading signal
        const signal = this.strategy.addPriceData(marketData);
        
        // Log signal for analysis
        this.tradeLogger.logSignal(signal, tradingPair, marketData.price, strategyName);
        
        // Execute signal if not HOLD
        if (signal.action !== 'HOLD') {
          logger.info(`Trading signal: ${signal.action} (confidence: ${signal.confidence.toFixed(2)})`);
          
          const result = await this.executor.executeSignal(
            signal,
            tradingPair,
            marketData.price,
            strategyName
          );
          
          if (result.success) {
            logger.info('Trade executed successfully');
          } else {
            logger.warn(`Trade not executed: ${result.reason}`);
          }
        }
        
        // Check stop loss/take profit every 10 iterations
        if (iterationCount % 10 === 0) {
          await this.executor.checkStopLossOrders();
          
          // Log portfolio summary
          const summary = this.portfolio.getPortfolioSummary();
          const riskMetrics = this.riskManager.getRiskMetrics(this.portfolio);
          const dailyStats = this.tradeLogger.getDailyStats();
          
          logger.info(`Portfolio: $${summary.totalValue} | PnL: ${summary.pnlPercentage}% | Trades today: ${dailyStats.trades}`);
          logger.debug(`Risk: Exposure ${riskMetrics.totalExposure}% | Positions: ${riskMetrics.openPositions}/${riskMetrics.maxOpenPositions}`);
        }
        
        iterationCount++;
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