import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { rateLimit, getClientIP } from '@/lib/rateLimit';

// In-memory store for verification codes (MVP — use Redis/DB in production)
const verificationCodes = new Map<string, { code: string; handle: string; createdAt: number }>();

// Clean up expired codes (older than 30 minutes)
function cleanup() {
  const now = Date.now();
  for (const [key, val] of verificationCodes) {
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

    const { handle, action } = await req.json();

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

      // Try to fetch user's tweets and find the code
      const verified = await checkTweetForCode(cleanHandle, stored.code);

      if (verified) {
        // Don't delete code yet — they might need to retry bind wallet
        return NextResponse.json({ verified: true, handle: cleanHandle });
      } else {
        return NextResponse.json({
          verified: false,
          error: 'Verification tweet not found. Make sure you posted the tweet and try again in a few seconds.',
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action. Use "generate" or "verify".' }, { status: 400 });
  } catch (err) {
    console.error('Twitter verify error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function checkTweetForCode(handle: string, code: string): Promise<boolean> {
  try {
    // Method 1: Try Twitter syndication API (no auth needed)
    const syndicationUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`;
    const res = await fetch(syndicationUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const html = await res.text();
      if (html.includes(code)) {
        return true;
      }
    }

    // Method 2: Try nitter instances
    const nitterInstances = [
      `https://nitter.net/${handle}`,
      `https://nitter.privacydev.net/${handle}`,
    ];

    for (const url of nitterInstances) {
      try {
        const nRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (nRes.ok) {
          const html = await nRes.text();
          if (html.includes(code)) {
            return true;
          }
        }
      } catch {
        // Try next instance
      }
    }

    return false;
  } catch (err) {
    console.error('Tweet check error:', err);
    return false;
  }
}
