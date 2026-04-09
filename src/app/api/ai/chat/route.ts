import { NextRequest, NextResponse } from 'next/server';
import {
  getAiHistory,
  getOrCreateAiSession,
  insertAiMessage,
  mergeWatchTokens,
  recordAiAction,
  updateAiUser,
} from '@/lib/ai/store';
import type {
  AiLlmRuntime,
  AiMessageMetadata,
  AiOkxRuntime,
  AiToolResult,
  AiWatchToken,
  TokenSearchItem,
} from '@/lib/ai/types';
import { getAuthenticatedAiWallet } from '@/lib/ai/auth';
import {
  OKX_NATIVE_TOKEN_ADDRESS,
  okxBalances,
  okxSwap,
  okxTokenSearch,
  okxTotalValue,
} from '@/lib/okx';
import { getLlmConfig, llmJsonResponse } from '@/lib/llm';

export const dynamic = 'force-dynamic';

type Intent =
  | 'balances'
  | 'price'
  | 'search'
  | 'swap'
  | 'suggestion'
  | 'unknown';

type LlmDecision = {
  intent: Intent;
  reply?: string;
  query?: string;
  fromToken?: string;
  toToken?: string;
  amount?: string;
  watchTokens?: string[];
  riskBias?: 'conservative' | 'balanced' | 'aggressive' | 'unchanged';
};

type IntentDecisionResult = {
  decision: LlmDecision;
  llm: AiLlmRuntime;
};

const DEFAULT_CHAT_REPLY =
  'I can help with X Layer balances, token lookups, buy ideas, and swap quotes via OKX.';

function logAiEvent(
  event: string,
  details: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info',
) {
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  logger(
    JSON.stringify({
      scope: 'ai-chat',
      event,
      ...details,
    }),
  );
}

function sanitizeTicker(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,.!?]/g, '').trim();
  return cleaned.length > 0 ? cleaned.toUpperCase() : undefined;
}

function normalizeTokenQuery(value?: string): string | undefined {
  if (!value) return undefined;

  const direct = sanitizeTicker(value);
  if (direct && /^[A-Z0-9]{2,12}$/.test(direct)) {
    return direct;
  }

  const text = value.trim();
  const upper = text.toUpperCase();
  const candidates = upper.match(/\b[A-Z0-9]{2,12}\b/g) ?? [];
  const noise = new Set([
    'PRICE',
    'QUOTE',
    'TOKEN',
    'BUY',
    'SWAP',
    'BALANCE',
    'BALANCES',
    'CHECK',
    'SHOW',
    'THE',
    'ON',
    'FOR',
    'WITH',
    'MY',
    'X',
    'LAYER',
  ]);

  const filtered = candidates.filter((item) => !noise.has(item));
  return filtered[0] ?? candidates[0] ?? direct;
}

function extractHeuristics(message: string): LlmDecision {
  const text = message.trim();
  const upper = text.toUpperCase();
  const swapMatch =
    text.match(
      /(?:swap|兑换|用)\s*([\d.]+)\s*([A-Za-z0-9$]+)\s*(?:to|成|换|for)\s*([A-Za-z0-9$]+)/i,
    ) ??
    text.match(
      /([\d.]+)\s*([A-Za-z0-9$]+)\s*(?:to|for)\s*([A-Za-z0-9$]+)/i,
    );

  if (
    upper.includes('BALANCE') ||
    text.includes('余额') ||
    text.includes('资产')
  ) {
    return {
      intent: 'balances',
      reply: 'I pulled your latest X Layer wallet balances from OKX.',
    };
  }

  if (swapMatch) {
    return {
      intent: 'swap',
      amount: swapMatch[1],
      fromToken: sanitizeTicker(swapMatch[2]),
      toToken: sanitizeTicker(swapMatch[3]),
      reply: 'Here is the current OKX swap route on X Layer.',
    };
  }

  if (
    upper.includes('BUY') ||
    text.includes('买') ||
    text.includes('适合')
  ) {
    const ticker = sanitizeTicker(
      text.match(/\b([A-Za-z]{2,12})\b/g)?.slice(-1)?.[0],
    );
    return {
      intent: 'suggestion',
      query: ticker,
      reply: 'I reviewed the latest OKX market data and formed a cautious buy read.',
    };
  }

  if (
    upper.includes('PRICE') ||
    text.includes('价格') ||
    text.includes('行情') ||
    text.includes('QUOTE')
  ) {
    const ticker = sanitizeTicker(
      text.match(/\b([A-Za-z]{2,12})\b/g)?.slice(-1)?.[0],
    );
    return {
      intent: 'price',
      query: ticker,
      reply: 'Here is the latest market read from OKX.',
    };
  }

  const likelyTicker = sanitizeTicker(
    text.match(/\b([A-Za-z]{2,12})\b/g)?.slice(-1)?.[0],
  );
  return {
    intent: likelyTicker ? 'search' : 'unknown',
    query: likelyTicker,
    reply: DEFAULT_CHAT_REPLY,
  };
}

