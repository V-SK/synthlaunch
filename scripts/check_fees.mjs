import { createPublicClient, http, parseAbi, formatEther, getAddress } from 'viem';
import { bsc } from 'viem/chains';

const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed1.defibit.io') });

const ABI = parseAbi([
  'function tokenFees(address token) external view returns (uint256)',
  'function tokenAgent(address token) external view returns (string)',
]);

// All 106 original token addresses from the API cache before deletion
// Get them from the Flap Portal - check all tokens in our Supabase backup
const SUPA_URL = 'https://aetpzlvzjnkxgblpgbru.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

// Current tokens in Supabase
const res = await fetch(`${SUPA_URL}/rest/v1/tokens?select=address,name,symbol,agent_name,tax_rate,meta,creator,created_at&order=created_at.asc`, {
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
});
const current = await res.json();
const currentAddrs = new Set(current.map(t => t.address.toLowerCase()));
console.log(`Current Supabase tokens: ${current.length}`);

// Check each current token for custody fees
for (const t of current) {
  try {
    const fees = await client.readContract({ address: CUSTODY, abi: ABI, functionName: 'tokenFees', args: [getAddress(t.address)] });
    const agent = await client.readContract({ address: CUSTODY, abi: ABI, functionName: 'tokenAgent', args: [getAddress(t.address)] });
    const feesStr = formatEther(fees);
    if (parseFloat(feesStr) > 0) {
      console.log(`FEES|${t.address}|${t.name}|${agent}|${feesStr} BNB`);
    }
  } catch(e) {}
}
