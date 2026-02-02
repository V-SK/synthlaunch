import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, getContractAddress, keccak256, toBytes, toHex, zeroAddress } from 'viem';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { generatePrivateKey } from 'viem/accounts';
import { getDeployerAccount } from '@/lib/kms-signer';
import { bsc } from 'viem/chains';
import { FLAP_ABI, FLAP_ADDRESS } from '@/lib/contracts';
import { CUSTODY_ABI, CUSTODY_ADDRESS } from '@/lib/custody';
import * as fs from 'fs';

// --- Constants ---

const PORTAL = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as const;
const TAX_IMPL = '0x29e6383F0ce68507b5A72a53c2B118a118332aA8';
const NON_TAX_IMPL = '0x8B4329947e34B6d56D71A3385caC122BaDe7d78D';
const EIP1167_PREFIX = '0x3d602d80600a3d3981f3363d3d373d3d3d363d73';
const EIP1167_SUFFIX = '5af43d82803e903d91602b57fd5bf3';

const LAUNCHES_FILE = '/tmp/synthlaunch-launches.json';
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

// --- Helpers ---

function buildBytecode(impl: string): `0x${string}` {
  return (EIP1167_PREFIX + impl.slice(2).toLowerCase() + EIP1167_SUFFIX) as `0x${string}`;
}

function errorResponse(error: string, code: string, status: number = 400) {
  return NextResponse.json({ error, code }, { status });
}

function loadLaunches(): Record<string, number> {
  try {
    if (fs.existsSync(LAUNCHES_FILE)) {
      return JSON.parse(fs.readFileSync(LAUNCHES_FILE, 'utf-8'));
    }
  } catch {
    // corrupted file, start fresh
  }
  return {};
}

function saveLaunches(launches: Record<string, number>) {
  fs.writeFileSync(LAUNCHES_FILE, JSON.stringify(launches, null, 2));
}

