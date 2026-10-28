import { defineConfig } from '@playwright/test';
import base from './playwright.pwa.config';

export default defineConfig({ ...base, testMatch: 'voice.spec.ts', use: { ...base.use, serviceWorkers: 'block' } });
