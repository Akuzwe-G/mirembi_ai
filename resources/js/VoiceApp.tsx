import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, LockKeyhole, Map, Menu, MessageCircle, RotateCcw, Settings, Shield, Sprout, Trash2, UserRound } from 'lucide-react';
import { useJourney } from './useJourney';
import { ClarityMap } from './components/ClarityMap';
import { Conversation } from './components/Conversation';
import { PwaControls } from './components/PwaControls';
import { DeviceCopy } from './components/DeviceCopy';
import { OfflineScreen } from './components/OfflineScreen';
import { Panel } from './components/Panel';
import { AvatarHome } from './components/AvatarHome';
import { ResponseControls } from './components/ResponseControls';
import { PlaybackControls } from './components/PlaybackControls';
import { LanguageDiagnostics } from './components/LanguageDiagnostics';
import { useOnline } from './pwa';
import { useVoiceConversation } from './voice/useVoiceConversation';
import { languages, isVoiceLanguage, readVoicePreferences, saveVoicePreferences } from './voice/languages';

type View = 'menu' | 'journey' | 'settings' | 'privacy' | 'signin' | 'register' | 'delete';
const titles: Record<View, string> = { menu: 'Your space', journey: 'My Journey', settings: 'Settings', privacy: 'Privacy', signin: 'Sign in', register: 'Register', delete: 'Delete my data' };

