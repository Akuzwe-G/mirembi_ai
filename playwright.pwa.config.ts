import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'pwa.spec.ts',
  timeout: 60000,
  use: { ...base.use, serviceWorkers: 'allow' },
  projects: [
    { name: 'android-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'ios-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
