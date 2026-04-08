import { createHmac } from 'node:crypto';

export const OKX_BASE_URL = 'https://web3.okx.com';
export const OKX_X_LAYER_CHAIN_INDEX = '196';
export const OKX_NATIVE_TOKEN_ADDRESS =
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

type Primitive = string | number | boolean | null | undefined;

interface OkxRequestOptions {
  method?: 'GET' | 'POST';
  path: string;
  query?: Record<string, Primitive>;
  body?: unknown;
}

export interface OkxTokenSearchResult {
  chainIndex: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl?: string;
  tokenContractAddress: string;
  decimal: string;
  explorerUrl?: string;
  change?: string;
  holders?: string;
  liquidity?: string;
  marketCap?: string;
  price?: string;
  tagList?: {
    communityRecognized?: boolean;
  };
}

export interface OkxBalanceItem {
  tokenContractAddress: string;
  symbol: string;
  tokenName?: string;
  tokenLogoUrl?: string;
  balance: string;
  rawBalance?: string;
  decimal?: string;
  price?: string;
  valueUsd?: string;
  change24h?: string;
}

function normalizeSlippagePercent(value?: string): string {
  const raw = value?.trim() || '0.5';
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 100) {
    throw new Error('Invalid slippage. Use a percentage between 0 and 100.');
  }
  return numeric.toString();
}

export function mapOkxErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'OKX request failed';

  if (/slippagePercent/i.test(message)) {
    return 'OKX rejected the slippage value for this route.';
  }
  if (/insufficient/i.test(message)) {
    return 'Insufficient balance for this X Layer route.';
  }
  if (/route/i.test(message) || /liquidity/i.test(message)) {
    return 'No executable OKX route is available for this token pair right now.';
  }

  return message;
}

function getOkxCredentials() {
  const apiKey = process.env.OKX_API_KEY ?? process.env.OK_ACCESS_KEY;
  const secretKey = process.env.OKX_SECRET_KEY ?? process.env.OK_ACCESS_SECRET;
  const passphrase =
    process.env.OKX_API_PASSPHRASE ??
    process.env.OKX_PASSPHRASE ??
    process.env.OK_ACCESS_PASSPHRASE;
  const projectId = process.env.OKX_PROJECT_ID ?? process.env.OK_ACCESS_PROJECT;

  return { apiKey, secretKey, passphrase, projectId };
}

export function isOkxConfigured(): boolean {
  const { apiKey, secretKey, passphrase } = getOkxCredentials();
  return Boolean(apiKey && secretKey && passphrase);
}

function buildQueryString(query?: Record<string, Primitive>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

async function okxRequest<T>({
  method = 'GET',
  path,
  query,
  body,
}: OkxRequestOptions): Promise<T> {
  const { apiKey, secretKey, passphrase, projectId } = getOkxCredentials();

  if (!apiKey || !secretKey || !passphrase) {
    throw new Error('OKX credentials are not configured');
  }

  const queryString = buildQueryString(query);
  const requestPath = `${path}${method === 'GET' ? queryString : ''}`;
  const bodyString =
    method === 'POST' && body !== undefined ? JSON.stringify(body) : '';
  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${method}${requestPath}${bodyString}`;
  const sign = createHmac('sha256', secretKey).update(prehash).digest('base64');

  const response = await fetch(`${OKX_BASE_URL}${requestPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      ...(projectId ? { 'OK-ACCESS-PROJECT': projectId } : {}),
    },
    body: method === 'POST' ? bodyString : undefined,
    cache: 'no-store',
  });

  const text = await response.text();
  const parsed = text
    ? ((() => {
        try {
          return JSON.parse(text);
        } catch {
          return { msg: text };
        }
      })())
    : {};

  if (!response.ok) {
    throw new Error(parsed?.msg || parsed?.message || response.statusText);
  }

  if (parsed?.code && parsed.code !== '0') {
    throw new Error(parsed?.msg || 'OKX request failed');
  }

  return (parsed?.data ?? parsed) as T;
}

export async function okxTokenSearch(
  search: string,
  chains = OKX_X_LAYER_CHAIN_INDEX,
): Promise<OkxTokenSearchResult[]> {
  return await okxRequest<OkxTokenSearchResult[]>({
    path: '/api/v6/dex/market/token/search',
    query: { chains, search },
  });
}

export async function okxBalances(address: string): Promise<OkxBalanceItem[]> {
  return await okxRequest<OkxBalanceItem[]>({
    path: '/api/v6/dex/balance/all-token-balances-by-address',
    query: {
      chains: OKX_X_LAYER_CHAIN_INDEX,
      address,
    },
  });
}

export async function okxTotalValue(
  address: string,
): Promise<Array<{ totalValue?: string; tokenValueList?: Array<{ value?: string }> }>> {
  return await okxRequest<
    Array<{ totalValue?: string; tokenValueList?: Array<{ value?: string }> }>
  >({
    path: '/api/v6/dex/balance/total-value-by-address',
    query: {
      chains: OKX_X_LAYER_CHAIN_INDEX,
      address,
    },
  });
}

export async function okxQuote(query: {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  slippage?: string;
  userWalletAddress?: string;
}): Promise<Record<string, unknown>[]> {
  return await okxRequest<Record<string, unknown>[]>({
    path: '/api/v6/dex/aggregator/quote',
    query: {
      chainIndex: OKX_X_LAYER_CHAIN_INDEX,
      fromTokenAddress: query.fromTokenAddress,
      toTokenAddress: query.toTokenAddress,
      amount: query.amount,
      slippagePercent: normalizeSlippagePercent(query.slippage),
      userWalletAddress: query.userWalletAddress,
    },
  });
}

export async function okxSwap(query: {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  userWalletAddress: string;
  slippage?: string;
}): Promise<Record<string, unknown>[]> {
  return await okxRequest<Record<string, unknown>[]>({
    path: '/api/v6/dex/aggregator/swap',
    query: {
      chainIndex: OKX_X_LAYER_CHAIN_INDEX,
      fromTokenAddress: query.fromTokenAddress,
      toTokenAddress: query.toTokenAddress,
      amount: query.amount,
      slippagePercent: normalizeSlippagePercent(query.slippage),
      userWalletAddress: query.userWalletAddress,
    },
  });
}
