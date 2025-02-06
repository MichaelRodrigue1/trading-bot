import { TechnicalIndicators } from '../indicators';
import { MarketData } from '../types';
import { TradingSignal } from './sma-crossover';
import { logger } from '../utils/logger';

export class RSIStrategy {
  private priceHistory: number[] = [];
  private period: number;
  private oversoldLevel: number;
  private overboughtLevel: number;
  private maxHistorySize: number = 100;
  private lastSignal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

  constructor(
    period: number = 14, 
    oversoldLevel: number = 30, 
    overboughtLevel: number = 70
  ) {
    this.period = period;
    this.oversoldLevel = oversoldLevel;
    this.overboughtLevel = overboughtLevel;
    
    logger.info(`RSI Strategy initialized: period=${period}, oversold=${oversoldLevel}, overbought=${overboughtLevel}`);
  }

  addPriceData(marketData: MarketData): TradingSignal {
    this.priceHistory.push(marketData.price);
    
    if (this.priceHistory.length > this.maxHistorySize) {
      this.priceHistory = this.priceHistory.slice(-this.maxHistorySize);
    }

    if (this.priceHistory.length < this.period + 1) {
      return {
        action: 'HOLD',
        confidence: 0,
        timestamp: marketData.timestamp
      };
    }

    return this.generateSignal(marketData.timestamp);
  }

  private generateSignal(timestamp: number): TradingSignal {
    const rsiValues = TechnicalIndicators.calculateRSI(this.priceHistory, this.period);
    
    if (rsiValues.length < 2) {
      return { action: 'HOLD', confidence: 0, timestamp };
    }

    const currentRSI = rsiValues[rsiValues.length - 1];
    const previousRSI = rsiValues[rsiValues.length - 2];

    // RSI oversold condition (potential buy signal)
    if (currentRSI <= this.oversoldLevel && previousRSI > this.oversoldLevel && this.lastSignal !== 'BUY') {
      const confidence = Math.min((this.oversoldLevel - currentRSI) / this.oversoldLevel, 1.0);
      this.lastSignal = 'BUY';
      
      logger.info(`RSI Strategy: OVERSOLD signal - RSI: ${currentRSI.toFixed(2)} (confidence: ${confidence.toFixed(2)})`);
      
      return {
        action: 'BUY',
        confidence,
        timestamp
      };
    }

    // RSI overbought condition (potential sell signal)
    if (currentRSI >= this.overboughtLevel && previousRSI < this.overboughtLevel && this.lastSignal !== 'SELL') {
      const confidence = Math.min((currentRSI - this.overboughtLevel) / (100 - this.overboughtLevel), 1.0);
      this.lastSignal = 'SELL';
      
      logger.info(`RSI Strategy: OVERBOUGHT signal - RSI: ${currentRSI.toFixed(2)} (confidence: ${confidence.toFixed(2)})`);
      
      return {
        action: 'SELL',
        confidence,
        timestamp
      };
    }

    // Reset signal state when RSI returns to neutral zone
    if (currentRSI > this.oversoldLevel && currentRSI < this.overboughtLevel) {
      if (this.lastSignal !== 'HOLD') {
        this.lastSignal = 'HOLD';
        logger.debug(`RSI Strategy: Returned to neutral zone - RSI: ${currentRSI.toFixed(2)}`);
      }
    }

    return { action: 'HOLD', confidence: 0, timestamp };
  }

  getCurrentRSI(): number | null {
    if (this.priceHistory.length < this.period + 1) {
      return null;
    }

    const rsiValues = TechnicalIndicators.calculateRSI(this.priceHistory, this.period);
    return rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null;
  }

  getStrategyState(): any {
    const currentRSI = this.getCurrentRSI();
    
    return {
      currentRSI: currentRSI?.toFixed(2) || 'N/A',
      oversoldLevel: this.oversoldLevel,
      overboughtLevel: this.overboughtLevel,
      lastSignal: this.lastSignal,
      priceDataPoints: this.priceHistory.length
    };
  }
}