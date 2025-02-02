import { logger } from '../utils/logger';
import { PortfolioManager, Position } from '../portfolio/manager';

export interface RiskLimits {
  maxPositionSize: number; // % of portfolio
  maxDailyLoss: number; // % of portfolio
  stopLossPercent: number; // % from entry
  takeProfitPercent: number; // % from entry
  maxOpenPositions: number;
}

export interface RiskAssessment {
  allowed: boolean;
  reason?: string;
  recommendedSize?: number;
}

export class RiskManager {
  private limits: RiskLimits;
  private dailyPnL: number = 0;
  private dailyResetTime: number = 0;

  constructor(limits: RiskLimits) {
    this.limits = limits;
    this.resetDailyTracking();
    logger.info('Risk manager initialized with limits:', limits);
  }

  private resetDailyTracking(): void {
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    if (now > this.dailyResetTime) {
      this.dailyPnL = 0;
      this.dailyResetTime = today.getTime() + 24 * 60 * 60 * 1000;
    }
  }

  assessTradeRisk(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    portfolio: PortfolioManager
  ): RiskAssessment {
    this.resetDailyTracking();

    // Check daily loss limit
    const totalValue = portfolio.getTotalValue();
    const maxDailyLossAmount = totalValue * (this.limits.maxDailyLoss / 100);
    
    if (this.dailyPnL <= -maxDailyLossAmount) {
      return {
        allowed: false,
        reason: `Daily loss limit reached: $${Math.abs(this.dailyPnL).toFixed(2)}`
      };
    }

    // Check position size limit
    const tradeValue = quantity * price;
    const positionSizePercent = (tradeValue / totalValue) * 100;
    
    if (positionSizePercent > this.limits.maxPositionSize) {
      const maxAllowedValue = totalValue * (this.limits.maxPositionSize / 100);
      const recommendedQuantity = maxAllowedValue / price;
      
      return {
        allowed: false,
        reason: `Position size too large: ${positionSizePercent.toFixed(1)}% > ${this.limits.maxPositionSize}%`,
        recommendedSize: recommendedQuantity
      };
    }

    // Check max open positions
    const openPositions = portfolio.getAllPositions().length;
    if (openPositions >= this.limits.maxOpenPositions) {
      return {
        allowed: false,
        reason: `Maximum open positions reached: ${openPositions}/${this.limits.maxOpenPositions}`
      };
    }

    // Check if we can afford the trade
    if (side === 'BUY' && !portfolio.canAfford(symbol, quantity, price)) {
      return {
        allowed: false,
        reason: 'Insufficient balance for trade'
      };
    }

    return { allowed: true };
  }

  checkStopLoss(position: Position): boolean {
    if (position.side === 'LONG') {
      const lossPercent = ((position.avgPrice - position.currentPrice) / position.avgPrice) * 100;
      return lossPercent >= this.limits.stopLossPercent;
    } else {
      const lossPercent = ((position.currentPrice - position.avgPrice) / position.avgPrice) * 100;
      return lossPercent >= this.limits.stopLossPercent;
    }
  }

  checkTakeProfit(position: Position): boolean {
    if (position.side === 'LONG') {
      const profitPercent = ((position.currentPrice - position.avgPrice) / position.avgPrice) * 100;
      return profitPercent >= this.limits.takeProfitPercent;
    } else {
      const profitPercent = ((position.avgPrice - position.currentPrice) / position.avgPrice) * 100;
      return profitPercent >= this.limits.takeProfitPercent;
    }
  }

  updateDailyPnL(pnl: number): void {
    this.dailyPnL += pnl;
  }

  getRiskMetrics(portfolio: PortfolioManager): any {
    const totalValue = portfolio.getTotalValue();
    const positions = portfolio.getAllPositions();
    
    let totalExposure = 0;
    let largestPosition = 0;
    let positionsAtRisk = 0;

    for (const position of positions) {
      const positionValue = Math.abs(position.quantity * position.currentPrice);
      totalExposure += positionValue;
      
      if (positionValue > largestPosition) {
        largestPosition = positionValue;
      }

      if (this.checkStopLoss(position)) {
        positionsAtRisk++;
      }
    }

    return {
      totalExposure: ((totalExposure / totalValue) * 100).toFixed(1),
      largestPosition: ((largestPosition / totalValue) * 100).toFixed(1),
      openPositions: positions.length,
      dailyPnL: this.dailyPnL.toFixed(2),
      positionsAtRisk
    };
  }
}