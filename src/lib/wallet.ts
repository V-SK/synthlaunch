// Single source of truth for the SYNTH Wallet mobile binary.
// When releasing a new version: upload the APK to a new GitHub Release,
// recompute SHA256 (`shasum -a 256 SYNTH-Wallet-Android-<date>.apk`), and
// bump the four constants below.

export const SYNTH_WALLET = {
  version: '2026.04.17',
  releaseTag: 'wallet-v2026.04.17',
  releaseUrl: 'https://github.com/V-SK/synthlaunch/releases/tag/wallet-v2026.04.17',
  android: {
    apkUrl:
      'https://github.com/V-SK/synthlaunch/releases/download/wallet-v2026.04.17/SYNTH-Wallet-Android-2026-04-17-regression-fix.apk',
    sizeBytes: 5454418,
    sha256: '7c239f72f53a7ca4a813f7ebe776e77bea3e7d9be8c26827b72e8a4005990fa1',
  },
  ios: {
    available: false,
  },
} as const;
