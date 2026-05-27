export interface FanFiCampaignTemplate {
  id: string;
  team: string;
  agentType: string;
  name: string;
  symbol: string;
  description: string;
  mission: string;
  launchTweet: string;
  twitterHandle: string;
}

export const FANFI_CAMPAIGN_TEMPLATES: FanFiCampaignTemplate[] = [
  {
    id: 'brazil',
    team: 'Brazil',
    agentType: 'Team Path Market',
    name: 'Brazil Bracket Arena',
    symbol: 'BRZAI',
    description:
      'A World Cup Season One prediction arena for Brazil vs France calls, confidence, reasoning, receipt proof, and settlement on X Layer.',
    mission:
      'Rally Brazil supporters into prediction receipts with direction, probability, reasoning, settlement notes, and public leaderboard proof.',
    launchTweet:
      'Brazil Bracket Arena is live on X Layer. Predict the path, submit proof, and climb the X Cup prediction board.',
    twitterHandle: 'SynthFanFi',
  },
  {
    id: 'final',
    team: 'Final Match',
    agentType: 'Match Result Market',
    name: 'Final Result Arena',
    symbol: 'FINALX',
    description:
      'A World Cup match-day arena that turns winners, scorelines, overtime, and key goals into auditable prediction receipts.',
    mission:
      'Convert final-match attention into verifiable X Layer receipts, settlement proof, OKX review paths, and public ranking.',
    launchTweet:
      'Final Result Arena is coming to X Layer for X Cup. One match, many forecasts, all organized for proof and ranking.',
    twitterHandle: 'SynthFanFi',
  },
  {
    id: 'player',
    team: 'Golden Boot',
    agentType: 'Player Prop Market',
    name: 'Golden Boot Prop Arena',
    symbol: 'SCORER',
    description:
      'An AI-powered World Cup player prop arena for Golden Boot races, assists, best-player calls, saves, cards, and objective settlement.',
    mission:
      'Convert player attention into prediction challenges, X account content, OKX watchlists, and public leaderboard momentum.',
    launchTweet:
      'Golden Boot Prop Arena is entering Synth SportFi Arena. Player calls, proof, and X Layer prediction momentum for X Cup.',
    twitterHandle: 'SynthFanFi',
  },
  {
    id: 'var',
    team: 'VAR',
    agentType: 'Sentiment Market',
    name: 'VAR Meme Market',
    symbol: 'VARDAO',
    description:
      'A non-cash World Cup sentiment arena for VAR drama, penalty debates, red cards, and viral meme heat on X Layer.',
    mission:
      'Turn match controversy into forecastable social activity with AI-generated memes, posts, proof notes, and ranking hooks.',
    launchTweet:
      'VAR Meme Market is live for X Cup builders. Football drama, AI memes, and prediction leaderboard energy on X Layer.',
    twitterHandle: 'SynthFanFi',
  },
  {
    id: 'scout',
    team: 'Top Scorer',
    agentType: 'Trading Scout',
    name: 'OKX Momentum Scout',
    symbol: 'GOALAI',
    description:
      'An AI trading handoff scout for hot World Cup prediction arenas, market assets, OKX/X Layer search, quote checks, and momentum tracking.',
    mission:
      'Show the OKX/X Layer trading handoff through a scout that explains prediction heat, watchlists, balances, and swap routes.',
    launchTweet:
      'OKX Momentum Scout brings SportFi watchlists to X Layer. AI prediction agent, market asset, OKX flow, public leaderboard.',
    twitterHandle: 'SynthFanFi',
  },
];

export function getFanFiCampaignTemplate(templateId: string): FanFiCampaignTemplate | undefined {
  return FANFI_CAMPAIGN_TEMPLATES.find((template) => template.id === templateId);
}
