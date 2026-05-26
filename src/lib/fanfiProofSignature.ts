export function buildFanFiReceiptMessage(params: {
  fanId: string;
  templateId: string;
  objective: string;
  targetMatch: string;
  tone: string;
  wallet: string;
  timestamp: string;
  xLayerTxHash?: string;
}): string {
  return [
    'Synth SportFi Arena Receipt Proof',
    'Chain: X Layer mainnet',
    'Chain ID: 196',
    `Fan ID: ${params.fanId}`,
    `Template: ${params.templateId}`,
    `Match: ${params.targetMatch}`,
    `Objective: ${params.objective}`,
    `Tone: ${params.tone}`,
    `Wallet: ${params.wallet}`,
    `X Layer Tx Hash: ${params.xLayerTxHash?.trim() || 'none'}`,
    `Timestamp: ${params.timestamp}`,
  ].join('\n');
}

export function buildFanFiMissionMessage(params: {
  fanId: string;
  missionId: string;
  proof: string;
  wallet: string;
  timestamp: string;
}): string {
  return [
    'Synth SportFi Arena Mission Proof',
    'Chain: X Layer mainnet',
    'Chain ID: 196',
    `Fan ID: ${params.fanId}`,
    `Mission ID: ${params.missionId}`,
    `Proof: ${params.proof}`,
    `Wallet: ${params.wallet}`,
    `Timestamp: ${params.timestamp}`,
  ].join('\n');
}
