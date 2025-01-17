import { ExchangeConfig, MarketData, OrderBook, Order } from '../types';

export abstract class BaseExchange {
  protected config: ExchangeConfig;
  protected isConnected: boolean = false;

  constructor(config: ExchangeConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getMarketData(symbol: string): Promise<MarketData>;
  abstract getOrderBook(symbol: string): Promise<OrderBook>;
  abstract placeOrder(order: Partial<Order>): Promise<Order>;
  abstract cancelOrder(orderId: string): Promise<boolean>;
  abstract getBalance(): Promise<Record<string, number>>;

  protected validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.secretKey);
  }

  public isConnectionActive(): boolean {
    return this.isConnected;
  }
}