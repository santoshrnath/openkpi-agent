/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a self-contained .next/standalone bundle for the Docker runtime.
  output: "standalone",
  webpack: (config, { isServer }) => {
    // alasql ships a `node` entry that imports react-native-fs and
    // react-native-fetch-blob for its (unused) file-system extensions.
    // We never call those, so stub the modules to silence the webpack error.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "react-native-fs": false,
      "react-native-fetch-blob": false,
    };
    if (!isServer) {
      // alasql's node entry also references `fs` and `path`. Belt-and-braces
      // shim for the client bundle.
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
