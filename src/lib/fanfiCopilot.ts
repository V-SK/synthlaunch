import { getFanFiCampaignTemplate } from '@/lib/fanfiCampaigns';

export interface FanFiCopilotPack {
  templateId: string;
  agentName: string;
  symbol: string;
  persona: string;
  voice: string;
  campaignMission: string;
  tokenDescription: string;
  launchDraft: string;
  tweetThread: string[];
  okxFlow: string;
  auditNotes: string[];
  generatedAt: string;
  source: 'local-copilot';
}

function clean(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : fallback;
}

function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function createFanFiCopilotPack(params: {
  templateId: string;
  fanId?: string;
  objective?: string;
  targetMatch?: string;
  tone?: string;
}): FanFiCopilotPack {
  const template = getFanFiCampaignTemplate(params.templateId);
  if (!template) {
    throw new Error('Unknown FanFi campaign template');
  }

  const fanId = clean(params.fanId, 'fanfi-captain');
  const targetMatch = clean(params.targetMatch, template.team);
  const voice = clean(params.tone, 'sharp, concise, prediction-first');
  const objective = clean(params.objective, template.mission);
  const mission = `${sentence(objective)} Turn ${targetMatch} attention into prediction receipts, settlement proof, X Layer activity, and leaderboard momentum.`;
  const persona = `${template.name} is a ${voice} ${template.agentType.toLowerCase()} for ${targetMatch}. It speaks to fans like a match-day prediction host: one clear question, direction + probability + reasoning, settlement reminders, and proof-first onchain prompts.`;
  const tokenDescription = `${template.description} Built for ${fanId} with X Layer chain 196, OKB quote checks, prediction receipts, leaderboard routing, and community asset proof.`;
  const okxFlow = `Inspect OKB balance, search ${template.symbol} as the arena market asset, build an OKX quote, and route any swap through wallet confirmation.`;
  const launchDraft = [
    `${template.name} is entering Synth SportFi Prediction Arena on X Layer.`,
    `Persona: ${persona}`,
    `Prediction arena: ${mission}`,
    `Market asset: $${template.symbol} - ${tokenDescription}`,
    `OKX flow: ${okxFlow}`,
  ].join('\n');

  return {
    templateId: template.id,
    agentName: template.name,
    symbol: template.symbol,
    persona,
    voice,
    campaignMission: mission,
    tokenDescription,
    launchDraft,
    tweetThread: [
      `${template.name} is entering Synth SportFi Prediction Arena for the X Cup.`,
      `Fans can forecast ${targetMatch} with direction, probability, and reasoning, then submit proof on X Layer.`,
      `OKX flow prepared: OKB balance check, market asset search, quote, and wallet-confirmed swap routing.`,
    ],
    okxFlow,
    auditNotes: [
      'Use the generated market prompt in Prediction Arena Studio.',
      'Collect direction, probability, reasoning, settlement notes, and X Layer proof for the arena.',
      'Use market asset or transaction proof as the receipt anchor for ranking and OKX handoff.',
    ],
    generatedAt: new Date().toISOString(),
    source: 'local-copilot',
  };
}
