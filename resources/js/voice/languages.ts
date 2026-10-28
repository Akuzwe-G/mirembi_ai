export const languages = {
  'auto': { name: 'Auto-detect', code: 'auto', greeting: "Hi, I’m Mirembe. I’m here. What’s on your mind?" },
  'en-US': { name: 'English', code: 'en', greeting: "Hi, I’m Mirembe. I’m here. What’s on your mind?" },
  'fr-FR': { name: 'Français', code: 'fr', greeting: 'Bonjour, je suis Mirembe. Je suis là. Qu’avez-vous en tête ?' },
  'rw-RW': { name: 'Kinyarwanda', code: 'rw', greeting: 'Muraho, ndi Mirembe. Ni iki kiri ku mutima wawe?' },
  'hi-IN': { name: 'हिन्दी', code: 'hi', greeting: 'नमस्ते, मैं मिरेम्बे हूँ। आपके मन में क्या है?' },
} as const;
export type VoiceLanguage = keyof typeof languages;
export type ResponseLanguage = 'en' | 'fr' | 'rw' | 'hi';
export type ResponseMode = 'text' | 'voice' | 'both';
export const languageLocale = (language: ResponseLanguage): VoiceLanguage => Object.entries(languages).find(([, value]) => value.code === language)?.[0] as VoiceLanguage ?? 'en-US';
export const isResponseMode = (value: unknown): value is ResponseMode => typeof value === 'string' && ['text', 'voice', 'both'].includes(value);
export const isVoiceLanguage = (value: unknown): value is VoiceLanguage => typeof value === 'string' && Object.hasOwn(languages, value);

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
export interface VoicePreferences { language: VoiceLanguage; voicePreferred: boolean; responseMode: ResponseMode }
const preferenceKey = 'mirembe.voice-preferences.v1';
export function readVoicePreferences(): VoicePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}');
    return { language: isVoiceLanguage(saved.language) ? saved.language : 'en-US', voicePreferred: saved.voicePreferred !== false, responseMode: isResponseMode(saved.responseMode) ? saved.responseMode : 'both' };
  } catch { return { language: 'en-US', voicePreferred: true, responseMode: 'both' }; }
}
export function saveVoicePreferences(value: VoicePreferences): void {
  try { localStorage.setItem(preferenceKey, JSON.stringify(value)); } catch { /* Optional, non-sensitive preferences only. */ }
}