async function decideIntent(
  walletAddress: string,
  message: string,
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<IntentDecisionResult> {
  const provider = getLlmConfig().provider;

  try {
    const response = await llmJsonResponse([
      {
        role: 'system',
        content: [
          'You are SynthLaunch AI for X Layer, backed by OKX Onchain OS.',
          'Return JSON with keys: intent, reply, query, fromToken, toToken, amount, watchTokens, riskBias.',
          'Valid intents: balances, price, search, swap, suggestion, unknown.',
          'Only mention X Layer and OKX.',
          'riskBias may be conservative, balanced, aggressive, or unchanged.',
          `Current wallet: ${walletAddress}`,
        ].join('\n'),
      },
      ...recentMessages.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      { role: 'user', content: message },
    ]);

    if (!response.content) {
      return {
        decision: extractHeuristics(message),
        llm: {
          source: 'heuristic',
          provider: response.provider,
          fallbackReason: 'LLM returned an empty response.',
        },
      };
    }

    const stripped = response.content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    const jsonStart = stripped.indexOf('{');
    const jsonEnd = stripped.lastIndexOf('}');
    const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? stripped.slice(jsonStart, jsonEnd + 1) : stripped;
    const parsed = JSON.parse(jsonText) as LlmDecision;
    if (!parsed.intent) {
      return {
        decision: extractHeuristics(message),
        llm: {
          source: 'heuristic',
          provider: response.provider,
          fallbackReason: 'LLM response did not include an intent.',
        },
      };
    }

    return {
      decision: parsed,
      llm: {
        source: response.source,
        provider: response.provider,
        fallbackReason: null,
      },
    };
  } catch (error) {
    const fallbackReason =
      error instanceof Error ? error.message : 'LLM request failed';
    logAiEvent(
      'llm_fallback',
      {
        walletAddress,
        provider,
        fallbackReason,
      },
      'warn',
    );
    return {
      decision: extractHeuristics(message),
      llm: {
        source: 'heuristic',
        provider,
        fallbackReason,
      },
    };
  }
}

function toWatchToken(token: TokenSearchItem): AiWatchToken {
  return {
    symbol: token.tokenSymbol,
    address: token.tokenContractAddress,
    name: token.tokenName,
  };
}

function preferBestToken(results: TokenSearchItem[], query?: string): TokenSearchItem | null {
  if (results.length === 0) return null;
  const normalizedQuery = sanitizeTicker(query);
  const exactSymbol = results.find(
    (item) => sanitizeTicker(item.tokenSymbol) === normalizedQuery,
  );
  return exactSymbol ?? results[0] ?? null;
}

async function resolveToken(query?: string): Promise<TokenSearchItem | null> {
  const normalized = normalizeTokenQuery(query);
  if (!normalized) {
    return null;
  }

  if (normalized === 'OKB' || normalized === 'XLAYER') {
    return {
      chainIndex: '196',
      tokenName: 'OKB',
      tokenSymbol: 'OKB',
      tokenContractAddress: OKX_NATIVE_TOKEN_ADDRESS,
      decimal: '18',
      explorerUrl: 'https://www.oklink.com/xlayer',
      price: '',
    };
  }

  const results = await okxTokenSearch(normalized);
  return preferBestToken(results as TokenSearchItem[], normalized);
}

function formatDecisionReply(
  decision: LlmDecision,
  fallback: string,
): string {
  return decision.reply?.trim() || fallback;
}

function formatSuggestion(
  token: TokenSearchItem,
): { verdict: 'bullish' | 'neutral' | 'cautious'; reason: string } {
  const change = Number(token.change ?? '0');
  const liquidity = Number(token.liquidity ?? '0');

  if (change > 8 && liquidity > 100000) {
    return {
      verdict: 'bullish',
      reason:
        'Momentum is strong and liquidity is healthy, but you should still expect volatility on fresh moves.',
    };
  }

  if (change < -5 || liquidity < 10000) {
    return {
      verdict: 'cautious',
      reason:
        'Liquidity is thin or the token is already under pressure, so chasing here adds execution risk.',
    };
  }

  return {
    verdict: 'neutral',
    reason:
      'Market structure is tradeable but not decisive. Consider scaling in only if it fits your risk plan.',
  };
}

function decimalToBaseUnits(amount: string, decimals: number): string {
  const [wholePart, fractionalPart = ''] = amount.split('.');
  const normalizedWhole = wholePart.replace(/[^\d]/g, '') || '0';
  const normalizedFraction = fractionalPart.replace(/[^\d]/g, '');
  const paddedFraction = `${normalizedFraction}${'0'.repeat(decimals)}`.slice(
    0,
    decimals,
  );
  return `${BigInt(normalizedWhole)}${paddedFraction}`.replace(/^0+(?=\d)/, '') || '0';
}

function getSwapExecutionData(payload: Record<string, unknown>): {
  to: string;
  data: string;
  value: string;
  amountOut?: string;
  minAmountOut?: string;
} {
  const tx = (payload.tx ?? payload.txData ?? payload.transaction) as
    | Record<string, unknown>
    | undefined;
  return {
    to: String(tx?.to ?? payload.to ?? ''),
    data: String(tx?.data ?? payload.data ?? '0x'),
    value: String(tx?.value ?? payload.value ?? '0'),
    amountOut: payload.amountOut ? String(payload.amountOut) : undefined,
    minAmountOut: payload.minAmountOut
      ? String(payload.minAmountOut)
      : undefined,
  };
}

function createOkxRuntime(
  operation: AiOkxRuntime['operation'],
  status: AiOkxRuntime['status'],
  detail?: string | null,
): AiOkxRuntime {
  return {
    operation,
    status,
    detail: detail ?? null,
  };
}

export async function POST(request: NextRequest) {
  const walletAddress = getAuthenticatedAiWallet();

  try {
    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: string;
      message?: string;
    };

    if (!walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!body.message) {
      return NextResponse.json(
        { error: 'Missing message' },
        { status: 400 },
      );
    }

    const { user: currentUser, session } = await getOrCreateAiSession(
      walletAddress,
      body.sessionId,
    );
    const history = await getAiHistory(walletAddress, session.id);
    const recentMessages = history.messages.slice(-8).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    const userMessage = await insertAiMessage({
      sessionId: session.id,
      walletAddress,
      role: 'user',
      content: body.message,
    });

    const { decision, llm } = await decideIntent(
      walletAddress,
      body.message,
      recentMessages,
    );

    let toolResult: AiToolResult | undefined;
    let actionId: string | undefined;
    let okxRuntime = createOkxRuntime('search', 'ok');
    const watchlistAdditions: AiWatchToken[] = [];

    try {
      switch (decision.intent) {
        case 'balances': {
          okxRuntime = createOkxRuntime('balances', 'ok');
          const [balances, totals] = await Promise.all([
            okxBalances(walletAddress),
            okxTotalValue(walletAddress).catch(() => []),
          ]);
          toolResult = {
            type: 'balances',
            totalValueUsd: totals[0]?.totalValue ?? null,
            balances: balances.slice(0, 12),
          };
          break;
        }
        case 'price':
        case 'search':
        case 'suggestion': {
          okxRuntime = createOkxRuntime(
            decision.intent === 'price'
              ? 'price'
              : decision.intent === 'suggestion'
                ? 'suggestion'
                : 'search',
            'ok',
          );
          const query =
            normalizeTokenQuery(decision.query) ??
            normalizeTokenQuery(body.message) ??
            'OKB';
          const results =
            decision.intent === 'search'
              ? ((await okxTokenSearch(query)) as TokenSearchItem[])
              : [];
          const token =
            decision.intent === 'search'
              ? preferBestToken(results, query)
              : await resolveToken(query);

          if (!token) {
            toolResult = {
              type: 'error',
              title: 'Token not found',
              detail: `I could not find a token match for "${query}" on X Layer.`,
            };
            okxRuntime = createOkxRuntime(okxRuntime.operation, 'error', toolResult.detail);
            break;
          }

          watchlistAdditions.push(toWatchToken(token));

          if (decision.intent === 'search') {
            toolResult = {
              type: 'search',
              query,
              results: results.slice(0, 8),
            };
            break;
          }

          if (decision.intent === 'suggestion') {
            const suggestion = formatSuggestion(token);
            toolResult = {
              type: 'suggestion',
              token,
              verdict: suggestion.verdict,
              reason: suggestion.reason,
            };
            break;
          }

          toolResult = {
            type: 'price',
            token,
          };
          break;
        }
        case 'swap': {
          okxRuntime = createOkxRuntime('swap', 'ok');
          const [fromToken, toToken] = await Promise.all([
            resolveToken(decision.fromToken),
            resolveToken(decision.toToken),
          ]);

          if (!fromToken || !toToken || !decision.amount) {
            toolResult = {
              type: 'error',
              title: 'Swap details incomplete',
              detail:
                'Tell me the amount and token pair, for example: swap 0.2 OKB to USDT.',
            };
            okxRuntime = createOkxRuntime('swap', 'error', toolResult.detail);
            break;
          }

          watchlistAdditions.push(toWatchToken(fromToken), toWatchToken(toToken));
          const amountBase = decimalToBaseUnits(
            decision.amount,
            Number(fromToken.decimal || '18'),
          );
          const userSlippage = (currentUser as unknown as { slippage?: string }).slippage;
          const slippage =
            (typeof userSlippage === 'string' && userSlippage.trim().length > 0
              ? userSlippage
              : process.env.AI_DEFAULT_SLIPPAGE) || '0.5';
          const swapData = await okxSwap({
            fromTokenAddress: fromToken.tokenContractAddress,
            toTokenAddress: toToken.tokenContractAddress,
            amount: amountBase,
            userWalletAddress: walletAddress,
            slippage,
          });
          const first = swapData[0] ?? {};
          const execution = getSwapExecutionData(first);

          if (!execution.to || !execution.data) {
            toolResult = {
              type: 'error',
              title: 'Swap route unavailable',
              detail: 'OKX did not return executable transaction data for this route.',
            };
            okxRuntime = createOkxRuntime('swap', 'error', toolResult.detail);
            break;
          }

          const action = await recordAiAction({
            sessionId: session.id,
            walletAddress,
            actionType: 'swap_quote',
            status: 'quoted',
            payload: {
              provider: llm.provider,
              llmSource: llm.source,
              okxStatus: okxRuntime.status,
              fromToken,
              toToken,
              amountIn: decision.amount,
              execution,
            },
          });
          actionId = action.id;
          toolResult = {
            type: 'swapQuote',
            tokenIn: fromToken,
            tokenOut: toToken,
            amountIn: decision.amount,
            amountOut: execution.amountOut,
            minAmountOut: execution.minAmountOut,
            slippage,
            execution: {
              to: execution.to,
              data: execution.data,
              value: execution.value,
            },
            actionId,
          };
          break;
        }
        default: {
          okxRuntime = createOkxRuntime('search', 'ok');
          toolResult = {
            type: 'search',
            query: 'OKB',
            results: ((await okxTokenSearch('OKB')) as TokenSearchItem[]).slice(0, 3),
          };
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'OKX request failed';
      okxRuntime = createOkxRuntime(okxRuntime.operation, 'error', detail);
      toolResult = {
        type: 'error',
        title: 'OKX request failed',
        detail,
      };
      logAiEvent(
        'okx_error',
        {
          walletAddress,
          operation: okxRuntime.operation,
          detail,
        },
        'warn',
      );
    }

    const nextWatchlist = mergeWatchTokens(
      currentUser.watchlist,
      watchlistAdditions,
    );
    const nextRiskBias =
      decision.riskBias && decision.riskBias !== 'unchanged'
        ? decision.riskBias
        : currentUser.riskBias;
    const user = await updateAiUser(walletAddress, {
      watchlist: nextWatchlist,
      riskBias: nextRiskBias,
      lastSessionId: session.id,
    });

    const metadata: AiMessageMetadata = {
      ...(toolResult ? { toolResult } : {}),
      ...(actionId ? { actionId } : {}),
      llm,
      okx: okxRuntime,
    };

    const assistantMessage = await insertAiMessage({
      sessionId: session.id,
      walletAddress,
      role: 'assistant',
      content: formatDecisionReply(decision, DEFAULT_CHAT_REPLY),
      metadata,
    });

    return NextResponse.json({
      session,
      user,
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    logAiEvent(
      'route_error',
      {
        detail: error instanceof Error ? error.message : 'AI request failed',
      },
      'error',
    );
    const message =
      error instanceof Error ? error.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
