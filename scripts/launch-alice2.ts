import { createWalletClient, createPublicClient, http, getContractAddress, keccak256, toBytes, toHex, zeroAddress, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';

const PORTAL = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as const;
const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7' as const;
const TAX_IMPL = '0x29e6383F0ce68507b5A72a53c2B118a118332aA8';
const EIP1167_PREFIX = '0x3d602d80600a3d3981f3363d3d373d3d3d363d73';
const EIP1167_SUFFIX = '5af43d82803e903d91602b57fd5bf3';

// Pre-uploaded IPFS CID with correct Alice avatar
const CID = 'bafkreif7j23wprse7xk5lqutuufflmzv6adjlyhzrodi7aymqbkhg67vgy';

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({ account, chain: bsc, transport: http('https://bsc-dataseed.binance.org') });
const publicClient = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });

const FLAP_ABI = [{
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'name', type: 'string' }, { name: 'symbol', type: 'string' },
    { name: 'meta', type: 'string' }, { name: 'dexThresh', type: 'uint8' },
    { name: 'salt', type: 'bytes32' }, { name: 'taxRate', type: 'uint16' },
    { name: 'migratorType', type: 'uint8' }, { name: 'quoteToken', type: 'address' },
    { name: 'quoteAmt', type: 'uint256' }, { name: 'beneficiary', type: 'address' },
    { name: 'permitData', type: 'bytes' },
  ] }],
  name: 'newTokenV2', outputs: [{ name: 'token', type: 'address' }],
  stateMutability: 'payable', type: 'function',
}] as const;

const CUSTODY_ABI = [{
  inputs: [{ name: 'token', type: 'address' }, { name: 'agentName', type: 'string' }],
  name: 'registerToken', outputs: [], stateMutability: 'nonpayable', type: 'function',
}] as const;

function buildBytecode(): `0x${string}` {
  return (EIP1167_PREFIX + TAX_IMPL.slice(2).toLowerCase() + EIP1167_SUFFIX) as `0x${string}`;
}

async function findVanitySalt(): Promise<{ salt: `0x${string}`; tokenAddress: string }> {
  const bytecode = buildBytecode();
  let salt = keccak256(toHex('alice-btc-v2-2026'));
  for (let i = 0; i < 500000; i++) {
    const addr = getContractAddress({ from: PORTAL, salt: toBytes(salt), bytecode, opcode: 'CREATE2' });
    if (addr.toLowerCase().endsWith('7777')) {
      console.log(`Found vanity salt after ${i + 1} iterations`);
      return { salt, tokenAddress: addr };
    }
    salt = keccak256(salt);
    if (i % 10000 === 9999) await new Promise(r => setTimeout(r, 0));
  }
  throw new Error('Could not find vanity salt');
}

async function main() {
  console.log('Deployer:', account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Balance:', formatEther(balance), 'BNB');

  console.log('Mining vanity salt...');
  const { salt, tokenAddress } = await findVanitySalt();
  console.log('Token address:', tokenAddress);

  console.log('Deploying token...');
  const txHash = await walletClient.writeContract({
    address: PORTAL, abi: FLAP_ABI, functionName: 'newTokenV2',
    args: [{ name: 'Alice BTC', symbol: 'ALICE', meta: CID, dexThresh: 1, salt, taxRate: 200,
      migratorType: 1, quoteToken: zeroAddress, quoteAmt: BigInt(0), beneficiary: CUSTODY,
      permitData: '0x' as `0x${string}` }],
    value: BigInt(0),
  });
  console.log('TX:', txHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
  console.log('Confirmed! Block:', receipt.blockNumber, 'Status:', receipt.status);

  try {
    const regHash = await walletClient.writeContract({
      address: CUSTODY, abi: CUSTODY_ABI, functionName: 'registerToken',
      args: [tokenAddress as `0x${string}`, 'AliceBTC'],
    });
    const regReceipt = await publicClient.waitForTransactionReceipt({ hash: regHash, confirmations: 1 });
    console.log('Custody registered! Status:', regReceipt.status);
  } catch (e: any) { console.error('Custody failed:', e.message); }

  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (SUPABASE_KEY) {
    // Delete old ALICE
    await fetch('https://aetpzlvzjnkxgblpgbru.supabase.co/rest/v1/tokens?address=eq.0x0b69acaa8f33b9cdae828cd949d3f97b0eed7777', {
      method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    console.log('Old ALICE deleted from Supabase');

    const sbRes = await fetch('https://aetpzlvzjnkxgblpgbru.supabase.co/rest/v1/tokens', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ address: tokenAddress.toLowerCase(), name: 'Alice BTC', symbol: 'ALICE',
        meta: CID, creator: account.address, agent_name: 'AliceBTC', tx_hash: txHash,
        launch_type: 'api', tax_rate: 200, beneficiary: CUSTODY }),
    });
    console.log('Supabase:', sbRes.status, sbRes.ok ? 'OK' : await sbRes.text());
  }

  console.log('\n🎉 DONE!');
  console.log('Token:', tokenAddress);
  console.log('Flap:', `https://flap.sh/token/${tokenAddress}?chain=bsc`);
  console.log('BscScan:', `https://bscscan.com/token/${tokenAddress}`);
}
main().catch(console.error);
