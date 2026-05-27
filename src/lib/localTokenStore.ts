import { promises as fs } from 'fs';
import path from 'path';
import type { SupportedChainId } from '@/lib/contracts';

export interface LocalTokenRecord {
  address: string;
  name: string;
  symbol: string;
  meta: string;
  creator: string;
  agent_name: string;
  tax_rate: number;
  beneficiary: string;
  tx_hash: string;
  launch_type: string;
  chain_id: SupportedChainId;
  created_at: string;
}

const STORE_DIR = process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'synthlaunch')
  : path.join(process.cwd(), '.local-data');
const STORE_PATH = path.join(STORE_DIR, 'tokens.json');

export function isLocalTokenStoreEnabled(): boolean {
  return process.env.DISABLE_LOCAL_FANFI_STORE !== '1';
}

export async function readLocalTokens(chainId?: SupportedChainId): Promise<LocalTokenRecord[]> {
  if (!isLocalTokenStoreEnabled()) return [];

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    const tokens = Array.isArray(data) ? data : [];
    return tokens.filter((token: LocalTokenRecord) => {
      const validAddress = token.address?.startsWith('0x') && token.address.length === 42;
      return validAddress && (!chainId || token.chain_id === chainId);
    });
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function upsertLocalToken(record: Omit<LocalTokenRecord, 'created_at'> & { created_at?: string }): Promise<LocalTokenRecord> {
  if (!isLocalTokenStoreEnabled()) {
    throw new Error('Local token store is disabled');
  }

  await fs.mkdir(STORE_DIR, { recursive: true });
  const tokens = await readLocalTokens();
  const normalizedRecord: LocalTokenRecord = {
    ...record,
    address: record.address.toLowerCase(),
    created_at: record.created_at || new Date().toISOString(),
  };

  const index = tokens.findIndex((token) => token.address.toLowerCase() === normalizedRecord.address);
  if (index >= 0) {
    tokens[index] = { ...tokens[index], ...normalizedRecord };
  } else {
    tokens.unshift(normalizedRecord);
  }

  await fs.writeFile(STORE_PATH, `${JSON.stringify(tokens, null, 2)}\n`, 'utf8');
  return normalizedRecord;
}
