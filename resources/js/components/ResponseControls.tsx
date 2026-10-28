import { useId } from 'react';
import { languages, type VoiceLanguage, type ResponseMode } from '../voice/languages';

export function ResponseControls({ mode, language, setMode, setLanguage, languageDisabled = false }: {
  mode: ResponseMode; language: VoiceLanguage; setMode(mode: ResponseMode): void; setLanguage(language: VoiceLanguage): void; languageDisabled?: boolean;
}) {
  const id = useId();
  return <div className="response-controls mx-auto flex w-full max-w-sm items-center justify-center gap-2">
    <fieldset className="flex min-w-0 flex-1 rounded-full border border-line bg-white/60 p-0.5"><legend className="sr-only">Response mode</legend>{(['text', 'voice', 'both'] as const).map(value => <label key={value} className={`response-choice ${mode === value ? 'bg-plum text-cream' : 'text-muted'}`}><input className="response-radio" type="radio" name={`response-${id}`} value={value} checked={mode === value} onChange={() => setMode(value)} /><span>{value === 'text' ? 'Text' : value === 'voice' ? 'Voice' : 'Both'}</span></label>)}</fieldset>
    <label className="min-w-0"><span className="sr-only">Conversation language</span><select className="language-choice" value={language} onChange={event => setLanguage(event.target.value as VoiceLanguage)} disabled={languageDisabled}>{Object.entries(languages).map(([value, item]) => <option key={value} value={value}>{item.name}</option>)}</select></label>
  </div>;
}
