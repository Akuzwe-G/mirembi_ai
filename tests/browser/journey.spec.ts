import { expect, test, type Page } from '@playwright/test';
import { access, analysis, concern } from '../frontend/fixtures';

async function mockJourney(page: Page) {
  const state = { messages: [] as { id: number; role: string; content: string }[], concerns: [] as typeof concern[], calls: [] as string[] };
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:8017') return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    state.calls.push(`${request.method()} ${url.pathname}`);
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (url.pathname === '/api/journeys' && request.method() === 'POST') return json({ ...access, phase: 'express' }, 201);
    expect(request.headers().authorization).toBe(`Bearer ${access.access_token}`);
    expect(request.url()).not.toContain(access.access_token);
    const root = `/api/journeys/${access.journey_id}`;
    if (url.pathname === root && request.method() === 'GET') return json({ journey: { id: access.journey_id, phase: 'clarify' }, messages: state.messages, concerns: state.concerns, actions: [] });
    if (url.pathname === `${root}/messages`) {
      state.messages.push({ id: state.messages.length + 1, role: 'user', content: request.postDataJSON().message }, { id: state.messages.length + 2, role: 'assistant', content: analysis.reflection });
      state.concerns = [{ ...concern }];
      return json({ phase: 'clarify', analysis, concerns: state.concerns });
    }
    if (url.pathname === `${root}/concerns/1` && request.method() === 'PATCH') {
      state.concerns[0] = { ...state.concerns[0], ...request.postDataJSON() };
      return json(state.concerns[0]);
    }
    if (url.pathname === `${root}/confirm`) {
      state.concerns[0].confirmed = true;
      return json({ phase: 'focus', concerns: state.concerns });
    }
    if (url.pathname === root && request.method() === 'DELETE') return route.fulfill({ status: 204 });
    return route.fulfill({ status: 500, json: { error: 'Unmocked route' } });
  });
  return state;
}

for (const width of [320, 390, 768, 1440]) {
  test(`welcome and journey are usable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.name));
    const state = await mockJourney(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A little less noise.A little more clarity.');
    await expect(page.getByRole('button', { name: 'Begin my journey' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) await page.screenshot({ path: 'storage/app/frontend-welcome-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Begin my journey' }).click();
    await page.getByRole('textbox', { name: 'Your message to Mirembe' }).fill('Help me organise my assignment.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(analysis.clarification_question!)).toBeVisible();
    await expect(page.getByText('An optional grounding step')).toBeVisible();
    if (width < 1024) await page.getByRole('tab', { name: /Clarity Map/ }).click();
    await expect(page.getByRole('heading', { name: 'Coursework' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit Coursework' }).click();
    await page.getByLabel('Concern', { exact: true }).fill('My assignment');
    await page.getByLabel('Category', { exact: true }).fill('study');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Needs your review')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm My assignment' }).click();
    await expect(page.getByText('Confirmed by you', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) await page.screenshot({ path: 'storage/app/frontend-map-mobile.png', fullPage: true });
    await page.reload();
    await expect(page.getByText(analysis.clarification_question!)).toBeVisible();
    expect(state.calls.filter(call => call.endsWith('/messages'))).toHaveLength(1);
    if (width === 1440) await page.screenshot({ path: 'storage/app/frontend-journey-desktop.png', fullPage: true });
    if (width === 390) await page.screenshot({ path: 'storage/app/frontend-conversation-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Clear journey' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete my journey' }).click();
    await expect(page.getByRole('button', { name: 'Begin my journey' })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('mirembe.guest.v1'))).toBeNull();
    expect(errors).toEqual([]);
  });
}

test('keyboard navigation, reduced motion and dialog cancellation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockJourney(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  const animation = await page.locator('.avatar-core').evaluate(element => getComputedStyle(element).animationName);
  expect(animation).toBe('none');
  await page.getByRole('button', { name: 'Begin my journey' }).click();
  await page.getByRole('tab', { name: 'Conversation' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Clarity Map' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Clarity Map' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Clear journey' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear journey' })).toBeFocused();
});
