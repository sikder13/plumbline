/** @type {import('next').NextConfig} */
const config = {
  // The review app runs on this machine only. It reads the local database and evidence files.
  transpilePackages: ['@plumbline/core', '@plumbline/impact', '@plumbline/checks', '@plumbline/wave'],
  serverExternalPackages: ['better-sqlite3'],
  devIndicators: false,
  poweredByHeader: false,
};

export default config;
