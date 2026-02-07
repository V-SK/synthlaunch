import { TwitterBot } from '../src/services/twitter-bot';

const bot = new TwitterBot();

function shutdown() {
  console.log('[TwitterBot] Shutting down...');
  bot.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bot.start();
