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
};

export default nextConfig;
