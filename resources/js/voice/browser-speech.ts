import type { RecognitionEvents, SpeechInput, SpeechOutcome, SpeechOutput } from './contracts';

interface NativeRecognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null; onend: (() => void) | null; onspeechend: (() => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionWindow = Window & { SpeechRecognition?: new () => NativeRecognition; webkitSpeechRecognition?: new () => NativeRecognition };

export class BrowserSpeechInput implements SpeechInput {
  private language = 'en-US';
  setLanguage(language: string): void { this.language = language; }
  private recognition: NativeRecognition | null = null;
  private Constructor = (window as RecognitionWindow).SpeechRecognition ?? (window as RecognitionWindow).webkitSpeechRecognition;
  get supported(): boolean { return !!this.Constructor && !!navigator.mediaDevices?.getUserMedia && !!window.isSecureContext; }
  start(events: RecognitionEvents): void {
    this.abort();
    if (!this.Constructor) throw new Error('unsupported');
    const recognition = new this.Constructor();
    this.recognition = recognition;
    recognition.lang = this.language; recognition.continuous = true; recognition.interimResults = true;
    recognition.onstart = events.started; recognition.onend = events.ended; recognition.onspeechend = events.speechEnded;
    recognition.onerror = event => events.failed(event.error);
    recognition.onresult = event => {
      let finalText = ''; let interim = '';
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) finalText += `${result[0].transcript} `;
        else interim += `${result[0].transcript} `;
      }
      events.transcript(finalText.trim(), interim.trim());
    };
    recognition.start();
  }
  stop(): void { try { this.recognition?.stop(); } catch { /* It may already have ended. */ } }
  abort(): void {
    const recognition = this.recognition; this.recognition = null;
    if (!recognition) return;
    recognition.onstart = null; recognition.onend = null; recognition.onresult = null;
    recognition.onerror = null; recognition.onspeechend = null;
    try { recognition.abort(); } catch { /* Cleanup remains idempotent. */ }
  }
}

export async function requestMicrophone(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // Native speech recognition owns its own capture. Permission-check tracks never remain open.
  stream.getTracks().forEach(track => track.stop());
}

export function chooseVoice(voices: SpeechSynthesisVoice[], language: string): SpeechSynthesisVoice | undefined {
  const base = language.split('-')[0].toLowerCase();
  return voices.filter(voice => voice.lang.split(/[-_]/)[0].toLowerCase() === base)
    .sort((a, b) => Number(b.lang === language) - Number(a.lang === language) || Number(b.localService) - Number(a.localService) || Number(b.default) - Number(a.default))[0];
}
export const chooseEnglishVoice = (voices: SpeechSynthesisVoice[]) => chooseVoice(voices, 'en-US');

export class BrowserSpeechOutput implements SpeechOutput {
  private language = 'en-US';
  setLanguage(language: string): void { this.language = language; }
  private finish: ((outcome: SpeechOutcome) => void) | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private refresh = () => { this.voices = window.speechSynthesis?.getVoices() ?? []; };
  get supported(): boolean { return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; }
  constructor() {
    this.refresh(); window.speechSynthesis?.addEventListener('voiceschanged', this.refresh);
  }
  activate(): void {
    if (!this.supported) return;
    this.refresh(); window.speechSynthesis.resume();
    const primer = new SpeechSynthesisUtterance(' '); primer.volume = 0;
    window.speechSynthesis.speak(primer);
  }
  speak(text: string, rate: number, onStart: () => void): Promise<SpeechOutcome> {
    this.stop();
    if (!this.supported) return Promise.resolve('blocked');
    this.refresh();
    return new Promise(resolve => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = chooseVoice(this.voices, this.language);
      if (!voice && this.language !== 'en-US') { resolve('unavailable'); return; }
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? this.language; utterance.rate = Math.max(.7, Math.min(1.4, rate));
      let started = false;
      const startTimeout = setTimeout(() => { if (!started) { finish('blocked'); window.speechSynthesis.cancel(); } }, 5000);
      const watchdog = setTimeout(() => { finish('blocked'); window.speechSynthesis.cancel(); }, 120000);
      const finish = (outcome: SpeechOutcome) => {
        if (this.finish !== finish) return;
        this.finish = null; clearTimeout(startTimeout); clearTimeout(watchdog);
        utterance.onstart = null; utterance.onend = null; utterance.onerror = null;
        resolve(outcome);
      };
      this.finish = finish;
      utterance.onstart = () => { started = true; clearTimeout(startTimeout); onStart(); };
      utterance.onend = () => finish('completed');
      utterance.onerror = event => finish(['canceled', 'interrupted'].includes(event.error) ? 'interrupted' : 'blocked');
      try { window.speechSynthesis.resume(); window.speechSynthesis.speak(utterance); }
      catch { finish('blocked'); }
    });
  }
  stop(): void { this.finish?.('interrupted'); window.speechSynthesis?.cancel(); }
  dispose(): void { this.stop(); window.speechSynthesis?.removeEventListener('voiceschanged', this.refresh); }
}
