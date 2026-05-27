/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  images: {
    domains: ['localhost'],
  },
  async redirects() {
    return [
      {
        source: '/fanfi/xcup/audit',
        destination: '/fanfi/xcup',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/synth-wallet',
          destination: '/synth-wallet/index.html',
        },
        {
          source: '/synth-wallet/',
          destination: '/synth-wallet/index.html',
        },
        {
          source: '/build-x-hook',
          destination: '/build-x-hook/index.html',
        },
        {
          source: '/build-x-hook/',
          destination: '/build-x-hook/index.html',
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: '/synth-wallet',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/synth-wallet/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/synth-wallet/index.html',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/synth-wallet/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache',
          },
        ],
      },
      {
        source: '/synth-wallet/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/build-x-hook',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/build-x-hook/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/build-x-hook/index.html',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/build-x-hook/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
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
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };
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
