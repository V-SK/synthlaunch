import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

// In-memory store for verification codes (MVP — use Redis/DB in production)
const verificationCodes = new Map<string, { code: string; handle: string; createdAt: number }>();

// Clean up expired codes (older than 30 minutes)
function cleanup() {
  const now = Date.now();
  for (const [key, val] of Array.from(verificationCodes.entries())) {
    if (now - val.createdAt > 30 * 60 * 1000) {
      verificationCodes.delete(key);
    }
  }
}

// Generate a verification code for a Twitter handle
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 requests per minute per IP
    const ip = getClientIP(req);
    const rl = rateLimit(`twitter-verify:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { handle, action, tweetUrl: bodyTweetUrl } = await req.json();

    if (!handle || typeof handle !== 'string') {
      return NextResponse.json({ error: 'Missing handle' }, { status: 400 });
    }

    const cleanHandle = handle.replace('@', '').trim().toLowerCase();

    if (action === 'generate') {
      cleanup();
      const code = `synth-${crypto.randomBytes(4).toString('hex')}`;
      verificationCodes.set(cleanHandle, {
        code,
        handle: cleanHandle,
        createdAt: Date.now(),
      });

      const tweetText = `Verifying my identity for @Alice_BTC_AI SynthLaunch 🧬\n\n${code}\n\nsynthlaunch.fun`;

      return NextResponse.json({
        code,
        tweetUrl: `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`,
      });
    }

    if (action === 'verify') {
      const stored = verificationCodes.get(cleanHandle);
      if (!stored) {
        return NextResponse.json({ error: 'No verification code found. Generate one first.' }, { status: 400 });
      }

      // Check if code is expired (30 min)
      if (Date.now() - stored.createdAt > 30 * 60 * 1000) {
        verificationCodes.delete(cleanHandle);
        return NextResponse.json({ error: 'Verification code expired. Please generate a new one.' }, { status: 400 });
      }

      // Use tweetUrl from request body
      const tweetUrl = bodyTweetUrl;

      // Validate tweet URL if provided
      if (tweetUrl && !/^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/.test(tweetUrl)) {
        return NextResponse.json({ error: 'Invalid tweet URL format.' }, { status: 400 });
      }

      // Try to verify the tweet
      const verified = await checkTweetForCode(cleanHandle, stored.code, tweetUrl);

      if (verified) {
        return NextResponse.json({ verified: true, handle: cleanHandle });
      } else {
        return NextResponse.json({
          verified: false,
          error: tweetUrl 
            ? 'Could not verify the tweet. Make sure the tweet contains the verification code and is public.'
            : 'Verification tweet not found. Please paste your tweet URL to verify.',
          needsTweetUrl: !tweetUrl,
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action. Use "generate" or "verify".' }, { status: 400 });
  } catch (err) {
    console.error('Twitter verify error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function checkTweetForCode(handle: string, code: string, tweetUrl?: string): Promise<boolean> {
  try {
    // Method 1: oEmbed API with tweet URL (most reliable, no auth needed)
    if (tweetUrl) {
      try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
        const res = await fetch(oembedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data = await res.json();
          // oEmbed returns { html: "<blockquote>...</blockquote>" } containing tweet text
          if (data.html && data.html.includes(code)) {
            // Also verify the tweet author matches the handle
            const authorMatch = data.author_url?.toLowerCase().includes(handle.toLowerCase());
            if (authorMatch) return true;
          }
        }
      } catch (e) {
        console.error('oEmbed check failed:', e);
      }
    }

    // Method 2: Try syndication API as fallback (profile scrape)
    try {
      const syndicationUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`;
      const res = await fetch(syndicationUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const html = await res.text();
        if (html.includes(code)) return true;
      }
    } catch {
      // fallback failed
    }

    return false;
  } catch (err) {
    console.error('Tweet check error:', err);
    return false;
  }
}
