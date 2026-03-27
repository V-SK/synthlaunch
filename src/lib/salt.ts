import { getContractAddress, keccak256, toBytes, toHex } from 'viem';
import { generatePrivateKey } from 'viem/accounts';
import { CHAIN_CONFIG, type SupportedChainId } from '@/lib/contracts';

const PORTAL = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as const;

const EIP1167_PREFIX = '0x3d602d80600a3d3981f3363d3d373d3d3d363d73';
const EIP1167_SUFFIX = '5af43d82803e903d91602b57fd5bf3';

function buildBytecode(impl: string): `0x${string}` {
  return (EIP1167_PREFIX + impl.slice(2).toLowerCase() + EIP1167_SUFFIX) as `0x${string}`;
}

/**
 * Find a salt that produces a CREATE2 address ending with the required vanity suffix.
 * Vanity suffixes are chain-specific (tax vs standard).
 * Uses the same approach as Flap's official example: keccak256 hashing.
 */
export async function findVanitySalt(hasTax: boolean, chainId: SupportedChainId = 56): Promise<`0x${string}`> {
  const chainConfig = CHAIN_CONFIG[chainId] ?? CHAIN_CONFIG[56];
  const suffix = hasTax ? chainConfig.vanitySuffix.tax : chainConfig.vanitySuffix.standard;
  const impl = hasTax ? chainConfig.tokenImpl.tax : chainConfig.tokenImpl.standard;
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
