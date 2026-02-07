type ParsedCommand = {
  targetHandle: string;
  tokenName?: string;
  symbol?: string;
  taxRate?: number;
};

// Match: @SynthBot219518b 发币 @target
const BOT_MENTION_REGEX = /@SynthBot219518b/i;
const COMMAND_KEYWORD = /发币|launch/i;
const HANDLE_REGEX = /@([A-Za-z0-9_]{1,15})/g;

function normalizeToken(token: string): string {
  return token.replace(/^[\s,，。.;:：]+|[\s,，。.;:：]+$/g, '');
}

function parseKeyValue(input: string): { key: string; value: string } | null {
  const cleaned = normalizeToken(input);
  // Support both : and ： (Chinese colon)
  const match = cleaned.match(/^(税率|tax|名字|名称|name|代号|符号|symbol)[:：]\s*(.+)$/i);
  if (match) {
    return { key: match[1].toLowerCase(), value: match[2] };
  }
  return null;
}

export function parseCommand(tweetText: string): ParsedCommand | null {
  if (!tweetText) return null;

  // Must mention the bot
  if (!BOT_MENTION_REGEX.test(tweetText)) return null;
  
  // Must have 发币 or launch keyword
  if (!COMMAND_KEYWORD.test(tweetText)) return null;

  // Find all @handles (excluding the bot itself and placeholder "xxx")
  const handles: string[] = [];
  let match;
  while ((match = HANDLE_REGEX.exec(tweetText)) !== null) {
    const handle = match[1];
    const lower = handle.toLowerCase();
    // Skip bot mention and placeholder handles
    if (lower !== 'synthbot219518b' && lower !== 'xxx' && lower !== 'example') {
      handles.push(handle);
    }
  }

  // Need at least one target handle
  if (handles.length === 0) return null;

  const targetHandle = handles[0];
  
  // Parse optional parameters
  const parts = tweetText.split(/\s+/).map(normalizeToken).filter(Boolean);
  
  let tokenName: string | undefined;
  let symbol: string | undefined;
  let taxRate: number | undefined;

  for (const part of parts) {
    const kv = parseKeyValue(part);
    if (kv) {
      switch (kv.key) {
        case '税率':
        case 'tax':
          const rate = parseFloat(kv.value.replace('%', ''));
          if (!isNaN(rate) && rate >= 0 && rate <= 10) {
            taxRate = rate;
          }
          break;
        case '名字':
        case '名称':
        case 'name':
          tokenName = kv.value;
          break;
        case '代号':
        case '符号':
        case 'symbol':
          symbol = kv.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
          break;
      }
    }
    
    // Also support $SYMBOL format
    if (part.startsWith('$') && part.length > 1) {
      symbol = part.slice(1).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    
    // Support standalone percentage as tax
    if (part.match(/^\d+(\.\d+)?%$/)) {
      const rate = parseFloat(part);
      if (!isNaN(rate) && rate >= 0 && rate <= 10) {
        taxRate = rate;
      }
    }
  }

  const defaultName = `${targetHandle} Coin`;
  const defaultSymbol = targetHandle.slice(0, 4).toUpperCase();

  return {
    targetHandle,
    tokenName: tokenName || defaultName,
    symbol: symbol || defaultSymbol,
    taxRate: taxRate ?? 2,
  };
}

export type { ParsedCommand };
