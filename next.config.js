/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a self-contained .next/standalone bundle for the Docker runtime.
  output: "standalone",
};

module.exports = nextConfig;
