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
    if (isServer) {
      // On server, mark polkadot as external so it doesn't try to bundle WASM
      const orig = config.externals;
      config.externals = [
        ...(Array.isArray(orig) ? orig : orig ? [orig] : []),
        ({ request }, callback) => {
          if (request && request.startsWith('@polkadot/')) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
