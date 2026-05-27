/**
 * Canonical EIP-191 message for the admin settle endpoint.
 *
 * The server rebuilds this from the request body and rejects the call
 * unless the client-supplied `x-admin-message` is byte-for-byte identical.
 * That closes the substring-binding hole where a captured admin signature
 * for `Outcome: Brazil wins 2-1` could be replayed with body
 * `outcome: "Brazil"` (substring still matched).
 */
export function buildAdminSettleMessage(params: {
  templateId: string;
  targetMatch: string;
  outcome: string;
  cutoffTimestamp: string;
  dryRun: boolean;
  timestamp: string;
}): string {
  return [
    'Synth SportFi Arena Admin Settle',
    'Chain: X Layer mainnet',
    'Chain ID: 196',
    `Template: ${params.templateId}`,
    `Target Match: ${params.targetMatch}`,
    `Outcome: ${params.outcome}`,
    `Cutoff Timestamp: ${params.cutoffTimestamp}`,
    `Dry Run: ${params.dryRun ? 'true' : 'false'}`,
    `Timestamp: ${params.timestamp}`,
  ].join('\n');
}
