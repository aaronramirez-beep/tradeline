import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 15000,
  use: {
    headless: true,
  },
  webServer: {
    command: 'npx serve . -l 3456 --no-clipboard',
    port: 3456,
    reuseExistingServer: true,
  },
});
