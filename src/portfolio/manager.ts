import { logger } from '../utils/logger';

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  side: 'LONG' | 'SHORT';
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: number;
  fee?: number;
}

export class PortfolioManager {
  private positions: Map<string, Position> = new Map();
  private trades: Trade[] = [];
  private initialBalance: number;
  private availableBalance: number;

  constructor(initialBalance: number) {
    this.initialBalance = initialBalance;
    this.availableBalance = initialBalance;
    logger.info(`Portfolio initialized with balance: $${initialBalance}`);
  }

  addTrade(trade: Trade): void {
    this.trades.push(trade);
    this.updatePosition(trade);
    
    const fee = trade.fee || 0;
    if (trade.side === 'BUY') {
      this.availableBalance -= (trade.quantity * trade.price + fee);
    } else {
      this.availableBalance += (trade.quantity * trade.price - fee);
    }

    logger.info(`Trade executed: ${trade.side} ${trade.quantity} ${trade.symbol} at $${trade.price}`);
  }

  private updatePosition(trade: Trade): void {
    const existing = this.positions.get(trade.symbol);
    
    if (!existing) {
      this.positions.set(trade.symbol, {
        symbol: trade.symbol,
        quantity: trade.side === 'BUY' ? trade.quantity : -trade.quantity,
        avgPrice: trade.price,
        currentPrice: trade.price,
        unrealizedPnL: 0,
        side: trade.side === 'BUY' ? 'LONG' : 'SHORT'
      });
    } else {
      if (trade.side === 'BUY') {
        const totalQuantity = existing.quantity + trade.quantity;
        existing.avgPrice = ((existing.avgPrice * existing.quantity) + (trade.price * trade.quantity)) / totalQuantity;
        existing.quantity = totalQuantity;
        existing.side = totalQuantity > 0 ? 'LONG' : 'SHORT';
      } else {
        existing.quantity -= trade.quantity;
        if (existing.quantity === 0) {
          this.positions.delete(trade.symbol);
          return;
        }
        existing.side = existing.quantity > 0 ? 'LONG' : 'SHORT';
      }
    }
  }

  updatePrice(symbol: string, currentPrice: number): void {
    const position = this.positions.get(symbol);
    if (position) {
      position.currentPrice = currentPrice;
      position.unrealizedPnL = (currentPrice - position.avgPrice) * position.quantity;
    }
  }

  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getTotalValue(): number {
    let totalValue = this.availableBalance;
    
    for (const position of this.positions.values()) {
      totalValue += position.currentPrice * position.quantity;
    }
    
    return totalValue;
  }

  getTotalPnL(): number {
    return this.getTotalValue() - this.initialBalance;
  }

  getAvailableBalance(): number {
    return this.availableBalance;
  }

  canAfford(symbol: string, quantity: number, price: number): boolean {
    const cost = quantity * price;
    const buffer = cost * 0.01; // 1% buffer for fees
    return this.availableBalance >= (cost + buffer);
  }

  getPortfolioSummary(): any {
    const positions = this.getAllPositions();
    const totalValue = this.getTotalValue();
    const totalPnL = this.getTotalPnL();
    
    return {
      totalValue: totalValue.toFixed(2),
      availableBalance: this.availableBalance.toFixed(2),
      totalPnL: totalPnL.toFixed(2),
      pnlPercentage: ((totalPnL / this.initialBalance) * 100).toFixed(2),
      positions: positions.length,
      trades: this.trades.length
    };
  }
}