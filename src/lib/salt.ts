import { getContractAddress, keccak256, toBytes, toHex } from 'viem';
import { generatePrivateKey } from 'viem/accounts';

const PORTAL = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as const;
const TAX_IMPL = '0x29e6383F0ce68507b5A72a53c2B118a118332aA8';
const NON_TAX_IMPL = '0x8B4329947e34B6d56D71A3385caC122BaDe7d78D';

const EIP1167_PREFIX = '0x3d602d80600a3d3981f3363d3d373d3d3d363d73';
const EIP1167_SUFFIX = '5af43d82803e903d91602b57fd5bf3';

function buildBytecode(impl: string): `0x${string}` {
  return (EIP1167_PREFIX + impl.slice(2).toLowerCase() + EIP1167_SUFFIX) as `0x${string}`;
}

/**
 * Find a salt that produces a CREATE2 address ending with the required vanity suffix.
 * Tax tokens must end with "7777", non-tax tokens with "8888".
 * Uses the same approach as Flap's official example: keccak256 hashing.
 */
export async function findVanitySalt(hasTax: boolean): Promise<`0x${string}`> {
  const suffix = hasTax ? '7777' : '8888';
  const impl = hasTax ? TAX_IMPL : NON_TAX_IMPL;
  const bytecode = buildBytecode(impl);

  const maxIterations = 500000;

  // Use the exact same approach as Flap's official code:
  // Generate a random seed, then repeatedly keccak256 hash it
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
      console.log(`Found vanity salt after ${i + 1} iterations: ${salt}`);
      console.log(`Token address: ${addr}`);
      return salt;
    }

    salt = keccak256(salt);

    // Yield to UI every 10k iterations to avoid freezing
    if (i % 10000 === 9999) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  throw new Error(`Could not find vanity salt (${suffix}) after ${maxIterations} attempts. Please try again.`);
}
