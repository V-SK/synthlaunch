import { NextResponse } from 'next/server';
import crypto from 'crypto';

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function GET() {
  const CLIENT_ID = process.env.TWITTER_CLIENT_ID;
  const CALLBACK_URL = 'https://synthlaunch.fun/api/twitter/callback';

  if (!CLIENT_ID) {
    return NextResponse.json({ error: 'Missing TWITTER_CLIENT_ID' }, { status: 500 });
  }

  // Generate PKCE values
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(16));

  // Store in httpOnly cookie
  const oauthData = JSON.stringify({ state, codeVerifier });

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', CALLBACK_URL);
  authUrl.searchParams.set('scope', 'users.read tweet.read');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set('twitter_oauth', oauthData, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  return response;
}