export default function VoiceApp() {
  const journey = useJourney();
  const online = useOnline();
  const previousOnline = useRef(online);
  const [panel, setPanel] = useState<View | null>(null);
  const [tab, setTab] = useState<'conversation' | 'map'>('conversation');
  const [draft, setDraft] = useState('');
  const [preferences, setPreferences] = useState(readVoicePreferences);
  const voice = useVoiceConversation({ language: preferences.language, responseMode: preferences.responseMode, ensureJourney: async () => journey.access ? true : await journey.start(), send: (text, method = 'voice') => journey.sendVoice(text, preferences.language, method) });
  const previousAccess = useRef(journey.access);
  useEffect(() => { if (online && !previousOnline.current) void journey.restore(); previousOnline.current = online; }, [online, journey.restore]);
  useEffect(() => { saveVoicePreferences(preferences); }, [preferences]);
  useEffect(() => { if (previousAccess.current && !journey.access) voice.controller.end(); previousAccess.current = journey.access; }, [journey.access, voice.controller]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => document.documentElement.style.setProperty('--app-height', `${viewport?.height ?? window.innerHeight}px`);
    resize(); viewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    return () => { viewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); document.documentElement.style.removeProperty('--app-height'); };
  }, []);
  const disabled = !!journey.busy || journey.unavailable || journey.needsRefresh || !online;
  const responseControls = <ResponseControls mode={preferences.responseMode} language={preferences.language} languageDisabled={voice.state.requestPending} setMode={responseMode => { voice.controller.setResponseMode(responseMode); if (responseMode !== 'text') voice.controller.activateAudio(); setPreferences(current => ({ ...current, responseMode })); }} setLanguage={language => { voice.controller.setLanguage(language); setPreferences(current => ({ ...current, language })); }} />;
  const open = (view: View) => { voice.controller.pause('Voice paused while this panel is open. Close it, then tap Resume voice.'); setPanel(view); };
  const typing = () => {
    if (['paused', 'error'].includes(voice.state.phase)) setDraft(`${voice.state.transcript} ${voice.state.interim}`.trim() || draft);
    voice.controller.end(); setPreferences(current => ({ ...current, voicePreferred: false }));
    setTab('conversation'); setPanel('journey'); if (!journey.access && !journey.busy) void journey.start();
    requestAnimationFrame(() => document.getElementById('message-input')?.focus());
  };
  const error = journey.error && <div className="rounded-2xl bg-peach/40 p-3 text-xs leading-5" role="alert"><div className="flex gap-2"><AlertCircle size={16} className="shrink-0" /><p>{journey.error}</p></div><div className="mt-2 flex gap-4">{journey.access && !journey.unavailable && <button className="text-button flex items-center gap-1" disabled={!!journey.busy} onClick={() => void journey.restore()}><RotateCcw size={12} />Refresh journey</button>}{!journey.access && <button className="text-button" disabled={!!journey.busy} onClick={() => void journey.start()}>Try again</button>}{journey.unavailable && <button className="text-button" onClick={() => open('delete')}>Manage guest access</button>}</div></div>;
  if (!online) return <div className="min-h-dvh bg-cream text-plum"><a href="#main-content" className="skip-link">Skip to main content</a><header className="border-b border-line px-5 py-5"><a href="/" className="font-display text-2xl">mirembe.</a></header><PwaControls busy={!!journey.busy || !!draft.trim()} /><OfflineScreen /></div>;
  return <div className={`mirembe-app bg-cream text-plum ${preferences.voicePreferred ? '' : 'prefers-text'}`}>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <header className="home-header flex shrink-0 items-center justify-between gap-3 px-5 sm:px-9">
      <a href="#main-content" className="flex items-center gap-2" aria-label="Mirembe"><span className="brand-mark" aria-hidden="true"><Sprout size={21} strokeWidth={1.5} /></span><span className="font-display text-[26px] tracking-[-0.05em]">mirembe<span className="text-lavender-dark">.</span></span></a>
      <div className="flex items-center gap-2"><button className="home-journey-link text-button flex min-h-11 items-center gap-2 px-2" onClick={() => { setTab('map'); open('journey'); }}><Map size={16} /><span>My Journey</span>{journey.concerns.length > 0 && <span className="rounded-full bg-lavender/15 px-1.5 text-[10px]">{journey.concerns.length}</span>}</button><button id="navigation-button" className="icon-button" onClick={() => open('menu')} aria-label="Open menu"><Menu size={21} /></button></div>
    </header>
    <PwaControls updatesOnly busy={!!journey.busy || !!draft.trim() || voice.state.active || voice.state.phase === 'speaking' || voice.state.phase === 'processing'} />
    {!panel && error && <div className="home-error mx-auto w-full max-w-xl px-4">{error}</div>}
    <AvatarHome voice={voice} analysis={journey.analysis} controls={responseControls} busy={journey.busy} disabled={disabled} activate={() => { setPreferences(current => ({ ...current, voicePreferred: true })); void (voice.state.active ? voice.controller.resume() : voice.controller.start()); }} typing={typing} settings={() => open('settings')} />
    {panel && <Panel key={panel} title={titles[panel]} close={() => { if (panel === 'delete' && journey.busy) return; setPanel(null); }}>
      {panel === 'menu' && <nav aria-label="Main navigation" className="grid gap-1">{([
        ['signin', 'Sign in', UserRound], ['register', 'Register', UserRound], ['journey', 'My Journey', Map], ['settings', 'Settings', Settings], ['privacy', 'Privacy', Shield], ['delete', 'Delete my data', Trash2],
      ] as const).map(([view, label, Icon]) => <button key={view} className="menu-item" onClick={() => { if (view === 'journey') setTab('map'); open(view); }}><Icon size={18} /><span>{label}</span><ArrowRight size={15} className="ml-auto text-muted" /></button>)}<p className="mt-5 flex items-center gap-2 px-3 text-xs leading-6 text-muted"><LockKeyhole size={14} />{journey.access ? 'Guest access stays in this tab.' : 'You can talk as a guest. No account needed.'}</p><PwaControls busy={!!journey.busy || !!draft.trim() || voice.state.active} /></nav>}
      {panel === 'journey' && <>
        <div className="mb-5 grid grid-cols-2 rounded-2xl border border-line bg-cream p-1" role="tablist" aria-label="Journey views">{(['conversation', 'map'] as const).map(view => <button key={view} id={`${view}-tab`} role="tab" aria-selected={tab === view} aria-controls={`${view}-panel`} tabIndex={tab === view ? 0 : -1} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { const next = view === 'map' ? 'conversation' : 'map'; setTab(next); document.getElementById(`${next}-tab`)?.focus(); } }} className={`mobile-tab ${tab === view ? 'bg-lavender/15' : ''}`} onClick={() => { setTab(view); if (view === 'conversation' && !journey.access && !journey.busy) void journey.start(); }}>{view === 'map' ? <Map size={15} /> : <MessageCircle size={15} />}{view === 'map' ? 'Clarity Map' : 'Conversation'}</button>)}</div>
        {error}<p className="mb-3 text-xs text-muted">Your map is here whenever you need it. You can simply keep talking.</p>
        {journey.busy === 'restoring' && <p role="status">Finding your place…</p>}
        {tab === 'conversation' ? <div id="conversation-panel" role="tabpanel" aria-labelledby="conversation-tab"><Conversation messages={journey.messages} draft={draft} setDraft={setDraft} busy={journey.busy} blocked={disabled || voice.state.requestPending} avatar={voice.avatar} avatarEvent={journey.avatarEvent} send={text => voice.controller.sendTyped(text)} saveAction={journey.saveAction} actions={journey.actions} responseMode={preferences.responseMode} controls={responseControls} playback={<PlaybackControls voice={voice} />} /></div> : <div id="map-panel" role="tabpanel" aria-labelledby="map-tab"><ClarityMap concerns={journey.concerns} actions={journey.actions} disabled={disabled} edit={journey.edit} confirm={journey.confirm} complete={journey.complete} /></div>}
      </>}
      {panel === 'settings' && <div className="grid gap-6">
        <label className="field-label">Conversation language<select value={preferences.language} disabled={voice.state.requestPending} onChange={event => { if (isVoiceLanguage(event.target.value)) { const language = event.target.value; voice.controller.setLanguage(language); setPreferences(current => ({ ...current, language })); } }}>{Object.entries(languages).map(([value, item]) => <option key={value} value={value}>{item.name}</option>)}</select></label>
        <p className="text-xs leading-6 text-muted">Auto-detect identifies typed text using Meta in the existing message request. Automatic spoken-language detection is not configured. For voice, select a specific language beside the main controls. French and Hindi recognition depend on your browser; Kinyarwanda recognition is unverified and may require typing. Missing matching voices keep the written reply available.</p>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={preferences.voicePreferred} onChange={event => setPreferences(current => ({ ...current, voicePreferred: event.target.checked }))} />Prefer voice mode (activation still needs a tap)</label>
        <p className="text-xs text-muted">Response mode is selected beside the conversation controls: Text, Voice or Both.</p>
        <LanguageDiagnostics voice={voice} />
        <label className="field-label">Speech rate: {voice.state.rate.toFixed(1)}×<input type="range" min="0.7" max="1.4" step="0.1" value={voice.state.rate} onChange={event => voice.controller.setRate(Number(event.target.value))} /></label>
        <label className="field-label">Pause before sending: {(voice.state.silenceMs / 1000).toFixed(1)}s<input type="range" min="800" max="4000" step="200" value={voice.state.silenceMs} onChange={event => voice.controller.setSilenceMs(Number(event.target.value))} /></label>
        <PwaControls busy={!!journey.busy || !!draft.trim() || voice.state.active} />
        <DeviceCopy online current={journey.access ? { messages: journey.messages, concerns: journey.concerns, actions: journey.actions } : undefined} disabled={disabled} />
        <details className="rounded-2xl border border-line p-4"><summary className="cursor-pointer text-xs">Response timings on this device</summary><p className="mt-3 text-xs leading-6 text-muted">Latest turn only; never logged or stored. Browser speech does not expose audio timestamps, so endpointing includes the selected pause, and finalisation is available only when a final result follows a speech-end event.</p><dl className="mt-3 grid grid-cols-2 gap-2 text-xs">{Object.entries({ 'Pause / endpointing': voice.state.timings.endpointingMs, 'Observed finalisation': voice.state.timings.finalizationMs, 'Laravel round trip': journey.timings?.requestMs, 'Meta API': journey.timings?.metaMs, 'Output validation': journey.timings?.validationMs, 'Backend excluding Meta': journey.timings?.backendMs, 'Speech startup': voice.state.timings.ttsStartupMs }).map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd>{value === undefined ? 'Not measured' : `${value.toFixed(1)} ms`}</dd></div>)}</dl></details>
      </div>}
      {panel === 'privacy' && <div className="space-y-4 text-sm leading-7 text-muted"><p>You decide when Mirembe listens. Voice sends final transcripts after a pause. Browser speech services may process audio; Mirembe does not store raw recordings.</p><p>Text and final transcripts are sent to the configured AI provider and saved with your guest journey. The guest token stays in this tab, never in a URL. Closing a tab does not delete server data.</p><p>Voice pauses when the app is hidden, offline or a panel is opened. Resume requires your tap. Live AI and voice need connectivity. Offline copies are optional, passphrase-encrypted and removable in Settings.</p><p>Mirembe is an AI clarity companion, not a therapist. She cannot diagnose or provide emergency care.</p><button className="btn-secondary" onClick={() => open('delete')}>Delete my data</button></div>}
      {(panel === 'signin' || panel === 'register') && <div className="space-y-4 text-sm leading-7 text-muted"><p>Account {panel === 'signin' ? 'sign-in' : 'registration'} is not available yet. This is a placeholder; no credentials are collected.</p><p>You can continue with Mirembe as a guest.</p><button className="btn-primary" onClick={() => setPanel(null)}>Back to Mirembe</button></div>}
      {panel === 'delete' && <div className="space-y-4 text-sm leading-7 text-muted">{error}<p>Deleting your journey removes its conversation, concerns and chosen steps from Mirembe, clears this tab’s guest access and removes its encrypted offline copy. This cannot be undone.</p>{journey.access ? <><button className="btn-primary" disabled={!!journey.busy} onClick={() => { void journey.clear().then(ok => { if (ok) { setDraft(''); setPanel(null); } }); }}>{journey.busy ? 'Clearing…' : 'Delete my journey'}</button><button className="btn-secondary ml-2" disabled={!!journey.busy} onClick={() => setPanel(null)}>Keep my journey</button>{journey.unavailable && <button className="text-button block" onClick={() => { journey.resetLocal(); setDraft(''); setPanel(null); }}>Forget access on this tab</button>}</> : <p>No online journey is accessible in this tab. Closing a tab may have lost access to earlier server records.</p>}<DeviceCopy online disabled={!!journey.busy} /><button className="text-button block" onClick={() => { saveVoicePreferences({ language: 'en-US', voicePreferred: true, responseMode: 'both' }); setPreferences({ language: 'en-US', voicePreferred: true, responseMode: 'both' }); }}>Reset language and voice preference</button></div>}
      {journey.storageWarning && <p className="mt-4 text-xs text-muted" role="status">Guest access could not be saved. Keep this tab open.</p>}
    </Panel>}
  </div>;
}
