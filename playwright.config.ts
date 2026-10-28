import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'journey.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8017', browserName: 'chromium', headless: true, trace: 'off' },
  webServer: {
    command: 'php artisan serve --host=127.0.0.1 --port=8017 --no-reload',
    url: 'http://127.0.0.1:8017',
    reuseExistingServer: false,
    env: { APP_ENV: 'testing', MIREMBE_AI_MODE: 'demo', SESSION_DRIVER: 'array', CACHE_STORE: 'array', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' },
  },
});
