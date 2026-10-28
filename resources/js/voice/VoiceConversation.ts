import type { Analysis } from '../types';
import type { SpeechInput, SpeechOutput, VoiceSnapshot } from './contracts';
import { languages, type VoiceLanguage } from './languages';

interface VoiceDependencies {
  input: SpeechInput;
  output: SpeechOutput;
  permission(): Promise<void>;
  ensureJourney(): Promise<boolean>;
  send(text: string): Promise<Analysis | null>;
  available(): boolean;
}
const initial = (): VoiceSnapshot => ({ phase: 'idle', active: false, microphoneActive: false, transcript: '', interim: '', spokenText: '', notice: '', muted: false, outputEnabled: true, rate: 1, silenceMs: 1600, requestPending: false, language: 'en-US', timings: {} });

export class VoiceConversation {
  private state = initial();
  private subscribers = new Set<() => void>();
  private epoch = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private retries = 0;
  private lastSubmitted = '';
  private lastSubmittedAt = 0;
  private speechEndedAt: number | undefined;
  private transcriptAt = 0;
  constructor(private dependencies: VoiceDependencies) {}
  getSnapshot = (): VoiceSnapshot => this.state;
  subscribe = (listener: () => void): (() => void) => { this.subscribers.add(listener); return () => { this.subscribers.delete(listener); }; };
  get inputSupported(): boolean { return this.dependencies.input.supported; }
  get outputSupported(): boolean { return this.dependencies.output.supported; }
  private update(values: Partial<VoiceSnapshot>): void { this.state = { ...this.state, ...values }; this.subscribers.forEach(listener => listener()); }
  private clearTimers(): void { clearTimeout(this.timer); clearTimeout(this.idleTimer); }
  private valid(epoch: number): boolean { return epoch === this.epoch && this.state.active && this.dependencies.available(); }
  private silence(): void {
    clearTimeout(this.timer);
    const epoch = this.epoch;
    this.timer = setTimeout(() => this.finishUtterance(epoch), this.state.silenceMs);
  }
  private stopResources(): void {
    this.epoch++; this.clearTimers(); this.dependencies.input.abort(); this.dependencies.output.stop();
    this.update({ microphoneActive: false });
  }
  async start(): Promise<void> {
    if (this.state.requestPending || ['requesting_permission', 'listening', 'speaking', 'thinking', 'processing'].includes(this.state.phase)) return;
    if (!this.inputSupported || !this.dependencies.available()) {
      this.update({ phase: 'error', active: false, notice: 'Hands-free recognition is not available here. Use typing or optional dictation if supported. No backend transcription service is configured.' }); return;
    }
    this.stopResources(); this.lastSubmitted = ''; this.retries = 0;
    this.update({ active: true, phase: 'requesting_permission', notice: 'Allow microphone access to begin. Voice mode sends each final transcript after you pause.', transcript: '', interim: '' });
    const epoch = this.epoch;
    const welcome = languages[this.state.language].greeting;
    let greeting: Promise<import('./contracts').SpeechOutcome> = Promise.resolve('completed');
    try {
      this.dependencies.output.activate();
      this.update({ spokenText: welcome });
      if (this.state.outputEnabled && this.outputSupported) greeting = this.dependencies.output.speak(welcome, this.state.rate, () => {
        if (this.valid(epoch)) this.update({ phase: 'speaking', notice: 'Mirembe is welcoming you. Allow microphone access when asked; listening begins after the welcome.' });
      });
      await this.dependencies.permission();
      if (!this.valid(epoch)) return;
      if (!await this.dependencies.ensureJourney()) throw new Error('journey');
      if (!this.valid(epoch)) return;
      const outcome = await greeting;
      if (!this.valid(epoch)) return;
      if (outcome === 'blocked') { this.pause('Speech playback was blocked. Tap Resume voice to try again, or turn spoken replies off.'); return; }
      this.listen();
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.stopResources();
      this.update({ phase: 'error', active: false, notice: error instanceof Error && error.message === 'journey' ? 'Your journey could not be opened. Try again or switch to typing.' : 'Microphone access could not be started. Check browser permission, or switch to typing.' });
    }
  }
  async resume(): Promise<void> {
    if (this.state.requestPending || this.state.muted) return;
    if (!this.state.active) { await this.start(); return; }
    if (!this.dependencies.available()) { this.pause('Reconnect and return to Mirembe before resuming voice.'); return; }
    this.dependencies.output.activate(); this.stopResources();
    const epoch = this.epoch;
    this.update({ phase: 'requesting_permission', notice: 'Preparing your microphone…' });
    try {
      await this.dependencies.permission();
      if (this.valid(epoch)) { this.lastSubmitted = ''; this.retries = 0; this.listen(); }
    } catch { if (epoch === this.epoch) this.permissionRevoked(); }
  }
  private listen(): void {
    if (!this.state.active || this.state.muted || !this.dependencies.available()) return;
    this.clearTimers(); this.dependencies.input.abort();
    const epoch = ++this.epoch;
    this.speechEndedAt = undefined;
    this.update({ phase: 'processing', microphoneActive: false, transcript: '', interim: '', notice: 'Getting ready to listen…' });
    try {
      this.dependencies.input.start({
        started: () => {
          if (!this.valid(epoch)) return;
          this.update({ phase: 'listening', microphoneActive: true, notice: 'Listening. Pause when you’re ready to send.' });
          this.idleTimer = setTimeout(() => { if (this.valid(epoch)) this.pause('Take your time. Tap Resume voice when you’re ready to speak.'); }, 30000);
        },
        transcript: (finalText, interim) => {
          if (!this.valid(epoch) || !['listening', 'processing'].includes(this.state.phase)) return;
          if ((finalText + interim).length > 3000) { this.update({ transcript: finalText, interim }); this.pause('That is a long thought. Switch to typing to review and shorten it before sending.'); return; }
          const changed = finalText !== this.state.transcript || interim !== this.state.interim;
          this.update({ transcript: finalText, interim, ...(changed && !this.state.transcript && !this.state.interim ? { timings: {} } : {}) });
          if (changed) this.transcriptAt = performance.now();
          if (finalText && !interim && this.speechEndedAt !== undefined) this.update({ timings: { ...this.state.timings, finalizationMs: performance.now() - this.speechEndedAt } });
          if (changed && (finalText || interim)) { clearTimeout(this.idleTimer); this.silence(); }
        },
        speechEnded: () => { if (this.valid(epoch)) { this.speechEndedAt = performance.now(); if (this.state.transcript || this.state.interim) this.silence(); } },
        ended: () => {
          if (!this.valid(epoch)) return;
          this.update({ microphoneActive: false });
          if (this.state.interim.trim()) this.pause('That transcription was not finalised. Tap Resume voice or switch to typing to review it.');
          else if (this.state.transcript.trim()) void this.submit(epoch);
          else if (++this.retries <= 2) { this.timer = setTimeout(() => { if (this.valid(epoch)) this.listen(); }, 500); }
          else this.pause('The browser stopped listening. Tap Resume voice to continue.');
        },
        failed: code => {
          if (!this.valid(epoch)) return;
          if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(code)) this.permissionRevoked();
          else if (code === 'language-not-supported') this.pause('This browser cannot recognise the chosen language. Choose another language in Settings or switch to typing.');
          else if (code !== 'no-speech' && code !== 'aborted') this.pause('Speech recognition was interrupted. Check your connection and tap Resume voice, or type instead.');
        },
      });
    } catch { this.pause('The browser blocked automatic listening. Tap Resume voice to continue.'); }
  }
  private finishUtterance(epoch: number): void {
    if (!this.valid(epoch)) return;
    if (this.state.transcript.trim() && !this.state.interim.trim()) { void this.submit(epoch); return; }
    this.update({ phase: 'processing', notice: 'Finishing your transcription…' });
    this.dependencies.input.stop();
    this.timer = setTimeout(() => {
      if (!this.valid(epoch)) return;
      if (this.state.transcript.trim() && !this.state.interim.trim()) void this.submit(epoch);
      else this.pause('The browser could not finalise that thought. Switch to typing or tap Resume voice.');
    }, 1500);
  }
  private async submit(epoch: number): Promise<void> {
    if (!this.valid(epoch) || this.state.requestPending) return;
    const text = this.state.transcript.trim().replace(/\s+/g, ' ');
    if (!text) return;
    if (text.toLocaleLowerCase() === this.lastSubmitted && Date.now() - this.lastSubmittedAt < 5000) {
      this.pause('That sounds like the previous message, so it was not sent again. Tap Resume voice if you want to repeat it.'); return;
    }
    this.lastSubmitted = text.toLocaleLowerCase(); this.lastSubmittedAt = Date.now();
    this.clearTimers(); this.dependencies.input.abort(); const turn = ++this.epoch;
    this.update({ phase: 'thinking', microphoneActive: false, interim: '', requestPending: true, timings: { ...this.state.timings, endpointingMs: performance.now() - this.transcriptAt, requestMs: undefined, ttsStartupMs: undefined }, notice: 'Mirembe is reflecting…' });
    const requestStarted = performance.now();
    let result: Analysis | null = null;
    try { result = await this.dependencies.send(text); } catch { /* The visible error never includes provider details. */ }
    this.update({ requestPending: false, timings: { ...this.state.timings, requestMs: performance.now() - requestStarted } });
    if (!this.valid(turn)) return;
    if (!result) { this.stopResources(); this.update({ phase: 'error', active: true, notice: 'The response could not be confirmed. Your words are shown here. Check the conversation before retrying; nothing will be resent automatically.' }); return; }
    const reply = `${result.demo_mode ? 'This is a fixed demo example. ' : ''}${[result.reflection, result.clarification_question].filter(Boolean).join(' ')}`;
    this.update({ spokenText: reply }); this.retries = 0;
    if (this.state.outputEnabled && this.outputSupported) {
      this.update({ phase: 'processing', notice: 'Preparing Mirembe’s reply…' });
      const speechStarted = performance.now();
      const outcome = await this.dependencies.output.speak(reply, this.state.rate, () => {
        if (this.valid(turn)) this.update({ phase: 'speaking', microphoneActive: false, timings: { ...this.state.timings, ttsStartupMs: performance.now() - speechStarted }, notice: 'Mirembe is speaking. The microphone is off.' });
      });
      if (!this.valid(turn)) return;
      if (outcome !== 'completed' && outcome !== 'unavailable') { this.pause('Speech playback was interrupted. Read the reply, then tap Resume voice.'); return; }
    }
    if (this.valid(turn)) this.listen();
  }
  pause(notice = 'Voice is paused. Tap Resume voice when you’re ready.'): void {
    if (!this.state.active) return;
    this.stopResources(); this.update({ phase: 'paused', notice });
  }
  permissionRevoked(): void { this.stopResources(); this.update({ phase: 'error', active: false, notice: 'Microphone permission is unavailable or was revoked. Check browser settings, or continue typing.' }); }
  end(): void { this.stopResources(); this.update({ active: false, phase: 'idle', transcript: '', interim: '', spokenText: '', notice: '', muted: false }); }
  setMuted(muted: boolean): void { this.update({ muted }); if (muted) this.pause('Microphone muted. Unmute and tap Resume voice to continue.'); }
  setOutputEnabled(enabled: boolean): void { this.update({ outputEnabled: enabled }); if (!enabled && this.state.phase === 'speaking') this.pause('Spoken replies are off. Tap Resume voice to continue with text replies.'); }
  setRate(rate: number): void { this.update({ rate: Math.max(.7, Math.min(1.4, rate)) }); }
  setSilenceMs(silenceMs: number): void { this.update({ silenceMs: Math.max(800, Math.min(4000, silenceMs)) }); }
  setLanguage(language: VoiceLanguage): void {
    if (language === this.state.language) return;
    this.pause('Language changed. Tap Resume voice when you’re ready.');
    this.dependencies.input.setLanguage?.(language); this.dependencies.output.setLanguage?.(language);
    this.update({ language, spokenText: '', transcript: '', interim: '' });
  }
  dispose(): void { this.end(); this.dependencies.output.dispose(); this.subscribers.clear(); }
}
