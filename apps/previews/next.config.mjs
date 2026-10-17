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
  // Pages made to order are designed side by side, so a design still being written can hold a type error while
  // another page is built for publishing. With PREVIEWS_SKIP_TYPES=1 the build leaves type checking to a separate
  // run of tsc over the pages it publishes.
  ...(process.env.PREVIEWS_SKIP_TYPES === '1' ? { typescript: { ignoreBuildErrors: true } } : {}),
};

export default config;
