import fs from 'fs';
import { TwitterApi } from 'twitter-api-v2';
import { parseCommand } from './parser';
import { buildSuccessReply, replyToTweet, getTwitterClient } from './notifier';
import {
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET,
  POLL_INTERVAL_MS,
  SEARCH_QUERY,
  PROCESSED_TWEETS_FILE,
  MAX_PROCESSED_TWEETS,
  getApiBaseUrl,
} from './config';

// Rate limit: max tokens per user per day
const MAX_LAUNCHES_PER_USER_PER_DAY = 3;
const USER_LAUNCHES_FILE = '/tmp/synthlaunch-user-launches.json';

type UserLaunchRecord = { count: number; date: string };

function loadUserLaunches(): Record<string, UserLaunchRecord> {
  try {
    if (!fs.existsSync(USER_LAUNCHES_FILE)) return {};
    return JSON.parse(fs.readFileSync(USER_LAUNCHES_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveUserLaunches(data: Record<string, UserLaunchRecord>): void {
  try {
    fs.writeFileSync(USER_LAUNCHES_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('[TwitterBot] Failed to save user launches:', err);
  }
}

function getUserLaunchCount(userId: string): number {
  const data = loadUserLaunches();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const record = data[userId];
  if (!record || record.date !== today) return 0;
  return record.count;
}

function incrementUserLaunch(userId: string): void {
  const data = loadUserLaunches();
  const today = new Date().toISOString().slice(0, 10);
  const record = data[userId];
  if (!record || record.date !== today) {
    data[userId] = { count: 1, date: today };
  } else {
    data[userId].count += 1;
  }
  saveUserLaunches(data);
}

export type TwitterBotStatus = {
  running: boolean;
  lastRunAt?: string;
  lastError?: string;
  processedCount: number;
  lastSeenId?: string;
};

function maxTweetId(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return BigInt(a) > BigInt(b) ? a : b;
}

function compareTweetId(a: string, b: string): number {
  const aId = BigInt(a);
  const bId = BigInt(b);
  if (aId === bId) return 0;
  return aId < bId ? -1 : 1;
}

export class TwitterBot {
  private client: TwitterApi;
  private timer?: NodeJS.Timeout;
  private running = false;
  private inFlight = false;
  private processed = new Set<string>();
  private lastSeenId?: string;
  private lastRunAt?: string;
  private lastError?: string;

  constructor() {
    this.client = getTwitterClient();
    this.loadProcessed();
  }

  start(): void {
    if (this.running) return;

    if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
      throw new Error('Missing Twitter API credentials');
    }

    this.running = true;
    console.log('[TwitterBot] Starting polling...');
    void this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (!this.running) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.running = false;
    this.saveProcessed();
    console.log('[TwitterBot] Stopped polling.');
  }

  getStatus(): TwitterBotStatus {
    return {
      running: this.running,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
      processedCount: this.processed.size,
      lastSeenId: this.lastSeenId,
    };
  }

  private loadProcessed(): void {
    try {
      if (!fs.existsSync(PROCESSED_TWEETS_FILE)) return;
      const raw = JSON.parse(fs.readFileSync(PROCESSED_TWEETS_FILE, 'utf-8')) as {
        ids?: string[];
        lastSeenId?: string;
      };
      if (Array.isArray(raw.ids)) {
        raw.ids.forEach(id => this.processed.add(id));
      }
      if (raw.lastSeenId) this.lastSeenId = raw.lastSeenId;
    } catch (err) {
      console.warn('[TwitterBot] Failed to load processed tweet IDs:', err);
    }
  }

  private saveProcessed(): void {
    try {
      const payload = {
        ids: Array.from(this.processed),
        lastSeenId: this.lastSeenId,
      };
      fs.writeFileSync(PROCESSED_TWEETS_FILE, JSON.stringify(payload, null, 2));
    } catch (err) {
      console.warn('[TwitterBot] Failed to save processed tweet IDs:', err);
    }
  }

  private pruneProcessed(): void {
    if (this.processed.size <= MAX_PROCESSED_TWEETS) return;
    const removeCount = this.processed.size - MAX_PROCESSED_TWEETS;
    const ids = Array.from(this.processed);
    ids.slice(0, removeCount).forEach(id => this.processed.delete(id));
  }

  private markProcessed(id: string): void {
    this.processed.add(id);
    this.lastSeenId = maxTweetId(this.lastSeenId, id);
    this.pruneProcessed();
  }

  private async poll(): Promise<void> {
    if (this.inFlight || !this.running) return;
    this.inFlight = true;
    this.lastRunAt = new Date().toISOString();

    try {
      const params: { max_results: number; since_id?: string } = { max_results: 25 };
      if (this.lastSeenId) params.since_id = this.lastSeenId;

      console.log(`[TwitterBot] Searching tweets: ${SEARCH_QUERY}`);
      const search = await this.client.v2.search(SEARCH_QUERY, {
        ...params,
        expansions: ['author_id'],
        'tweet.fields': ['author_id'],
      });
      const tweets = [] as Array<{ id: string; text: string; authorId?: string }>;

      for await (const tweet of search) {
        tweets.push({ id: tweet.id, text: tweet.text, authorId: tweet.author_id });
      }

      if (tweets.length === 0) {
        return;
      }

      tweets.sort((a, b) => compareTweetId(a.id, b.id));

      for (const tweet of tweets) {
        if (this.processed.has(tweet.id)) continue;

        const parsed = parseCommand(tweet.text);
        if (!parsed) {
          console.warn(`[TwitterBot] Unable to parse command from tweet ${tweet.id}`);
          this.markProcessed(tweet.id);
          continue;
        }

        // Check user daily limit
        const authorId = tweet.authorId;
        if (authorId) {
          const userLaunchCount = getUserLaunchCount(authorId);
          if (userLaunchCount >= MAX_LAUNCHES_PER_USER_PER_DAY) {
            console.log(`[TwitterBot] User ${authorId} exceeded daily limit (${userLaunchCount}/${MAX_LAUNCHES_PER_USER_PER_DAY}), skipping tweet ${tweet.id}`);
            // Reply with rate limit message
            await replyToTweet(tweet.id, `⚠️ 每人每天最多发 ${MAX_LAUNCHES_PER_USER_PER_DAY} 个币，明天再来！\n\nDaily limit: ${MAX_LAUNCHES_PER_USER_PER_DAY} tokens per user. Try again tomorrow!`);
            this.markProcessed(tweet.id);
            continue;
          }
        }

        const { targetHandle, tokenName, symbol, taxRate } = parsed;
        console.log(`[TwitterBot] Launching token for @${targetHandle} from tweet ${tweet.id}`);

        const launchResult = await this.launchToken({
          targetHandle,
          tokenName: tokenName || `${targetHandle} Coin`,
          symbol: symbol || targetHandle.slice(0, 4).toUpperCase(),
          taxRate: taxRate ?? 2,
        });

        if (launchResult?.tokenAddress) {
          // Increment user launch count on success
          if (authorId) {
            incrementUserLaunch(authorId);
          }
          
          const reply = buildSuccessReply(
            launchResult.tokenAddress,
            launchResult.tokenName,
            launchResult.symbol,
            launchResult.taxRate,
            launchResult.targetHandle,
          );
          await replyToTweet(tweet.id, reply);
        }

        this.markProcessed(tweet.id);
      }

      this.saveProcessed();
    } catch (err) {
      console.error('[TwitterBot] Poll error:', err);
      this.lastError = err instanceof Error ? err.message : String(err);
    } finally {
      this.inFlight = false;
    }
  }

  private async launchToken(input: {
    targetHandle: string;
    tokenName: string;
    symbol: string;
    taxRate: number;
  }): Promise<{
    tokenAddress: string;
    tokenName: string;
    symbol: string;
    taxRate: number;
    targetHandle: string;
  } | null> {
    const baseUrl = getApiBaseUrl();
    const url = new URL('/api/launch', baseUrl).toString();
    const taxRateBps = Math.round(input.taxRate * 100);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'twitter',
          target_handle: input.targetHandle,
          token_name: input.tokenName,
          symbol: input.symbol,
          tax_rate: input.taxRate,
          tax_rate_bps: taxRateBps,
        }),
        signal: AbortSignal.timeout(120_000), // 2 minutes for salt mining
      });

      const text = await res.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        console.error('[TwitterBot] Failed to parse /api/launch response:', parseErr);
      }

      if (!res.ok) {
        console.error(`[TwitterBot] Launch failed (${res.status}):`, data || text);
        return null;
      }

      const tokenAddress =
        (data?.token_address as string) ||
        (data?.tokenAddress as string) ||
        (data?.address as string);

      if (!tokenAddress) {
        console.error('[TwitterBot] Launch response missing token address:', data);
        return null;
      }

      return {
        tokenAddress,
        tokenName: input.tokenName,
        symbol: input.symbol,
        taxRate: input.taxRate,
        targetHandle: input.targetHandle,
      };
    } catch (err) {
      console.error('[TwitterBot] Launch request error:', err);
      return null;
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __twitterBotInstance: TwitterBot | undefined;
}

export function getTwitterBot(): TwitterBot {
  if (!globalThis.__twitterBotInstance) {
    globalThis.__twitterBotInstance = new TwitterBot();
  }
  return globalThis.__twitterBotInstance;
}
