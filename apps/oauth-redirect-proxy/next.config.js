/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/connect/oauth2/:provider/callback',
        destination: '/api/connect/oauth2/:provider/callback',
      },
    ];
  },
};

module.exports = nextConfig;
