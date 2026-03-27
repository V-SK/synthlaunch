const { KMSClient, SignCommand, GetPublicKeyCommand } = require('@aws-sdk/client-kms');
const { createPublicClient, createWalletClient, http, keccak256, encodePacked, hexToBytes, bytesToHex, recoverAddress, hashMessage } = require('viem');
const { bsc } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');
const crypto = require('crypto');
const fs = require('fs');
const { secp256k1 } = require('@noble/curves/secp256k1');

// AWS KMS Configuration
const KMS_KEY_ID = 'arn:aws:kms:us-east-2:696154297091:key/34075bad-0aa0-4e8f-a23b-fae95373d327';
const kmsClient = new KMSClient({ region: 'us-east-2' });

// Contract addresses
const CUSTODY = '0x3Fa33A0fb85f11A901e3616E10876d10018f43B7';
const V_WALLET = '0x5c9E31B8E3fDc7356D7398165457423854C72C8e';
const EXPECTED_SIGNER = '0xFCf8f2D0bF2B222Aa19c1A5cD941a67a784AdEb8';

// Agents to bind
const AGENTS_TO_BIND = [
  'ShellBook_AI',
  'ShellBookAI', 
  'YuanqiAIBot',
  'AliceBTC',
  'WeilianDu',
  'FuSheng_0306',
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

// Get the signer's public key from KMS
let signerPublicKey = null;

async function getSignerPublicKey() {
  if (signerPublicKey) return signerPublicKey;
  
  const command = new GetPublicKeyCommand({ KeyId: KMS_KEY_ID });
  const response = await kmsClient.send(command);
  
  // Parse DER-encoded public key to get raw EC point
  const der = Buffer.from(response.PublicKey);
  // For secp256k1, the uncompressed public key (64 bytes) is at the end of DER structure
  signerPublicKey = der.slice(-64);
  return signerPublicKey;
}

// Sign with KMS and return proper Ethereum signature
async function signWithKMS(messageHash) {
  const hashBytes = hexToBytes(messageHash);
  
  // Sign the hash
  const signCommand = new SignCommand({
    KeyId: KMS_KEY_ID,
    Message: hashBytes,
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256',
  });
  
  const signResponse = await kmsClient.send(signCommand);
  const derSig = Buffer.from(signResponse.Signature);
  
  // Parse DER signature
  let offset = 2; // Skip 0x30 and length byte
  
  // Get r
  if (derSig[offset] !== 0x02) throw new Error('Invalid DER');
  offset++;
  const rLen = derSig[offset];
  offset++;
  let r = derSig.slice(offset, offset + rLen);
  offset += rLen;
  
  // Get s
  if (derSig[offset] !== 0x02) throw new Error('Invalid DER');
  offset++;
  const sLen = derSig[offset];
  offset++;
  let s = derSig.slice(offset, offset + sLen);
  
  // Remove leading zeros and pad to 32 bytes
  while (r.length > 32 && r[0] === 0) r = r.slice(1);
  while (s.length > 32 && s[0] === 0) s = s.slice(1);
  r = Buffer.concat([Buffer.alloc(32 - r.length), r]);
  s = Buffer.concat([Buffer.alloc(32 - s.length), s]);
  
  // EIP-2: Ensure s is in lower half of curve order
  const curveOrder = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const halfOrder = curveOrder / 2n;
  let sBigInt = BigInt('0x' + s.toString('hex'));
  if (sBigInt > halfOrder) {
    sBigInt = curveOrder - sBigInt;
    s = Buffer.from(sBigInt.toString(16).padStart(64, '0'), 'hex');
  }
  
  // Get public key for recovery
  const pubKey = await getSignerPublicKey();
  const pubKeyHex = pubKey.toString('hex');
  
  // Try both recovery IDs (0 and 1) -> v = 27 or 28
  const rHex = r.toString('hex');
  const sHex = s.toString('hex');
  
  for (let recoveryId = 0; recoveryId <= 1; recoveryId++) {
    const v = 27 + recoveryId;
    const signature = '0x' + rHex + sHex + v.toString(16).padStart(2, '0');
    
    try {
      const recovered = await recoverAddress({
        hash: messageHash,
        signature: signature
      });
      
      if (recovered.toLowerCase() === EXPECTED_SIGNER.toLowerCase()) {
        return signature;
      }
    } catch (e) {
      // Try next recovery ID
    }
  }
  
  throw new Error('Could not determine correct recovery ID');
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
  
  // Create message hash (same as contract)
  const messageHash = keccak256(
    encodePacked(
      ['string', 'address', 'string', 'address', 'bytes32', 'uint256'],
      ['SynthLaunch:BindWallet', CUSTODY, agentName, V_WALLET, nonce, 56n]
    )
  );
  
  // Add Ethereum signed message prefix (toEthSignedMessageHash)
  const ethSignedHash = hashMessage({ raw: hexToBytes(messageHash) });
  
  console.log(`   Message hash: ${messageHash}`);
  console.log(`   Eth signed hash: ${ethSignedHash}`);
  
  // Sign with KMS
  const signature = await signWithKMS(ethSignedHash);
  console.log(`   Signature: ${signature.slice(0, 30)}...`);
  
  // Verify locally before sending
  const recovered = await recoverAddress({ hash: ethSignedHash, signature });
  console.log(`   Recovered: ${recovered}`);
  console.log(`   Expected:  ${EXPECTED_SIGNER}`);
  
  if (recovered.toLowerCase() !== EXPECTED_SIGNER.toLowerCase()) {
    console.log(`   ❌ Signature verification failed locally`);
    return false;
  }
  
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
  console.log('🔐 Binding wallets using AWS KMS signer (v2)');
  console.log(`   Target wallet: ${V_WALLET}`);
  console.log(`   Deployer: ${account.address}`);
  console.log(`   Expected signer: ${EXPECTED_SIGNER}`);
  
  // Test KMS connection
  try {
    console.log('\n🔑 Testing KMS signing...');
    const testHash = keccak256(encodePacked(['string'], ['test']));
    const testEthHash = hashMessage({ raw: hexToBytes(testHash) });
    const testSig = await signWithKMS(testEthHash);
    const recovered = await recoverAddress({ hash: testEthHash, signature: testSig });
    console.log(`   Test recovered: ${recovered}`);
    console.log(`   ✅ KMS signing works!`);
  } catch (e) {
    console.log(`   ❌ KMS test failed: ${e.message}`);
    return;
  }
  
  let bound = 0;
  for (const agent of AGENTS_TO_BIND) {
    try {
      const success = await bindWallet(agent);
      if (success) bound++;
    } catch (e) {
      console.log(`   ❌ Error: ${e.message.slice(0, 100)}`);
    }
  }
  
  console.log(`\n✅ Done! Bound ${bound}/${AGENTS_TO_BIND.length} agents`);
}

main().catch(console.error);
