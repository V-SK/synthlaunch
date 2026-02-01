import { NextResponse } from 'next/server';
import { createPublicClient, http, encodePacked, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { CUSTODY_ABI, CUSTODY_ADDRESS } from '@/lib/custody';

const CHAIN_ID = 56;
const BSC_RPC = 'https://bsc-dataseed.binance.org';

function errorResponse(error: string, code: string, status: number = 400) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentName, wallet, apiKey } = body;

    if (!agentName || !wallet || !apiKey) {
      return errorResponse('Missing required fields: agentName, wallet, apiKey', 'INVALID_FORMAT');
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return errorResponse('Invalid wallet address', 'INVALID_WALLET');
    }

    // 1. Verify agent identity via Moltbook API key
    console.log(`[bind-wallet] Verifying identity for agent: ${agentName}`);
    const meRes = await fetch('https://www.moltbook.com/api/v1/me', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!meRes.ok) {
      console.log(`[bind-wallet] Moltbook auth failed: ${meRes.status}`);
      return errorResponse('Invalid Moltbook API key', 'INVALID_KEY', 401);
    }

    const meData = await meRes.json();
    const verifiedName = meData.username || meData.name;

    if (verifiedName !== agentName) {
      console.log(`[bind-wallet] Agent name mismatch: expected ${agentName}, got ${verifiedName}`);
      return errorResponse('Agent name does not match the API key owner', 'NAME_MISMATCH', 403);
    }

    console.log(`[bind-wallet] Agent verified: ${verifiedName}`);

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
    const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!deployerKey) {
      console.error('[bind-wallet] DEPLOYER_PRIVATE_KEY not set');
      return errorResponse('Server configuration error', 'CONFIG_ERROR', 500);
    }

    const account = privateKeyToAccount(deployerKey as `0x${string}`);

    // Build the message hash matching the contract's verification
    const messageHash = keccak256(
      encodePacked(
        ['string', 'string', 'address', 'bytes32', 'uint256'],
        ['SynthLaunch:BindWallet', agentName, wallet as `0x${string}`, nonce as `0x${string}`, BigInt(CHAIN_ID)]
      )
    );

    // Sign with EIP-191 personal sign (ethSign style, matching contract's toEthSignedMessageHash)
    const signature = await account.signMessage({ message: { raw: messageHash as `0x${string}` } });

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
