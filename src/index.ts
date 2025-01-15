import dotenv from 'dotenv';

dotenv.config();

class TradingBot {
  private isRunning: boolean = false;
  
  constructor() {
    console.log('Trading Bot initialized');
  }

  async start() {
    this.isRunning = true;
    console.log('Starting trading bot...');
    
    // TODO: Implement exchange connection
    // TODO: Add trading strategies
    // TODO: Setup market data monitoring
    
    while (this.isRunning) {
      await this.sleep(1000);
    }
  }

  stop() {
    this.isRunning = false;
    console.log('Trading bot stopped');
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