async function findVanitySalt(hasTax: boolean): Promise<{ salt: `0x${string}`; tokenAddress: string }> {
  const suffix = hasTax ? '7777' : '8888';
  const impl = hasTax ? TAX_IMPL : NON_TAX_IMPL;
  const bytecode = buildBytecode(impl);
  const maxIterations = 500000;

  const seed = generatePrivateKey();
  let salt: `0x${string}` = keccak256(toHex(seed));

  for (let i = 0; i < maxIterations; i++) {
    const addr = getContractAddress({
      from: PORTAL,
      salt: toBytes(salt),
      bytecode,
      opcode: 'CREATE2',
    });

    if (addr.toLowerCase().endsWith(suffix)) {
      console.log(`[launch] Found vanity salt after ${i + 1} iterations: ${salt}`);
      console.log(`[launch] Predicted token address: ${addr}`);
      return { salt, tokenAddress: addr };
    }

    salt = keccak256(salt);

    if (i % 10000 === 9999) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  throw new Error(`Could not find vanity salt (${suffix}) after ${maxIterations} attempts`);
}

async function uploadToIPFS(imageUrl: string, description: string, website?: string, twitter?: string, telegram?: string): Promise<string> {
  console.log(`[launch] Fetching image from: ${imageUrl}`);
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.status}`);

  const imageBlob = await imageRes.blob();
  const contentType = imageRes.headers.get('content-type') || 'image/png';
  const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
  const filename = `token.${ext}`;

  const operations = JSON.stringify({
    query: 'mutation Create($file: Upload!, $meta: MetadataInput!) { create(file: $file, meta: $meta) }',
    variables: {
      file: null,
      meta: {
        description: description || '',
        website: website || '',
        twitter: twitter || '',
        telegram: telegram || '',
      },
    },
  });

  const map = JSON.stringify({ '0': ['variables.file'] });

  const formData = new FormData();
  formData.append('operations', operations);
  formData.append('map', map);
  formData.append('0', imageBlob, filename);

  console.log('[launch] Uploading to IPFS via Flap...');
  const uploadRes = await fetch('https://funcs.flap.sh/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`IPFS upload failed (${uploadRes.status}): ${text}`);
  }

  const uploadData = await uploadRes.json();
  console.log('[launch] IPFS response:', JSON.stringify(uploadData));

  const cid = uploadData?.data?.create;
  if (!cid) throw new Error('No CID returned from IPFS upload');

  return cid;
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 launches per minute per IP (very sensitive)
    const ip = getClientIP(request);
    const rl = rateLimit(`launch:${ip}`, 3, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many launch requests. Please wait.' }, { status: 429 });
    }

    // 1. Validate request
    const body = await request.json();
    const { moltbook_key, post_id } = body;

    if (!moltbook_key || !post_id) {
      return errorResponse('Missing moltbook_key or post_id', 'INVALID_FORMAT');
    }

    console.log(`[launch] Received launch request for post: ${post_id}`);

    // 2. Verify agent identity
    console.log('[launch] Verifying agent identity...');
    const meRes = await fetch('https://www.moltbook.com/api/v1/agents/me', {
      headers: { 'Authorization': `Bearer ${moltbook_key}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!meRes.ok) {
      console.log(`[launch] Auth failed: ${meRes.status}`);
      return errorResponse('Invalid Moltbook API key', 'INVALID_KEY', 401);
    }

    const meData = await meRes.json();
    const agentObj = meData.agent || meData;
    const agentName = agentObj.username || agentObj.name;
    const agentId = agentObj.id || agentObj._id;
    console.log(`[launch] Agent authenticated: ${agentName} (${agentId})`);

    // 3. Fetch post (public endpoint, NO auth header)
    console.log(`[launch] Fetching post ${post_id}...`);
    const postRes = await fetch(`https://www.moltbook.com/api/v1/posts/${post_id}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!postRes.ok) {
      console.log(`[launch] Post fetch failed: ${postRes.status}`);
      return errorResponse('Post not found', 'POST_NOT_FOUND', 404);
    }

    const postRaw = await postRes.json();
    const postData = postRaw.post || postRaw;
    console.log(`[launch] Post fetched, author: ${postData.author?.username || postData.author?.name || postData.authorId}`);

    // 4. Verify post belongs to agent
    const postAuthorId = postData.author?.id || postData.author?._id || postData.authorId;
    if (postAuthorId !== agentId) {
      console.log(`[launch] Post author mismatch: ${postAuthorId} !== ${agentId}`);
      return errorResponse('Post does not belong to the authenticated agent', 'POST_NOT_OWNED', 403);
    }

    // 5. Parse token details from post content
    const content = postData.content || postData.body || '';
    console.log(`[launch] Parsing token details from post content...`);

    const synthlaunchIndex = content.indexOf('!synthlaunch');
    if (synthlaunchIndex === -1) {
      return errorResponse('Post must contain !synthlaunch followed by a JSON code block', 'INVALID_FORMAT');
    }

    const afterMarker = content.slice(synthlaunchIndex + '!synthlaunch'.length);
    // Match JSON in code block (```json ... ``` or ``` ... ```)
    const codeBlockMatch = afterMarker.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (!codeBlockMatch) {
      return errorResponse('No JSON code block found after !synthlaunch', 'INVALID_FORMAT');
    }

    let tokenDetails: {
      name: string;
      symbol: string;
      description: string;
      image: string;
      wallet: string;
      taxRate?: number;
      website?: string;
      twitter?: string;
      telegram?: string;
    };

    try {
      tokenDetails = JSON.parse(codeBlockMatch[1].trim());
    } catch {
      return errorResponse('Invalid JSON in code block', 'INVALID_FORMAT');
    }

    if (!tokenDetails.name || !tokenDetails.symbol || !tokenDetails.description || !tokenDetails.image || !tokenDetails.wallet) {
      return errorResponse('Missing required fields: name, symbol, description, image, wallet', 'INVALID_FORMAT');
    }

    const taxRate = tokenDetails.taxRate ?? 200; // default 2% = 200 bps
    console.log(`[launch] Token: ${tokenDetails.name} (${tokenDetails.symbol}), taxRate: ${taxRate} bps, wallet: ${tokenDetails.wallet}`);

    // 6. Rate limit
    const launches = loadLaunches();
    const lastLaunch = launches[agentId];
    if (lastLaunch && Date.now() - lastLaunch < RATE_LIMIT_MS) {
      const remainingMs = RATE_LIMIT_MS - (Date.now() - lastLaunch);
      const remainingHrs = Math.ceil(remainingMs / (60 * 60 * 1000));
      return errorResponse(`Rate limited. Try again in ${remainingHrs} hours.`, 'RATE_LIMITED', 429);
    }

    // 7. Upload metadata to IPFS
    let cid: string;
    try {
      cid = await uploadToIPFS(
        tokenDetails.image,
        tokenDetails.description,
        tokenDetails.website,
        tokenDetails.twitter,
        tokenDetails.telegram,
      );
      console.log(`[launch] IPFS CID: ${cid}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[launch] IPFS upload error:`, msg);
      return errorResponse(`Failed to upload metadata: ${msg}`, 'DEPLOY_FAILED', 500);
    }

    // 8. Mine vanity salt
    console.log(`[launch] Mining vanity salt (hasTax: ${taxRate > 0})...`);
    let salt: `0x${string}`;
    let tokenAddress: string;
    const hasTax = taxRate > 0;
    const migratorType = hasTax ? 1 : 0;

    try {
      const result = await findVanitySalt(hasTax);
      salt = result.salt;
      tokenAddress = result.tokenAddress;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[launch] Salt mining error:`, msg);
      return errorResponse(`Failed to mine vanity salt: ${msg}`, 'DEPLOY_FAILED', 500);
    }

    // 9. Send transaction
    const account = await getDeployerAccount();
    const walletClient = createWalletClient({
      account,
      chain: bsc,
      transport: http('https://bsc-dataseed.binance.org'),
    });
    const publicClient = createPublicClient({
      chain: bsc,
      transport: http('https://bsc-dataseed.binance.org'),
    });

    // When taxRate > 0, use custody contract as beneficiary so fees flow to custody
    const beneficiary = hasTax ? CUSTODY_ADDRESS : (tokenDetails.wallet as `0x${string}`);
    console.log(`[launch] Beneficiary: ${beneficiary} (custody: ${hasTax})`);

    console.log(`[launch] Sending newTokenV2 transaction...`);
    let txHash: `0x${string}`;
    try {
      txHash = await walletClient.writeContract({
        address: FLAP_ADDRESS,
        abi: FLAP_ABI,
        functionName: 'newTokenV2',
        args: [{
          name: tokenDetails.name,
          symbol: tokenDetails.symbol,
          meta: cid,
          dexThresh: 1,
          salt,
          taxRate,
          migratorType,
          quoteToken: zeroAddress,
          quoteAmt: BigInt(0),
          beneficiary,
          permitData: '0x' as `0x${string}`,
        }],
        value: BigInt(0),
      });

      console.log(`[launch] Transaction sent: ${txHash}`);

      // Wait for confirmation
      console.log('[launch] Waiting for transaction confirmation...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      console.log(`[launch] Transaction confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);

      if (receipt.status === 'reverted') {
        return errorResponse('Transaction reverted on-chain', 'DEPLOY_FAILED', 500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[launch] Transaction error:`, msg);
      return errorResponse(`Transaction failed: ${msg}`, 'DEPLOY_FAILED', 500);
    }

    // Register token-agent mapping in custody contract (only for tax tokens)
    if (hasTax) {
      try {
        console.log(`[launch] Registering token ${tokenAddress} for agent ${agentName} in custody contract...`);
        const registerHash = await walletClient.writeContract({
          address: CUSTODY_ADDRESS,
          abi: CUSTODY_ABI,
          functionName: 'registerToken',
          args: [tokenAddress as `0x${string}`, agentName],
        });
        console.log(`[launch] registerToken tx: ${registerHash}`);
        const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash, confirmations: 1 });
        console.log(`[launch] registerToken confirmed, status: ${registerReceipt.status}`);
      } catch (err: unknown) {
        // Log but don't fail the launch — token is already created
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[launch] registerToken failed (non-fatal):`, msg);
      }
    }

    // 10. Register in Supabase
    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (SUPABASE_URL && SUPABASE_KEY) {
        const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            address: tokenAddress.toLowerCase(),
            name: tokenDetails.name,
            symbol: tokenDetails.symbol,
            meta: cid,
            creator: account.address,
            agent_name: agentName,
            tx_hash: txHash,
            launch_type: 'api',
            tax_rate: taxRate,
            beneficiary: CUSTODY_ADDRESS,
          }),
        });
        console.log(`[launch] Supabase register: ${sbRes.status}`);
      }
    } catch (err: unknown) {
      console.error(`[launch] Supabase register failed (non-fatal):`, err instanceof Error ? err.message : String(err));
    }

    // 11. Record launch
    launches[agentId] = Date.now();
    saveLaunches(launches);
    console.log(`[launch] Launch recorded for agent ${agentId}`);

    // 11. Return response
    const response = {
      success: true,
      agent: agentName,
      token_address: tokenAddress,
      tx_hash: txHash,
      flap_url: `https://flap.sh/token/${tokenAddress}?chain=bsc`,
      bscscan_url: `https://bscscan.com/token/${tokenAddress}`,
    };

    console.log(`[launch] Success!`, JSON.stringify(response));
    return NextResponse.json(response);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[launch] Unexpected error:`, msg);
    return errorResponse(`Unexpected error: ${msg}`, 'DEPLOY_FAILED', 500);
  }
}
