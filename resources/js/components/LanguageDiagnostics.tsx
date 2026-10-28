import type { useVoiceConversation } from '../voice/useVoiceConversation';
import { languages } from '../voice/languages';

export function LanguageDiagnostics({ voice }: { voice: ReturnType<typeof useVoiceConversation> }) {
  if (!import.meta.env.DEV) return null;
  const { state, controller } = voice;
  return <details className="mt-5 rounded-xl border border-line p-3 text-xs"><summary>Language diagnostics · development only</summary><dl className="mt-3 grid gap-2 break-words">
    <div><dt>Requested recognition language</dt><dd>{state.language === 'auto' ? 'None: select a specific language for browser speech' : state.language}</dd></div>
    <div><dt>Transcribed text (device memory only)</dt><dd>{state.transcript || state.lastTranscript || 'No transcript'}</dd></div>
    <div><dt>Detected spoken language</dt><dd>{controller.recognitionCapabilities.automaticLanguageDetection ? 'Provider-dependent' : 'Not supported by this browser adapter'}</dd></div>
    <div><dt>AI response language</dt><dd>{state.responseLanguage ?? 'Not returned yet'}{state.language === 'auto' && state.responseLanguage ? ' (model-identified from text)' : ''}</dd></div>
    <div><dt>Speech-synthesis voice language</dt><dd>{state.synthesisLanguage ?? 'No matching voice selected / not started'}</dd></div>
    <div><dt>Missing capabilities</dt><dd>{!controller.inputSupported ? 'Native speech recognition unavailable. ' : ''}Automatic acoustic language identification is not configured. Recognition for {languages[state.language].name} is service-dependent; Kinyarwanda is unverified. {state.playbackStatus === 'unavailable' ? state.playbackNotice : 'Voice inventory is device-dependent.'}</dd></div>
  </dl></details>;
}
