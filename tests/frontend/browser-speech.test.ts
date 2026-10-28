import { describe, expect, it, vi } from 'vitest';
import { BrowserSpeechInput, BrowserSpeechOutput, chooseEnglishVoice, chooseVoice, requestMicrophone } from '../../resources/js/voice/browser-speech';

describe('browser speech adapters', () => {
  it('uses the selected locale rather than assuming recognition detects languages', () => {
    let recognizer!: { lang?: string };
    vi.stubGlobal('SpeechRecognition', class { constructor() { recognizer = this; } lang = ''; start() {} abort() {} });
    const input = new BrowserSpeechInput();
    const events = { started: vi.fn(), transcript: vi.fn(), speechEnded: vi.fn(), ended: vi.fn(), failed: vi.fn() };
    for (const locale of ['en-US', 'fr-FR', 'rw-RW']) { input.setLanguage(locale); input.start(events); expect(recognizer.lang).toBe(locale); }
    input.abort();
  });
  it('selects French and Kinyarwanda only when matching voices actually exist', () => {
    const voices = [{ lang: 'en-US', localService: true }, { lang: 'fr-FR', localService: false }] as SpeechSynthesisVoice[];
    expect(chooseVoice(voices, 'fr-FR')?.lang).toBe('fr-FR');
    expect(chooseVoice(voices, 'rw-RW')).toBeUndefined();
  });
  it('does not read Kinyarwanda using an English voice when matching synthesis is unavailable', async () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { getVoices: () => [{ lang: 'en-US' }], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), speak });
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    const output = new BrowserSpeechOutput(); output.setLanguage('rw-RW');
    await expect(output.speak('Dushobora kubiganiraho.', 1, vi.fn())).resolves.toBe('unavailable');
    expect(speak).not.toHaveBeenCalled(); output.dispose();
  });
  it('chooses an available English voice without assuming a vendor-specific name', () => {
    const voices = [
      { name: 'German', lang: 'de-DE', localService: true, default: true },
      { name: 'Available English', lang: 'en-AU', localService: false, default: true },
      { name: 'Local English', lang: 'en-GB', localService: true, default: false },
    ] as SpeechSynthesisVoice[];
    expect(chooseEnglishVoice(voices)?.name).toBe('Local English');
    expect(chooseEnglishVoice(voices.slice(0, 1))).toBeUndefined();
  });
  it('stops all temporary permission-check tracks immediately', async () => {
    const stop = vi.fn(); const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }, { stop }] });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    await requestMicrophone();
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: true }); expect(stop).toHaveBeenCalledTimes(2);
  });
  it('requires native recognition support and does not fabricate an audio upload fallback', () => {
    expect(new BrowserSpeechInput().supported).toBe(false);
  });
  it('cancels active speech and settles its promise when stopped', async () => {
    let utterance!: SpeechSynthesisUtterance;
    const synth = { getVoices: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), resume: vi.fn(), speak: vi.fn((value: SpeechSynthesisUtterance) => { utterance = value; value.onstart?.({} as SpeechSynthesisEvent); }) };
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text; } });
    const output = new BrowserSpeechOutput(); const started = vi.fn();
    const result = output.speak('A fictional reply.', 1.1, started);
    expect(utterance.text).toBe('A fictional reply.'); expect(started).toHaveBeenCalledOnce();
    output.stop(); await expect(result).resolves.toBe('interrupted');
    expect(synth.cancel).toHaveBeenCalled(); output.dispose();
    expect(synth.removeEventListener).toHaveBeenCalled();
  });
});
