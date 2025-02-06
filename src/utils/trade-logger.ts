import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Trade } from '../portfolio/manager';
import { TradingSignal } from '../strategies/sma-crossover';

export interface TradeLogEntry {
  timestamp: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  value: number;
  strategy: string;
  confidence: number;
  balance: number;
  pnl?: number;
}

export class TradeLogger {
  private logDir: string;
  private csvPath: string;
  private jsonPath: string;

  constructor(logDir: string = './logs') {
    this.logDir = logDir;
    this.csvPath = join(logDir, 'trades.csv');
    this.jsonPath = join(logDir, 'trades.json');
    
    this.ensureLogDirectory();
    this.initializeCSVFile();
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private initializeCSVFile(): void {
    if (!existsSync(this.csvPath)) {
      const header = 'timestamp,date,symbol,action,quantity,price,value,strategy,confidence,balance,pnl\n';
      writeFileSync(this.csvPath, header);
    }
  }

  logTrade(entry: TradeLogEntry): void {
    // Log to CSV
    const date = new Date(entry.timestamp).toISOString();
    const csvLine = [
      entry.timestamp,
      date,
      entry.symbol,
      entry.action,
      entry.quantity,
      entry.price,
      entry.value.toFixed(2),
      entry.strategy,
      entry.confidence.toFixed(4),
      entry.balance.toFixed(2),
      entry.pnl?.toFixed(2) || '0'
    ].join(',') + '\n';
    
    appendFileSync(this.csvPath, csvLine);

    // Log to JSON (append to array)
    this.appendToJSONLog(entry);
  }

  private appendToJSONLog(entry: TradeLogEntry): void {
    let trades: TradeLogEntry[] = [];
    
    if (existsSync(this.jsonPath)) {
      try {
        const data = require(this.jsonPath);
        trades = Array.isArray(data) ? data : [];
      } catch (error) {
        trades = [];
      }
    }
    
    trades.push(entry);
    writeFileSync(this.jsonPath, JSON.stringify(trades, null, 2));
  }

  logSignal(
    signal: TradingSignal, 
    symbol: string, 
    price: number, 
    strategy: string
  ): void {
    if (signal.action === 'HOLD') return;

    const signalLog = {
      timestamp: signal.timestamp,
      date: new Date(signal.timestamp).toISOString(),
      symbol,
      signal: signal.action,
      price,
      confidence: signal.confidence,
      strategy
    };

    const signalPath = join(this.logDir, 'signals.json');
    let signals: any[] = [];
    
    if (existsSync(signalPath)) {
      try {
        const data = require(signalPath);
        signals = Array.isArray(data) ? data : [];
      } catch (error) {
        signals = [];
      }
    }
    
    signals.push(signalLog);
    writeFileSync(signalPath, JSON.stringify(signals, null, 2));
  }

  getDailyStats(): any {
    if (!existsSync(this.jsonPath)) {
      return { trades: 0, volume: 0, pnl: 0 };
    }

    try {
      const trades: TradeLogEntry[] = require(this.jsonPath);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayTrades = trades.filter(trade => trade.timestamp >= today.getTime());
      
      const totalVolume = todayTrades.reduce((sum, trade) => sum + trade.value, 0);
      const totalPnL = todayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      
      return {
        trades: todayTrades.length,
        volume: totalVolume.toFixed(2),
        pnl: totalPnL.toFixed(2)
      };
    } catch (error) {
      return { trades: 0, volume: 0, pnl: 0 };
    }
  }

  getTradeHistory(days: number = 7): TradeLogEntry[] {
    if (!existsSync(this.jsonPath)) {
      return [];
    }

    try {
      const trades: TradeLogEntry[] = require(this.jsonPath);
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      return trades.filter(trade => trade.timestamp >= cutoff);
    } catch (error) {
      return [];
    }
  }
}