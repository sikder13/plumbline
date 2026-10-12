/** @type {import('next').NextConfig} */
const config = {
  // Every page is written out as plain files. Nothing runs on a server.
  output: 'export',
  // The pages are reached through nahltech.com/demo/, so every address starts there.
  basePath: '/demo',
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
  poweredByHeader: false,
};

export default config;
