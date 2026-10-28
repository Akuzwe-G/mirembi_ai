import { expect, test } from '@playwright/test';
import { access, analysis, concern } from '../frontend/fixtures';

test('explicit activation, microphone cleanup and typing fallback', async ({ page }) => {
  await page.addInitScript(() => {
    let active: Recognition | undefined;
    class Recognition {
      onstart: (() => void) | null = null;
      onresult: ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null;
      start() { active = this; this.onstart?.(); }
      stop() {}
      abort() {}
    }
    window.addEventListener('test:transcript', event => active?.onresult?.({ results: [{ isFinal: true, 0: { transcript: (event as CustomEvent<string>).detail } }] }));
    Object.defineProperty(window, 'SpeechRecognition', { value: Recognition });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    class Utterance {
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [], addEventListener() {}, removeEventListener() {}, resume() {}, cancel() {},
      speak(utterance: Utterance) { setTimeout(() => { utterance.onstart?.(); utterance.onend?.(); }, 10); },
    } });
  });
  let submissions = 0;
  await page.route('**/api/**', route => {
    if (route.request().method() === 'POST' && new URL(route.request().url()).pathname === '/api/journeys') {
      return route.fulfill({ status: 201, json: { ...access, phase: 'express' } });
    }
    if (new URL(route.request().url()).pathname.endsWith('/messages')) {
      submissions++;
      expect(route.request().postDataJSON()).toMatchObject({ message: 'A fictional assignment is due Friday.', language: 'en-US', language_source: 'user_selected' });
      return route.fulfill({ json: { phase: 'clarify', analysis, concerns: [concern] }, headers: { 'Server-Timing': 'meta;dur=10.000, validation;dur=1.000' } });
    }
    return route.fulfill({ status: 500, json: { error: 'Unexpected API request' } });
  });
  await page.goto('/');
  await expect(page.locator('[data-voice-state]')).toHaveAttribute('data-voice-state', 'idle');
  await page.getByRole('button', { name: 'Enable microphone', exact: true }).click();
  const panel = page.locator('[data-voice-state]');
  await expect(panel).toHaveAttribute('data-voice-state', 'listening');
  await expect(panel.getByRole('status')).toContainText('Mic on');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('test:transcript', { detail: 'A fictional assignment is due Friday.' })));
  await expect(panel.getByRole('heading', { level: 1 })).toContainText(analysis.reflection);
  await expect(panel).toHaveAttribute('data-voice-state', 'listening');
  expect(submissions).toBe(1);
  await panel.getByRole('button', { name: 'Pause voice' }).click();
  await expect(panel).toHaveAttribute('data-voice-state', 'paused');
  await expect(panel.getByRole('status').first()).toContainText('Mic off');
  await panel.getByRole('button', { name: 'Resume voice' }).click();
  await expect(panel).toHaveAttribute('data-voice-state', 'listening');
  await panel.getByRole('button', { name: 'Mute microphone', exact: true }).click();
  await expect(panel).toHaveAttribute('data-voice-state', 'paused');
  await panel.getByRole('button', { name: 'Switch to typing' }).click();
  await expect(page.getByRole('textbox', { name: 'Your message to Mirembe' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('permission denial preserves the text journey', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: class {} });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable microphone', exact: true }).click();
  await expect(page.locator('[data-voice-state]')).toHaveAttribute('data-voice-state', 'error');
  await expect(page.getByRole('button', { name: 'Type instead' })).toBeVisible();
});
