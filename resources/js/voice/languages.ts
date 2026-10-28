export const languages = {
  'en-US': { name: 'English', greeting: "Hi, I’m Mirembe. I’m here. What’s on your mind?" },
  'fr-FR': { name: 'Français', greeting: 'Bonjour, je suis Mirembe. Je suis là. Qu’avez-vous en tête ?' },
  'rw-RW': { name: 'Kinyarwanda', greeting: 'Muraho, ndi Mirembe. Ni iki kiri ku mutima wawe?' },
} as const;
export type VoiceLanguage = keyof typeof languages;
export const isVoiceLanguage = (value: unknown): value is VoiceLanguage => typeof value === 'string' && value in languages;

export interface TranscriptionResult {
  text: string;
  detectedLanguage?: string;
  confidence?: number;
}
// A configured multilingual provider must advertise and verify its own capabilities.
// Native browser recognition uses a chosen locale and does not implement language detection.
export interface MultilingualTranscriptionProvider {
  readonly supportedLanguages: readonly string[];
  readonly detectsLanguage: boolean;
  transcribe(audio: Blob, preferredLanguage: VoiceLanguage, signal: AbortSignal): Promise<TranscriptionResult>;
}
export interface VoicePreferences { language: VoiceLanguage; voicePreferred: boolean }
const preferenceKey = 'mirembe.voice-preferences.v1';
export function readVoicePreferences(): VoicePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}');
    return { language: isVoiceLanguage(saved.language) ? saved.language : 'en-US', voicePreferred: saved.voicePreferred !== false };
  } catch { return { language: 'en-US', voicePreferred: true }; }
}
export function saveVoicePreferences(value: VoicePreferences): void {
  try { localStorage.setItem(preferenceKey, JSON.stringify(value)); } catch { /* Optional, non-sensitive preferences only. */ }
}
