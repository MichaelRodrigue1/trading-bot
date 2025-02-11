import { BaseExchange } from '../exchange/base';
import { PortfolioManager, Trade } from '../portfolio/manager';
import { RiskManager, RiskAssessment } from '../risk/manager';
import { TradeLogger, TradeLogEntry } from '../utils/trade-logger';
import { TradingSignal } from '../strategies/sma-crossover';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionResult {
  success: boolean;
  trade?: Trade;
  reason?: string;
}

export class TradeExecutor {
  private exchange: BaseExchange;
  private portfolio: PortfolioManager;
  private riskManager: RiskManager;
  private tradeLogger: TradeLogger;
  private isDryRun: boolean;

  constructor(
    exchange: BaseExchange,
    portfolio: PortfolioManager,
    riskManager: RiskManager,
    tradeLogger: TradeLogger,
    isDryRun: boolean = true
  ) {
    this.exchange = exchange;
    this.portfolio = portfolio;
    this.riskManager = riskManager;
    this.tradeLogger = tradeLogger;
    this.isDryRun = isDryRun;
  }

  async executeSignal(
    signal: TradingSignal,
    symbol: string,
    currentPrice: number,
    strategy: string
  ): Promise<ExecutionResult> {
    if (signal.action === 'HOLD') {
      return { success: false, reason: 'No action required' };
    }

    // Calculate position size based on confidence and available balance
    const positionSize = this.calculatePositionSize(signal, currentPrice);
    
    // Risk assessment
    const riskAssessment = this.riskManager.assessTradeRisk(
      symbol,
      signal.action,
      positionSize,
      currentPrice,
      this.portfolio
    );

    if (!riskAssessment.allowed) {
      logger.warn(`Trade blocked by risk manager: ${riskAssessment.reason}`);
      return { success: false, reason: riskAssessment.reason };
    }

    // Execute trade
    const trade: Trade = {
      id: uuidv4(),
      symbol,
      side: signal.action,
      quantity: riskAssessment.recommendedSize || positionSize,
      price: currentPrice,
      timestamp: signal.timestamp,
      fee: this.calculateFee(positionSize, currentPrice)
    };

    if (this.isDryRun) {
      return this.simulateTrade(trade, strategy, signal.confidence);
    } else {
      return this.executeLiveTrade(trade, strategy, signal.confidence);
    }
  }

  private calculatePositionSize(signal: TradingSignal, price: number): number {
    const availableBalance = this.portfolio.getAvailableBalance();
    const baseAmount = availableBalance * 0.1; // Use 10% of available balance as base
    const confidenceMultiplier = 0.5 + (signal.confidence * 0.5); // Scale from 0.5 to 1.0
    
    const positionValue = baseAmount * confidenceMultiplier;
    return positionValue / price;
  }

  private calculateFee(quantity: number, price: number): number {
    const tradeValue = quantity * price;
    return tradeValue * 0.001; // 0.1% fee (typical for crypto exchanges)
  }

  private simulateTrade(trade: Trade, strategy: string, confidence: number): ExecutionResult {
    // Add trade to portfolio
    this.portfolio.addTrade(trade);
    
    // Log the trade
    const logEntry: TradeLogEntry = {
      timestamp: trade.timestamp,
      symbol: trade.symbol,
      action: trade.side,
      quantity: trade.quantity,
      price: trade.price,
      value: trade.quantity * trade.price,
      strategy,
      confidence,
      balance: this.portfolio.getAvailableBalance(),
      pnl: 0 // Will be calculated later when position is closed
    };

    this.tradeLogger.logTrade(logEntry);
    
    logger.info(`DRY RUN: Executed ${trade.side} ${trade.quantity.toFixed(4)} ${trade.symbol} at $${trade.price}`);
    
    return { success: true, trade };
  }

  private async executeLiveTrade(trade: Trade, strategy: string, confidence: number): Promise<ExecutionResult> {
    try {
      // Place order on exchange
      const order = await this.exchange.placeOrder({
        symbol: trade.symbol,
        side: trade.side,
        type: 'MARKET',
        quantity: trade.quantity
      });

      if (order.status === 'FILLED') {
        // Update trade with actual execution details
        trade.price = order.price || trade.price;
        trade.id = order.id;

        // Add trade to portfolio
        this.portfolio.addTrade(trade);

        // Log the trade
        const logEntry: TradeLogEntry = {
          timestamp: trade.timestamp,
          symbol: trade.symbol,
          action: trade.side,
          quantity: trade.quantity,
          price: trade.price,
          value: trade.quantity * trade.price,
          strategy,
          confidence,
          balance: this.portfolio.getAvailableBalance()
        };

        this.tradeLogger.logTrade(logEntry);
        
        logger.info(`LIVE: Executed ${trade.side} ${trade.quantity.toFixed(4)} ${trade.symbol} at $${trade.price}`);
        
        return { success: true, trade };
      } else {
        logger.error(`Order not filled: ${order.status}`);
        return { success: false, reason: `Order status: ${order.status}` };
      }
    } catch (error) {
      logger.error('Live trade execution failed:', error);
      return { success: false, reason: `Execution failed: ${error}` };
    }
  }

  async checkStopLossOrders(): Promise<void> {
    const positions = this.portfolio.getAllPositions();
    
    for (const position of positions) {
      if (this.riskManager.checkStopLoss(position)) {
        logger.warn(`Stop loss triggered for ${position.symbol} at $${position.currentPrice}`);
        
        const signal: TradingSignal = {
          action: position.side === 'LONG' ? 'SELL' : 'BUY',
          confidence: 1.0,
          timestamp: Date.now()
        };

        await this.executeSignal(signal, position.symbol, position.currentPrice, 'STOP_LOSS');
      }

      if (this.riskManager.checkTakeProfit(position)) {
        logger.info(`Take profit triggered for ${position.symbol} at $${position.currentPrice}`);
        
        const signal: TradingSignal = {
          action: position.side === 'LONG' ? 'SELL' : 'BUY',
          confidence: 1.0,
          timestamp: Date.now()
        };

        await this.executeSignal(signal, position.symbol, position.currentPrice, 'TAKE_PROFIT');
      }
    }
  }
}