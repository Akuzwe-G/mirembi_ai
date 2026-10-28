export type VoicePhase = 'idle' | 'requesting_permission' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'paused' | 'error';
export type SpeechOutcome = 'completed' | 'interrupted' | 'blocked';
export interface SpeechOutput {
  readonly supported: boolean;
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
  rate: number;
  silenceMs: number;
  requestPending: boolean;
}
