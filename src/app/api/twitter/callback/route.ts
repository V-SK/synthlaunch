import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const CLIENT_ID = process.env.TWITTER_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
  const CALLBACK_URL = 'https://synthlaunch.fun/api/twitter/callback';

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.redirect('https://synthlaunch.fun/claim?twitter_error=config');
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`https://synthlaunch.fun/claim?twitter_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect('https://synthlaunch.fun/claim?twitter_error=missing_params');
  }

  // Verify state from cookie
  const oauthCookie = req.cookies.get('twitter_oauth')?.value;
  if (!oauthCookie) {
    return NextResponse.redirect('https://synthlaunch.fun/claim?twitter_error=no_cookie');
  }

  let oauthData: { state: string; codeVerifier: string };
  try {
    oauthData = JSON.parse(oauthCookie);
  } catch {
    return NextResponse.redirect('https://synthlaunch.fun/claim?twitter_error=invalid_cookie');
  }

  if (oauthData.state !== state) {
    return NextResponse.redirect('https://synthlaunch.fun/claim?twitter_error=state_mismatch');
  }

  // Exchange code for access token
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  let accessToken: string;
  try {
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CALLBACK_URL,
        code_verifier: oauthData.codeVerifier,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Twitter token exchange failed:', tokenRes.status, errBody);
      return NextResponse.redirect('https://synthlaunch.fun/claim?twitter_error=token_exchange');
    }

    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
  } catch (err) {
    console.error('Twitter token exchange error:', err);
    return NextResponse.redirect('https://synthlaunch.fun/claim?twitter_error=token_exchange');
  }

  // Get user info
  let username: string;
  try {
    const userRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      console.error('Twitter user fetch failed:', userRes.status);
      return NextResponse.redirect('https://synthlaunch.fun/claim?twitter_error=user_fetch');
    }

    const userData = await userRes.json();
    username = userData.data?.username;

    if (!username) {
      return NextResponse.redirect('https://synthlaunch.fun/claim?twitter_error=no_username');
    }
  } catch (err) {
    console.error('Twitter user fetch error:', err);
    return NextResponse.redirect('https://synthlaunch.fun/claim?twitter_error=user_fetch');
  }

  // Redirect to claim page with handle
  const redirectUrl = new URL('https://synthlaunch.fun/claim');
  redirectUrl.searchParams.set('twitter_verified', 'true');
  redirectUrl.searchParams.set('handle', username.toLowerCase());

  const response = NextResponse.redirect(redirectUrl.toString());

  // Clear oauth cookie
  response.cookies.set('twitter_oauth', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  // Set verified handle cookie (short-lived, 30 min)
  response.cookies.set('twitter_verified_handle', username.toLowerCase(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1800,
  });

  return response;
}
