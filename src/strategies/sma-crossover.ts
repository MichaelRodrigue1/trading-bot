import { TechnicalIndicators } from '../indicators';
import { MarketData } from '../types';
import { logger } from '../utils/logger';

export interface TradingSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: number;
}

export class SMACrossoverStrategy {
  private priceHistory: number[] = [];
  private fastPeriod: number;
  private slowPeriod: number;
  private maxHistorySize: number = 200;

  constructor(fastPeriod: number = 10, slowPeriod: number = 20) {
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
  }

  addPriceData(marketData: MarketData): TradingSignal {
    this.priceHistory.push(marketData.price);
    
    if (this.priceHistory.length > this.maxHistorySize) {
      this.priceHistory = this.priceHistory.slice(-this.maxHistorySize);
    }

    if (this.priceHistory.length < this.slowPeriod) {
      return {
        action: 'HOLD',
        confidence: 0,
        timestamp: marketData.timestamp
      };
    }

    return this.generateSignal(marketData.timestamp);
  }

  private generateSignal(timestamp: number): TradingSignal {
    const fastSMA = TechnicalIndicators.calculateSMA(this.priceHistory, this.fastPeriod);
    const slowSMA = TechnicalIndicators.calculateSMA(this.priceHistory, this.slowPeriod);

    if (fastSMA.length < 2 || slowSMA.length < 2) {
      return { action: 'HOLD', confidence: 0, timestamp };
    }

    const currentFast = fastSMA[fastSMA.length - 1];
    const previousFast = fastSMA[fastSMA.length - 2];
    const currentSlow = slowSMA[slowSMA.length - 1];
    const previousSlow = slowSMA[slowSMA.length - 2];

    const wasBelowSlow = previousFast <= previousSlow;
    const isAboveSlow = currentFast > currentSlow;
    const wasAboveSlow = previousFast >= previousSlow;
    const isBelowSlow = currentFast < currentSlow;

    if (wasBelowSlow && isAboveSlow) {
      const confidence = Math.min(((currentFast - currentSlow) / currentSlow) * 100, 1.0);
      logger.info(`SMA Crossover: BULLISH signal detected (confidence: ${confidence.toFixed(2)})`);
      return { action: 'BUY', confidence, timestamp };
    }

    if (wasAboveSlow && isBelowSlow) {
      const confidence = Math.min(((currentSlow - currentFast) / currentFast) * 100, 1.0);
      logger.info(`SMA Crossover: BEARISH signal detected (confidence: ${confidence.toFixed(2)})`);
      return { action: 'SELL', confidence, timestamp };
    }

    return { action: 'HOLD', confidence: 0, timestamp };
  }

  getIndicatorValues(): { fast: number[], slow: number[] } {
    if (this.priceHistory.length < this.slowPeriod) {
      return { fast: [], slow: [] };
    }

    return {
      fast: TechnicalIndicators.calculateSMA(this.priceHistory, this.fastPeriod),
      slow: TechnicalIndicators.calculateSMA(this.priceHistory, this.slowPeriod)
    };
  }
}