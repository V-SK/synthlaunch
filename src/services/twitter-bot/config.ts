export const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
export const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
export const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || '';
export const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET || '';

export const POLL_INTERVAL_MS = 60_000;
export const SEARCH_QUERY = '!发币 OR !launch';

export const PROCESSED_TWEETS_FILE = process.env.TWITTER_BOT_PROCESSED_FILE || '/tmp/synthlaunch-twitter-bot-processed.json';
export const MAX_PROCESSED_TWEETS = 2000;

export function getApiBaseUrl(): string {
  if (process.env.TWITTER_BOT_API_BASE_URL) return process.env.TWITTER_BOT_API_BASE_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
