import { KMSClient, SignCommand, GetPublicKeyCommand } from '@aws-sdk/client-kms';
import { createWalletClient, http, keccak256, type Account, type Transport, type Chain } from 'viem';
import { bsc } from 'viem/chains';
import { toAccount } from 'viem/accounts';

// AWS KMS configuration
const KMS_KEY_ID = process.env.AWS_KMS_KEY_ID || '';
const KMS_REGION = process.env.AWS_KMS_REGION || 'us-east-2';

let _kmsClient: KMSClient | null = null;
let _cachedAddress: `0x${string}` | null = null;

function getKmsClient(): KMSClient {
  if (!_kmsClient) {
    const config: any = { region: KMS_REGION };
    // If explicit credentials are set, use them; otherwise rely on default chain (IAM role, etc.)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }
    _kmsClient = new KMSClient(config);
  }
  return _kmsClient;
}

/**
 * Parse DER-encoded ECDSA signature into r and s values
 */
function parseDerSignature(derSig: Uint8Array): { r: bigint; s: bigint } {
  // DER: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  let offset = 0;
  if (derSig[offset++] !== 0x30) throw new Error('Invalid DER signature');
  offset++; // skip total length

  if (derSig[offset++] !== 0x02) throw new Error('Invalid DER signature (r tag)');
  const rLen = derSig[offset++];
  const rBytes = derSig.slice(offset, offset + rLen);
  offset += rLen;

  if (derSig[offset++] !== 0x02) throw new Error('Invalid DER signature (s tag)');
  const sLen = derSig[offset++];
  const sBytes = derSig.slice(offset, offset + sLen);

  // Remove leading zero padding
  const r = BigInt('0x' + Buffer.from(rBytes).toString('hex'));
  const s = BigInt('0x' + Buffer.from(sBytes).toString('hex'));

  return { r, s };
}

/**
 * secp256k1 curve order
 */
const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const SECP256K1_HALF_N = SECP256K1_N / BigInt(2);

/**
 * Get the Ethereum address derived from the KMS key
 */
export async function getKmsAddress(): Promise<`0x${string}`> {
  if (_cachedAddress) return _cachedAddress;

  const kms = getKmsClient();
  const { PublicKey } = await kms.send(new GetPublicKeyCommand({ KeyId: KMS_KEY_ID }));
  if (!PublicKey) throw new Error('Failed to get public key from KMS');

  const buf = Buffer.from(PublicKey);
  
  // Find uncompressed public key in DER: look for BIT STRING (03 42 00) then 04 prefix
  let pubkeyStart = -1;
  for (let i = 0; i < buf.length - 2; i++) {
    if (buf[i] === 0x03 && buf[i + 1] === 0x42 && buf[i + 2] === 0x00) {
      pubkeyStart = i + 4; // skip 03 42 00 04
      break;
    }
  }
  if (pubkeyStart === -1) throw new Error('Could not find uncompressed public key in DER');

  const pubkey = buf.slice(pubkeyStart, pubkeyStart + 64);
  const hash = keccak256(('0x' + pubkey.toString('hex')) as `0x${string}`);
  _cachedAddress = ('0x' + hash.slice(-40)) as `0x${string}`;
  
  // Checksum
  const { getAddress } = await import('viem');
  _cachedAddress = getAddress(_cachedAddress);
  
  return _cachedAddress;
}

/**
 * Sign a digest (32-byte hash) using KMS
 */
async function kmsSign(digest: Uint8Array): Promise<{ r: bigint; s: bigint; v: bigint }> {
  const kms = getKmsClient();
  
  const { Signature } = await kms.send(new SignCommand({
    KeyId: KMS_KEY_ID,
    Message: digest,
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256',
  }));

  if (!Signature) throw new Error('KMS signing returned no signature');

  let { r, s } = parseDerSignature(new Uint8Array(Signature));

  // Normalize s to lower half (EIP-2)
  if (s > SECP256K1_HALF_N) {
    s = SECP256K1_N - s;
  }

  // Recover v by trying both 27 and 28
  const address = await getKmsAddress();
  const { recoverAddress } = await import('viem');
  
  const hexDigest = ('0x' + Buffer.from(digest).toString('hex')) as `0x${string}`;
  
  for (const v of [BigInt(27), BigInt(28)]) {
    try {
      const rHex = ('0x' + r.toString(16).padStart(64, '0')) as `0x${string}`;
      const sHex = ('0x' + s.toString(16).padStart(64, '0')) as `0x${string}`;
      const yParity = v === BigInt(27) ? 0 : 1;
      
      const recovered = await recoverAddress({
        hash: hexDigest,
        signature: {
          r: rHex,
          s: sHex,
          yParity,
        },
      });
      
      if (recovered.toLowerCase() === address.toLowerCase()) {
        return { r, s, v };
      }
    } catch {
      continue;
    }
  }

  throw new Error('Could not determine recovery parameter v');
}

/**
 * Create a viem Account backed by AWS KMS
 */
export async function createKmsAccount(): Promise<Account> {
  const address = await getKmsAddress();

  return toAccount({
    address,
    async signMessage({ message }) {
      const { hashMessage } = await import('viem');
      const hash = hashMessage(message);
      const digest = Buffer.from(hash.slice(2), 'hex');
      const { r, s, v } = await kmsSign(new Uint8Array(digest));
      
      const rHex = r.toString(16).padStart(64, '0');
      const sHex = s.toString(16).padStart(64, '0');
      const vHex = v.toString(16).padStart(2, '0');
      
      return ('0x' + rHex + sHex + vHex) as `0x${string}`;
    },
    async signTransaction(transaction) {
      const { keccak256: k256, serializeTransaction } = await import('viem');
      const serialized = serializeTransaction(transaction);
      const hash = k256(serialized);
      const digest = Buffer.from(hash.slice(2), 'hex');
      const { r, s, v } = await kmsSign(new Uint8Array(digest));
      
      const rHex = ('0x' + r.toString(16).padStart(64, '0')) as `0x${string}`;
      const sHex = ('0x' + s.toString(16).padStart(64, '0')) as `0x${string}`;
      const yParity = v === BigInt(27) ? 0 : 1;
      
      return serializeTransaction(transaction, {
        r: rHex,
        s: sHex,
        yParity,
      });
    },
    async signTypedData(typedData) {
      const { hashTypedData } = await import('viem');
      const hash = hashTypedData(typedData);
      const digest = Buffer.from(hash.slice(2), 'hex');
      const { r, s, v } = await kmsSign(new Uint8Array(digest));
      
      const rHex = r.toString(16).padStart(64, '0');
      const sHex = s.toString(16).padStart(64, '0');
      const vHex = v.toString(16).padStart(2, '0');
      
      return ('0x' + rHex + sHex + vHex) as `0x${string}`;
    },
  });
}

/**
 * Check if KMS is configured
 */
export function isKmsConfigured(): boolean {
  return !!KMS_KEY_ID;
}

/**
 * Get deployer account — uses KMS if configured, falls back to DEPLOYER_PRIVATE_KEY
 */
export async function getDeployerAccount(): Promise<Account> {
  if (isKmsConfigured()) {
    console.log('[kms] Using AWS KMS signer');
    return createKmsAccount();
  }
  
  // Fallback to raw private key
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) {
    throw new Error('Neither AWS_KMS_KEY_ID nor DEPLOYER_PRIVATE_KEY is configured');
  }
  
  console.log('[kms] Using raw private key (fallback)');
  const { privateKeyToAccount } = await import('viem/accounts');
  return privateKeyToAccount(deployerKey as `0x${string}`);
}
