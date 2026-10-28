export type VoicePhase = 'idle' | 'requesting_permission' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'paused' | 'error';
export type SpeechOutcome = 'completed' | 'interrupted' | 'blocked' | 'unavailable';
export interface SpeechOutput {
  readonly supported: boolean;
  readonly voiceLanguage?: string;
  setLanguage?(language: string): void;
  activate(): void;
  speak(text: string, rate: number, onStart: () => void): Promise<SpeechOutcome>;
  stop(): void;
  dispose(): void;
}
export interface RecognitionEvents {
  started(): void;
  transcript(finalText: string, interimText: string): void;
  speechEnded(): void;
  ended(): void;
  failed(code: string): void;
}
export interface SpeechInput {
  readonly supported: boolean;
  readonly capabilities?: { provider: string; automaticLanguageDetection: boolean; supportedLanguages: readonly string[] | null };
  setLanguage?(language: string): void;
  start(events: RecognitionEvents): void;
  stop(): void;
  abort(): void;
}
export interface VoiceSnapshot {
  phase: VoicePhase;
  active: boolean;
  microphoneActive: boolean;
  transcript: string;
  interim: string;
  spokenText: string;
  notice: string;
  muted: boolean;
  outputEnabled: boolean;
  responseMode: import('./languages').ResponseMode;
  playbackStatus: 'idle' | 'playing' | 'blocked' | 'unavailable';
  playbackNotice: string;
  responseLanguage?: import('./languages').ResponseLanguage;
  synthesisLanguage?: string;
  lastTranscript: string;
  rate: number;
  silenceMs: number;
  requestPending: boolean;
  language: import('./languages').VoiceLanguage;
  timings: { endpointingMs?: number; finalizationMs?: number; requestMs?: number; ttsStartupMs?: number };
}
