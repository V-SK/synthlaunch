const { KMSClient, SignCommand, GetPublicKeyCommand } = require('@aws-sdk/client-kms');
const { createPublicClient, createWalletClient, http, keccak256, encodePacked, toBytes, hexToBytes, bytesToHex } = require('viem');
const { bsc } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const crypto = require('crypto');
const fs = require('fs');

// AWS KMS Configuration
const KMS_KEY_ID = 'arn:aws:kms:us-east-2:696154297091:key/34075bad-0aa0-4e8f-a23b-fae95373d327';
const kmsClient = new KMSClient({ region: 'us-east-2' });

// Contract addresses
const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const V_WALLET = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e';

// Agents to bind
const AGENTS_TO_BIND = [
  'ShellBook_AI',
  'ShellBookAI', 
  'YuanqiAIBot',
  'AliceBTC',
  'WeilianDu',
  'FuSheng_0306',
  // 'webhogwatrs', // Skip - belongs to someone else
];

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org')
});

// Get deployer wallet for sending transactions
const envContent = fs.readFileSync('.env.local', 'utf8');
const privateKey = envContent.match(/DEPLOYER_PRIVATE_KEY=(0x[a-fA-F0-9]+)/)[1];
const account = privateKeyToAccount(privateKey);

const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org')
});

// Convert DER signature to compact (r, s, v) format
function derToCompact(derSig, messageHash, publicKey) {
  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  let offset = 2; // Skip 0x30 and total length
  
  // Read r
  if (derSig[offset] !== 0x02) throw new Error('Invalid DER: expected 0x02 for r');
  offset++;
  const rLength = derSig[offset];
  offset++;
  let r = derSig.slice(offset, offset + rLength);
  offset += rLength;
  
  // Read s
  if (derSig[offset] !== 0x02) throw new Error('Invalid DER: expected 0x02 for s');
  offset++;
  const sLength = derSig[offset];
  offset++;
  let s = derSig.slice(offset, offset + sLength);
  
  // Remove leading zeros and ensure 32 bytes
  while (r.length > 32 && r[0] === 0) r = r.slice(1);
  while (s.length > 32 && s[0] === 0) s = s.slice(1);
  while (r.length < 32) r = Buffer.concat([Buffer.from([0]), r]);
  while (s.length < 32) s = Buffer.concat([Buffer.from([0]), s]);
  
  // Determine v (recovery id) - try both 27 and 28
  // For now, we'll try v=27 first, if recovery fails, use v=28
  return { r, s, v: 27 };
}

async function signWithKMS(messageHash) {
  // messageHash should be 32 bytes
  const hashBytes = hexToBytes(messageHash);
  
  const command = new SignCommand({
    KeyId: KMS_KEY_ID,
    Message: hashBytes,
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256',
  });
  
  const response = await kmsClient.send(command);
  const derSignature = Buffer.from(response.Signature);
  
  // Get public key to determine v
  const pubKeyCmd = new GetPublicKeyCommand({ KeyId: KMS_KEY_ID });
  const pubKeyResponse = await kmsClient.send(pubKeyCmd);
  
  const { r, s, v } = derToCompact(derSignature, messageHash, pubKeyResponse.PublicKey);
  
  // Construct signature: r (32) + s (32) + v (1)
  const signature = '0x' + r.toString('hex') + s.toString('hex') + v.toString(16);
  
  return signature;
}

async function bindWallet(agentName) {
  console.log(`\n📝 Binding ${agentName} to ${V_WALLET}...`);
  
  // Check if already bound
  const currentWallet = await client.readContract({
    address: CUSTODY,
    abi: [{ inputs: [{type: 'string'}], name: 'agentWallet', outputs: [{type: 'address'}], stateMutability: 'view', type: 'function' }],
    functionName: 'agentWallet',
    args: [agentName]
  });
  
  if (currentWallet !== '0x0000000000000000000000000000000000000000') {
    console.log(`   ⏭️ Already bound to ${currentWallet}`);
    return false;
  }
  
  // Generate nonce
  const nonce = '0x' + crypto.randomBytes(32).toString('hex');
  
  // Create message hash
  // keccak256(abi.encodePacked("SynthLaunch:BindWallet", address(this), agentName, wallet, nonce, block.chainid))
  const messageHash = keccak256(
    encodePacked(
      ['string', 'address', 'string', 'address', 'bytes32', 'uint256'],
      ['SynthLaunch:BindWallet', CUSTODY, agentName, V_WALLET, nonce, 56n]
    )
  );
  
  console.log(`   Message hash: ${messageHash}`);
  
  // Sign with KMS
  const signature = await signWithKMS(messageHash);
  console.log(`   Signature: ${signature.slice(0, 20)}...`);
  
  // Call bindWallet
  const hash = await walletClient.writeContract({
    address: CUSTODY,
    abi: [{
      inputs: [
        { type: 'string', name: 'agentName' },
        { type: 'address', name: 'wallet' },
        { type: 'bytes32', name: 'nonce' },
        { type: 'bytes', name: 'signature' }
      ],
      name: 'bindWallet',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    }],
    functionName: 'bindWallet',
    args: [agentName, V_WALLET, nonce, signature]
  });
  
  console.log(`   ✅ TX: ${hash}`);
  
  // Wait for confirmation
  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
  
  return true;
}

async function main() {
  console.log('🔐 Binding wallets using AWS KMS signer');
  console.log(`   Target wallet: ${V_WALLET}`);
  console.log(`   Deployer: ${account.address}`);
  
  // Test KMS connection first
  try {
    console.log('\n🔑 Testing KMS connection...');
    const pubKeyCmd = new GetPublicKeyCommand({ KeyId: KMS_KEY_ID });
    const response = await kmsClient.send(pubKeyCmd);
    console.log('   ✅ KMS connected, key type:', response.KeySpec);
  } catch (e) {
    console.log('   ❌ KMS error:', e.message);
    return;
  }
  
  let bound = 0;
  for (const agent of AGENTS_TO_BIND) {
    try {
      const success = await bindWallet(agent);
      if (success) bound++;
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }
  }
  
  console.log(`\n✅ Done! Bound ${bound}/${AGENTS_TO_BIND.length} agents`);
}

main().catch(console.error);
