import axios from 'axios';
import { createHmac } from 'crypto';
import { BaseExchange } from './base';
import { ExchangeConfig, MarketData, OrderBook, Order } from '../types';
import { logger } from '../utils/logger';

export class BinanceExchange extends BaseExchange {
  private baseURL: string;
  
  constructor(config: ExchangeConfig) {
    super(config);
    this.baseURL = config.sandbox 
      ? 'https://testnet.binance.vision/api'
      : 'https://api.binance.com/api';
  }

  async connect(): Promise<void> {
    if (!this.validateConfig()) {
      throw new Error('Invalid API configuration');
    }
    
    try {
      const response = await axios.get(`${this.baseURL}/v3/exchangeInfo`);
      if (response.status === 200) {
        this.isConnected = true;
        logger.info('Connected to Binance API');
      }
    } catch (error) {
      logger.error('Failed to connect to Binance:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    logger.info('Disconnected from Binance API');
  }

  async getMarketData(symbol: string): Promise<MarketData> {
    const response = await axios.get(
      `${this.baseURL}/v3/ticker/price?symbol=${symbol}`
    );
    
    return {
      symbol,
      price: parseFloat(response.data.price),
      volume: 0,
      timestamp: Date.now()
    };
  }

  async getOrderBook(symbol: string): Promise<OrderBook> {
    const response = await axios.get(
      `${this.baseURL}/v3/depth?symbol=${symbol}&limit=100`
    );
    
    return {
      symbol,
      bids: response.data.bids.map((bid: string[]) => [parseFloat(bid[0]), parseFloat(bid[1])]),
      asks: response.data.asks.map((ask: string[]) => [parseFloat(ask[0]), parseFloat(ask[1])]),
      timestamp: Date.now()
    };
  }

  async placeOrder(order: Partial<Order>): Promise<Order> {
    throw new Error('Order placement not implemented yet');
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    throw new Error('Order cancellation not implemented yet');
  }

  async getBalance(): Promise<Record<string, number>> {
    throw new Error('Balance retrieval not implemented yet');
  }

  private createSignature(queryString: string): string {
    return createHmac('sha256', this.config.secretKey)
      .update(queryString)
      .digest('hex');
  }
}