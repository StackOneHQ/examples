/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/connect/oauth2/:provider/callback',
        destination: '/api/connect/oauth2/:provider/callback',
      },
      {
        source: '/connect/oauth2/callback',
        destination: '/api/connect/oauth2/callback',
      },
    ];
  },
};

module.exports = nextConfig;
