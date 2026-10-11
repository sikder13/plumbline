import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/cli/src/**/*.test.ts'],
    // The budget limits normally come from .env, which a fresh checkout does not have.
    env: { BUDGET_ASK_ABOVE_USD: '25', BUDGET_TOTAL_USD: '30' },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
  },
});
