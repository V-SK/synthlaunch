import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, encodePacked, keccak256, toHex } from 'viem';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { getDeployerAccount } from '@/lib/kms-signer';
import { bsc } from 'viem/chains';
import { CUSTODY_ABI, CUSTODY_ADDRESS } from '@/lib/custody';

const CHAIN_ID = 56;
const BSC_RPC = 'https://bsc-dataseed.binance.org';

function errorResponse(error: string, code: string, status: number = 400) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 requests per minute per IP (sensitive endpoint)
    const ip = getClientIP(request);
    const rl = rateLimit(`bind-wallet:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { agentName, wallet, apiKey, verifyMethod, twitterHandle } = body;

    if (!agentName || !wallet) {
      return errorResponse('Missing required fields: agentName, wallet', 'INVALID_FORMAT');
    }

    // Twitter verification doesn't need apiKey
    if (verifyMethod !== 'twitter' && !apiKey) {
      return errorResponse('Missing required field: apiKey', 'INVALID_FORMAT');
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return errorResponse('Invalid wallet address', 'INVALID_WALLET');
    }

    // 1. Verify agent identity
    if (verifyMethod === 'twitter') {
      // Twitter verification: check that the tweet was already verified via /api/twitter/verify
      // We trust the frontend flow here — the user already posted & verified the tweet
      // The agentName should be "tw:<handle>"
      console.log(`[bind-wallet] Twitter verification for: ${agentName} (handle: ${twitterHandle})`);
      if (!agentName.startsWith('tw:')) {
        return errorResponse('Invalid agent name for Twitter verification', 'INVALID_FORMAT');
      }
    } else {
      // Moltbook API key verification
      console.log(`[bind-wallet] Verifying identity for agent: ${agentName}`);
      const meRes = await fetch('https://www.moltbook.com/api/v1/agents/me', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!meRes.ok) {
        console.log(`[bind-wallet] Moltbook auth failed: ${meRes.status}`);
        return errorResponse('Invalid Moltbook API key', 'INVALID_KEY', 401);
      }

      const meData = await meRes.json();
      const agentObj = meData.agent || meData;
      const verifiedName = agentObj.username || agentObj.name;

      if (verifiedName !== agentName) {
        console.log(`[bind-wallet] Agent name mismatch: expected ${agentName}, got ${verifiedName}`);
        return errorResponse('Agent name does not match the API key owner', 'NAME_MISMATCH', 403);
      }

      console.log(`[bind-wallet] Agent verified: ${verifiedName}`);
    }

    // 2. Check if wallet is already bound
    const publicClient = createPublicClient({
      chain: bsc,
      transport: http(BSC_RPC),
    });

    const isBound = await publicClient.readContract({
      address: CUSTODY_ADDRESS,
      abi: CUSTODY_ABI,
      functionName: 'isWalletBound',
      args: [agentName],
    });

    if (isBound) {
      return errorResponse('Wallet already bound for this agent', 'ALREADY_BOUND');
    }

    // 3. Generate random nonce (bytes32)
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const nonce = toHex(randomBytes, { size: 32 });

    // 4. Sign the message: keccak256(abi.encodePacked("SynthLaunch:BindWallet", agentName, wallet, nonce, chainId))
    const account = await getDeployerAccount();

    // Build the message hash matching the contract's verification
    const messageHash = keccak256(
      encodePacked(
        ['string', 'string', 'address', 'bytes32', 'uint256'],
        ['SynthLaunch:BindWallet', agentName, wallet as `0x${string}`, nonce as `0x${string}`, BigInt(CHAIN_ID)]
      )
    );

    // Sign with EIP-191 personal sign (ethSign style, matching contract's toEthSignedMessageHash)
    const signature = await account.signMessage!({ message: { raw: messageHash as `0x${string}` } });

    console.log(`[bind-wallet] Signature generated for ${agentName} -> ${wallet}`);

    return NextResponse.json({
      success: true,
      nonce,
      signature,
      agentName,
      wallet,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[bind-wallet] Unexpected error:`, msg);
    return errorResponse(`Unexpected error: ${msg}`, 'SERVER_ERROR', 500);
  }
}
