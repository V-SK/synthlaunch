export type FanFiMissionCategory = 'setup' | 'content' | 'prediction' | 'trading' | 'proof';

export interface FanFiMission {
  id: string;
  category: FanFiMissionCategory;
  title: string;
  points: number;
  description: string;
  proofLabel: string;
  proofPlaceholder: string;
  draft?: string;
}

export const FANFI_MISSIONS: FanFiMission[] = [
  {
    id: 'choose-campaign',
    category: 'setup',
    title: 'Choose Prediction Market',
    points: 40,
    description: 'Pick the World Cup match and the objective settlement rule this arena will represent.',
    proofLabel: 'Market angle',
    proofPlaceholder: 'Example: Brazil vs France match result, settled by official final score',
  },
  {
    id: 'write-launch-draft',
    category: 'content',
    title: 'Write Market Brief',
    points: 80,
    description: 'Prepare the market brief, prediction question, settlement note, and X account hook for Season One.',
    proofLabel: 'Market copy',
    proofPlaceholder: 'Paste the prediction question, settlement note, thread hook, or X account copy here.',
    draft:
      'Synth SportFi Arena turns World Cup attention into AI prediction arenas on X Layer. Create Brazil vs France, submit direction + probability + reason, settle by rules, and climb the leaderboard.',
  },
  {
    id: 'submit-prediction',
    category: 'prediction',
    title: 'Submit Prediction Receipt',
    points: 90,
    description: 'Submit direction, probability, and reasoning so the forecast can be ranked after settlement.',
    proofLabel: 'Receipt',
    proofPlaceholder: 'Example: Brazil wins / 58% / transition speed and set-piece pressure',
  },
  {
    id: 'create-fan-content',
    category: 'content',
    title: 'Create Fan Argument',
    points: 100,
    description: 'Write a take, meme idea, or match-day argument that supports a prediction side.',
    proofLabel: 'Argument',
    proofPlaceholder: 'Example: A prediction thread, meme caption, or match-day argument',
  },
  {
    id: 'launch-or-attach-token',
    category: 'proof',
    title: 'Attach X Layer Proof',
    points: 250,
    description: 'Attach market proof, settlement proof, prediction receipt hash, market asset address, or transaction hash.',
    proofLabel: 'Proof, address, or tx hash',
    proofPlaceholder: 'Settlement note, 0x... address, or X Layer transaction hash',
  },
  {
    id: 'review-trading-flow',
    category: 'trading',
    title: 'Review OKX Flow',
    points: 120,
    description: 'Record the intended watchlist, token search, quote, or swap handoff path for a hot prediction arena.',
    proofLabel: 'Flow note',
    proofPlaceholder: 'Example: Check OKB balance, search market asset, then route quote through OKX swap UI',
  },
];

export function getFanFiMission(missionId: string): FanFiMission | undefined {
  return FANFI_MISSIONS.find((mission) => mission.id === missionId);
}
