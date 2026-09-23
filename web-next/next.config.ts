import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The repo root also has a package-lock.json for the legacy static build, so
  // pin the workspace root here instead of letting Next guess.
  turbopack: { root: import.meta.dirname },
  // Token images come from third-party market APIs; allow only those hosts.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dd.dexscreener.com' },
      { protocol: 'https', hostname: 'coin-images.coingecko.com' },
      { protocol: 'https', hostname: 'assets.coingecko.com' },
    ],
  },
};

export default config;
