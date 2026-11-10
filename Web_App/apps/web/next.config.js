/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000/api/:path*';
    return [
      {
        source: '/api/:path*',
        destination: backendUrl,
      },
    ];
  },
};

module.exports = nextConfig;
