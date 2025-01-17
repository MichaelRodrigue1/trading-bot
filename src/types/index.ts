export interface ExchangeConfig {
  apiKey: string;
  secretKey: string;
  sandbox?: boolean;
}

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

export interface OrderBook {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  status: 'NEW' | 'FILLED' | 'CANCELLED';
  timestamp: number;
}