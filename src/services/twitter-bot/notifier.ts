import { TwitterApi } from 'twitter-api-v2';
import {
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET,
} from './config';

let client: TwitterApi | null = null;

function getTwitterClient(): TwitterApi {
  if (client) return client;
  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    throw new Error('Missing Twitter API credentials');
  }
  client = new TwitterApi({
    appKey: TWITTER_API_KEY,
    appSecret: TWITTER_API_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_SECRET,
  });
  return client;
}

export async function replyToTweet(tweetId: string, message: string): Promise<boolean> {
  try {
    const api = getTwitterClient();
    await api.v2.reply(message, tweetId);
    console.log(`[TwitterBot] Replied to tweet ${tweetId}`);
    return true;
  } catch (err) {
    console.error(`[TwitterBot] Failed to reply to tweet ${tweetId}:`, err);
    return false;
  }
}

export function buildSuccessReply(
  tokenAddress: string,
  tokenName: string,
  symbol: string,
  taxRate: number,
  targetHandle: string,
): string {
  const cleanHandle = targetHandle.replace('@', '');
  return [
    '✅ 发币成功！',
    `代币名: ${tokenName}`,
    `符号: $${symbol}`,
    `合约: ${tokenAddress}`,
    `税率: ${taxRate}%`,
    `@${cleanHandle} 14天内来认领 👉 synthlaunch.fun/claim`,
  ].join('\n');
}

export { getTwitterClient };
