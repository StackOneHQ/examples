/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/oauth2/:provider/callback',
        destination: '/api/oauth2/:provider/callback',
      },
    ];
  },
};

module.exports = nextConfig;
