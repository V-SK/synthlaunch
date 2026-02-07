type ParsedCommand = {
  targetHandle: string;
  tokenName?: string;
  symbol?: string;
  taxRate?: number;
};

const COMMAND_REGEX = /!发币|!launch/i;
const HANDLE_REGEX = /@([A-Za-z0-9_]{1,15})/;

function normalizeToken(token: string): string {
  return token.replace(/^[\s,，。.;:]+|[\s,，。.;:]+$/g, '');
}

function parseTaxValue(input: string): number | null {
  const cleaned = normalizeToken(input);
  const explicit = cleaned.match(/^(?:tax|税率)\s*=\s*(\d+(?:\.\d+)?)(?:%)?$/i);
  if (explicit) return Number(explicit[1]);

  const percent = cleaned.match(/^(\d+(?:\.\d+)?)%$/);
  if (percent) return Number(percent[1]);

  return null;
}

export function parseCommand(tweetText: string): ParsedCommand | null {
  if (!tweetText) return null;

  const cmdMatch = tweetText.match(COMMAND_REGEX);
  if (!cmdMatch || cmdMatch.index == null) return null;

  const afterCommand = tweetText.slice(cmdMatch.index + cmdMatch[0].length).trim();
  const handleMatch = afterCommand.match(HANDLE_REGEX);
  if (!handleMatch) return null;

  const targetHandle = handleMatch[1];
  const parts = afterCommand.split(/\s+/).map(normalizeToken).filter(Boolean);

  const handleIndex = parts.findIndex(part => part.toLowerCase() === `@${targetHandle}`.toLowerCase());
  const remaining = handleIndex === -1 ? parts.slice(1) : parts.slice(handleIndex + 1);

  let symbol: string | undefined;
  let taxRate: number | undefined;
  const nameTokens: string[] = [];

  for (const token of remaining) {
    const tax = parseTaxValue(token);
    if (tax != null && !Number.isNaN(tax)) {
      taxRate = tax;
      continue;
    }

    if (token.startsWith('$') && token.length > 1) {
      symbol = token.slice(1).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (!symbol) symbol = undefined;
      continue;
    }

    nameTokens.push(token);
  }

  const defaultName = `${targetHandle} Coin`;
  const defaultSymbol = targetHandle.slice(0, 4).toUpperCase();

  return {
    targetHandle,
    tokenName: nameTokens.length > 0 ? nameTokens.join(' ') : defaultName,
    symbol: symbol || defaultSymbol,
    taxRate: taxRate ?? 2,
  };
}

export type { ParsedCommand };
