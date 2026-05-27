/**
 * Centralized admin / operator wallet identity.
 *
 * Used everywhere we verify "is this request from the SynthLaunch deployer?"
 * — the public deployer wallet address. Keep lowercase to make
 * case-insensitive comparisons cheap.
 */
export const ADMIN_ADDRESS = '0x0198b366978ff0ee67bf308b0367c9b6fced2725' as const;

export function isAdminAddress(value: string | undefined | null): boolean {
  return Boolean(value) && value!.toLowerCase() === ADMIN_ADDRESS;
}
