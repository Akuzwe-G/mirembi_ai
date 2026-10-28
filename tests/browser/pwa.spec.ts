import { test, expect, chromium, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import lighthouse from 'lighthouse';
import AxeBuilder from '@axe-core/playwright';
import { access, analysis, snapshot } from '../frontend/fixtures';

async function ready(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 15000 });
}
async function mockPrivateJourney(page: Page) {
  await page.addInitScript(({ guest, data, result }) => {
    sessionStorage.setItem('mirembe.guest.v1', JSON.stringify({ access: guest, analysis: result }));
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input).startsWith('/api/journeys')) return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
      return nativeFetch(input, init);
    };
  }, { guest: access, data: snapshot, result: analysis });
}

test('manifest, icons, standalone metadata, installation guidance and orientation', async ({ page, request }, testInfo) => {
  await ready(page);
  const manifestResponse = await request.get('/build/manifest.webmanifest');
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ name: 'Mirembe AI', short_name: 'Mirembe', start_url: '/', scope: '/', display: 'standalone' });
  expect(manifest.icons.filter((icon: { purpose: string }) => icon.purpose === 'maskable')).toHaveLength(2);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
  await page.getByRole('button', { name: 'Open menu' }).click();
  if (testInfo.project.name === 'ios-webkit') {
    await page.getByRole('button', { name: 'Install on iPhone or iPad' }).click();
    await expect(page.getByText(/Tap Share, then Add to Home Screen/)).toBeVisible();
  } else {
    const cdp = await page.context().newCDPSession(page);
    const result = await cdp.send('Page.getAppManifest');
    expect(result.errors).toEqual([]);
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, { prompt: () => Promise.resolve(), userChoice: Promise.resolve({ outcome: 'dismissed' }) });
      window.dispatchEvent(event);
    });
    await expect(page.getByRole('button', { name: 'Install Mirembe' })).toBeVisible();
    await page.getByRole('button', { name: 'Install Mirembe' }).click();
  }
  await page.getByRole('button', { name: 'Close Your space' }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Enable microphone' })).toBeVisible();
});

test('shell launches offline without saving personal responses or serving APIs from caches', async ({ page, context }) => {
  await ready(page);
  const keys = await page.evaluate(async () => {
    const entries: string[] = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) entries.push(new URL(request.url).pathname);
    return entries;
  });
  expect(keys).toContain('/build/offline.html');
  expect(keys).toContain('/icons/apple-touch-icon.png');
  expect(keys.filter(key => key.endsWith('.woff2')).length).toBeGreaterThan(0);
  expect(keys.some(key => key.startsWith('/api/'))).toBe(false);
  expect(keys).not.toContain('/');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('offline');
  await expect(page.getByText('No journey has been saved offline on this device.')).toBeVisible();
  const outcomes = await page.evaluate(async () => Promise.all(['GET', 'POST', 'PATCH', 'DELETE'].map(async method => {
    try { await fetch('/api/pwa-cache-probe', { method, headers: { Authorization: 'Bearer fixture-only' } }); return 'served'; }
    catch { return 'network-only'; }
  })));
  expect(outcomes).toEqual(['network-only', 'network-only', 'network-only', 'network-only']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Enable microphone' })).toBeVisible();
});

test('only an explicit encrypted device copy can be unlocked offline and deleted locally', async ({ page, context }) => {
  await mockPrivateJourney(page);
  await ready(page);
  await page.getByRole('button', { name: 'Language and voice settings' }).click();
  const copy = page.getByRole('region', { name: 'Offline journey on this device' });
  await copy.locator('summary').click();
  await copy.getByLabel('Choose an offline passphrase').fill('my private offline phrase');
  await copy.getByRole('button', { name: 'Save encrypted offline copy' }).click();
  await expect(copy.getByRole('status')).toContainText('Encrypted copy saved');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('offline');
  await page.getByLabel('Unlock saved offline copy').fill('an incorrect passphrase');
  await page.getByRole('button', { name: 'Unlock read-only copy' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not unlock');
  await page.getByLabel('Unlock saved offline copy').fill('my private offline phrase');
  await page.getByRole('button', { name: 'Unlock read-only copy' }).click();
  await expect(page.getByRole('heading', { name: 'Your saved journey' })).toBeVisible();
  await expect(page.getByText(snapshot.messages[0].content)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send message' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lock saved copy' }).click();
  await expect(page.getByText(snapshot.messages[0].content)).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove saved device copy' }).click();
  await page.getByRole('button', { name: 'Delete device copy' }).click();
  await expect(page.getByText('No journey has been saved offline on this device.')).toBeVisible();
});

test('standalone launch hides install guidance and accessibility checks pass', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await ready(page);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByText('A little space on your home screen.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close Your space' }).click();
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
  await page.getByRole('button', { name: 'Language and voice settings' }).click();
  await expect(page.getByText('Language diagnostics · development only')).toHaveCount(0);
});

test('service worker updates wait for consent and remove obsolete precache assets', async ({ page }) => {
  await mockPrivateJourney(page);
  await ready(page);
  await page.getByRole('button', { name: 'Type instead' }).click();
  await page.getByRole('textbox', { name: 'Your message to Mirembe' }).fill('Keep this draft until I am ready.');
  await page.getByRole('button', { name: 'Close My Journey' }).click();
  await page.evaluate(async () => {
    const name = (await caches.keys()).find(name => name.startsWith('mirembe-static-precache'))!;
    await (await caches.open(name)).put('/build/assets/obsolete-regression.js', new Response('obsolete fixture'));
    await navigator.serviceWorker.register('/sw.js?update-regression=2', { scope: '/', updateViaCache: 'none' });
  });
  await expect(page.getByRole('button', { name: 'Update and reload' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update and reload' })).toBeDisabled();
  await page.getByRole('button', { name: 'Type instead' }).click();
  await page.getByRole('textbox', { name: 'Your message to Mirembe' }).fill('');
  await page.getByRole('button', { name: 'Close My Journey' }).click();
  await expect(page.getByRole('button', { name: 'Update and reload' })).toBeEnabled();
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Update and reload' }).click()]);
  await page.getByRole('button', { name: 'Type instead' }).click();
  await expect(page.getByText(snapshot.messages[0].content)).toBeVisible();
  const obsolete = await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      if (name.startsWith('mirembe-static-precache') && await cache.match('/build/assets/obsolete-regression.js')) return true;
    }
    return false;
  });
  expect(obsolete).toBe(false);
});

test('Lighthouse accessibility audit passes on the installed production bundle', async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'Lighthouse runs on Chromium; WebKit is covered by axe and browser tests.');
  test.setTimeout(120000);
  const browser = await chromium.launch({ headless: true, args: ['--remote-debugging-port=9227'] });
  try {
    const result = await lighthouse('http://127.0.0.1:8017/', { port: 9227, onlyCategories: ['accessibility'], output: 'json', logLevel: 'error' });
    if (!result) throw new Error('Lighthouse did not return an audit.');
    await writeFile('storage/app/pwa-lighthouse-accessibility.json', JSON.stringify(result.lhr, null, 2));
    expect(result.lhr.categories.accessibility.score).toBe(1);
  } finally { await browser.close(); }
});
