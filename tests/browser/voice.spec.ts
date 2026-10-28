import { expect, test } from '@playwright/test';
import { access } from '../frontend/fixtures';

test('explicit activation, microphone cleanup and typing fallback', async ({ page }) => {
  await page.addInitScript(() => {
    class Recognition {
      onstart: (() => void) | null = null;
      start() { this.onstart?.(); }
      stop() {}
      abort() {}
    }
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
  await page.route('**/api/**', route => {
    if (route.request().method() === 'POST' && new URL(route.request().url()).pathname === '/api/journeys') {
      return route.fulfill({ status: 201, json: { ...access, phase: 'express' } });
    }
    return route.fulfill({ status: 500, json: { error: 'Unexpected API request' } });
  });
  await page.goto('/');
  await expect(page.locator('[data-voice-state]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start talking', exact: true }).click();
  const panel = page.locator('[data-voice-state]');
  await expect(panel).toHaveAttribute('data-voice-state', 'listening');
  await expect(panel.getByText('Mic on', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Pause voice' }).click();
  await expect(panel).toHaveAttribute('data-voice-state', 'paused');
  await expect(panel.getByText('Mic off', { exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Start talking', exact: true }).click();
  await expect(page.locator('[data-voice-state]')).toHaveAttribute('data-voice-state', 'error');
  await expect(page.getByRole('button', { name: 'Switch to typing' })).toBeVisible();
});
