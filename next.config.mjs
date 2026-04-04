/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  typescript: {
    // Type checking done separately; skip during build to avoid OOM on Vercel
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['wagmi', '@tanstack/react-query', 'viem'],
    serverComponentsExternalPackages: ['@aws-sdk/client-kms', '@aws-sdk/client-iam', 'asn1.js', 'aws-kms-signer', 'ethers'],
  },
  webpack: (config, { isServer }) => {
    // Enable WASM support (required by @polkadot/wasm-crypto)
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    // Polkadot packages must run client-side only
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        '@polkadot/keyring',
        '@polkadot/util-crypto',
        '@polkadot/util',
        '@polkadot/wasm-crypto',
      ];
    }
    return config;
  },
};

export default nextConfig;
