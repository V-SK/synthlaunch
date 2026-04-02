export type AiRole = 'user' | 'assistant';

export interface AiUserPreferences {
  riskBias: 'conservative' | 'balanced' | 'aggressive';
  preferredQuoteToken: 'OKB' | 'USDT' | 'USDC';
}

export interface AiWatchToken {
  symbol: string;
  address: string;
  name?: string;
}

export interface AiUserProfile extends AiUserPreferences {
  walletAddress: string;
  watchlist: AiWatchToken[];
  lastSessionId?: string | null;
  persistenceEnabled: boolean;
}

export interface AiSession {
  id: string;
  walletAddress: string;
  chainId: number;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface AiActionLogEntry {
  id: string;
  sessionId: string;
  walletAddress: string;
  actionType: string;
  status: string;
  txHash?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface TokenSearchItem {
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

export interface BalanceTokenItem {
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

export interface PriceToolResult {
  type: 'price';
  token: TokenSearchItem;
}

export interface SearchToolResult {
  type: 'search';
  query: string;
  results: TokenSearchItem[];
}

export interface BalancesToolResult {
  type: 'balances';
  totalValueUsd?: string | null;
  balances: BalanceTokenItem[];
}

export interface SuggestionToolResult {
  type: 'suggestion';
  token: TokenSearchItem;
  verdict: 'bullish' | 'neutral' | 'cautious';
  reason: string;
}

export interface SwapExecutionPayload {
  to: string;
  data: string;
  value: string;
}

export interface SwapToolResult {
  type: 'swapQuote';
  tokenIn: TokenSearchItem;
  tokenOut: TokenSearchItem;
  amountIn: string;
  amountOut?: string;
  minAmountOut?: string;
  slippage?: string;
  execution: SwapExecutionPayload;
  actionId?: string;
}

export interface ErrorToolResult {
  type: 'error';
  title: string;
  detail: string;
}

export type AiLlmSource = 'codex' | 'openai' | 'heuristic';
export type AiProviderStatus = 'live' | 'fallback' | 'degraded' | 'unconfigured';

export interface AiLlmRuntime {
  source: AiLlmSource;
  provider: 'openai' | 'openai-codex';
  fallbackReason?: string | null;
}

export interface AiOkxRuntime {
  operation: 'balances' | 'price' | 'search' | 'suggestion' | 'swap' | 'health';
  status: 'ok' | 'error';
  detail?: string | null;
}

export type AiToolResult =
  | PriceToolResult
  | SearchToolResult
  | BalancesToolResult
  | SuggestionToolResult
  | SwapToolResult
  | ErrorToolResult;

export interface AiMessageMetadata {
  toolResult?: AiToolResult;
  actionId?: string;
  llm?: AiLlmRuntime;
  okx?: AiOkxRuntime;
}

export interface AiMessage {
  id: string;
  sessionId: string;
  walletAddress: string;
  role: AiRole;
  content: string;
  createdAt: string;
  metadata?: AiMessageMetadata | null;
}

export interface AiAuthState {
  authenticated: boolean;
  walletAddress?: string | null;
  expiresAt?: string | null;
}

export interface AiSessionResponse extends AiAuthState {
  user?: AiUserProfile | null;
  session?: AiSession | null;
}

export interface AiHealthStatus {
  status: AiProviderStatus;
  detail?: string | null;
  checkedAt?: string | null;
  latencyMs?: number | null;
}

export interface AiHealthResponse {
  auth: AiAuthState;
  llm: AiHealthStatus & {
    provider: 'openai' | 'openai-codex';
    source?: AiLlmSource | null;
  };
  okx: AiHealthStatus;
  supabase: AiHealthStatus;
}
