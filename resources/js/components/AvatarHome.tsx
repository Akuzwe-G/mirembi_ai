import { useState, type ReactNode } from 'react';
import { Keyboard, Mic, MicOff, Pause, Play, Square, Settings } from 'lucide-react';
import { PlaybackControls } from './PlaybackControls';
import { Avatar } from './Avatar';
import type { useVoiceConversation } from '../voice/useVoiceConversation';
import { languages } from '../voice/languages';
import type { Analysis } from '../types';

export function AvatarHome({ voice, analysis, controls, busy, disabled, activate, typing, settings }: {
  voice: ReturnType<typeof useVoiceConversation>; analysis?: Analysis; busy: string | null; disabled: boolean;
  activate(): void; typing(): void; settings(): void;
  controls: ReactNode;
}) {
  const { state, controller } = voice;
  const [captions, setCaptions] = useState(false);
  const showText = state.responseMode !== 'voice' || captions || ['blocked', 'unavailable'].includes(state.playbackStatus) || !analysis && !state.responseLanguage;
  const running = state.active && !['paused', 'error'].includes(state.phase);
  const status = state.microphoneActive ? 'Listening to you' : state.phase === 'speaking' ? 'Mirembe is speaking' : busy === 'sending' || state.phase === 'thinking' ? 'Mirembe is reflecting' : state.phase === 'processing' ? 'Transcribing' : state.phase === 'requesting_permission' ? 'Preparing microphone' : state.phase === 'paused' ? 'Voice is paused' : 'Here with you';
  const caption = state.spokenText || (analysis ? [analysis.reflection, analysis.clarification_question].filter(Boolean).join(' ') : languages[state.language].greeting);
  return <main id="main-content" className="avatar-home" data-voice-state={state.phase}>
    <section className="avatar-stage" aria-labelledby="home-greeting">
      <div className="home-avatar"><Avatar state={busy === 'sending' && !state.active ? 'thinking' : voice.avatar} /></div>
      <div className="home-caption">
        <p className="mb-2 flex items-center justify-center gap-2 text-[11px] text-muted" role="status"><span className={`status-dot ${state.microphoneActive ? 'mic-live' : ''}`} />{status}<span>· {state.microphoneActive ? 'Mic on' : 'Mic off'}</span></p>
        <h1 id="home-greeting" className={`font-display tracking-tight ${analysis || state.spokenText ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-4xl'}`} lang={state.responseLanguage ?? (state.language === 'auto' ? 'en' : state.language)} aria-live="polite">{showText ? caption : 'Here with you.'}</h1>
        {!showText && <p className="sr-only" lang={state.responseLanguage}>{caption}</p>}
        {state.responseMode === 'voice' && <button className="text-button min-h-11" aria-pressed={captions} onClick={() => setCaptions(!captions)}>{captions ? 'Hide captions' : 'Show captions'}</button>}
        {(state.transcript || state.interim) && <p className="live-transcript mt-3 text-sm leading-6 text-muted" aria-label="Your voice transcript" lang={state.language}>{state.transcript}<span className="italic">{state.interim ? ` ${state.interim}` : ''}</span></p>}
        {state.notice && ['paused', 'error'].includes(state.phase) && <p className="home-notice mt-3 text-xs leading-5 text-muted" role={state.phase === 'error' ? 'alert' : 'status'}>{state.notice}</p>}
      </div>
    </section>
    <div className="voice-dock">
      <div className={`voice-wave mb-2 flex h-5 items-center justify-center gap-1 ${state.microphoneActive || state.phase === 'speaking' ? 'voice-wave-active' : ''}`} aria-hidden="true">{Array.from({ length: 15 }, (_, index) => <span key={index} style={{ height: `${6 + index * 7 % 15}px`, animationDelay: `${index * .06}s` }} />)}</div>
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        <button className="dock-control" aria-label={state.muted ? 'Unmute microphone' : 'Mute microphone'} aria-pressed={state.muted} disabled={!state.active} onClick={() => controller.setMuted(!state.muted)}>{state.muted ? <MicOff size={19} /> : <Mic size={19} />}<span>{state.muted ? 'Unmute' : 'Mute'}</span></button>
        <button className={`microphone-button ${state.microphoneActive ? 'microphone-on' : ''}`} disabled={disabled || state.requestPending || state.muted} onClick={() => { if (running) controller.pause(); else activate(); }} aria-label={running ? 'Pause voice' : state.active ? 'Resume voice' : 'Enable microphone'}>{running ? <Pause size={26} /> : state.active ? <Play size={26} /> : <Mic size={27} />}<span>{running ? 'Pause' : state.active ? 'Resume voice' : 'Enable microphone'}</span></button>
        <button className="dock-control" disabled={!state.active && !state.requestPending && state.phase !== 'speaking'} onClick={() => controller.end()} aria-label="End conversation"><Square size={17} /><span>Stop</span></button>
      </div>
      <div className="mt-2 flex items-center justify-center gap-3">
        <button className="text-button flex min-h-11 items-center gap-2" onClick={typing}><Keyboard size={15} />{state.active ? 'Switch to typing' : 'Type instead'}</button>
        <button className="icon-button" onClick={settings} aria-label="Language and voice settings"><Settings size={16} /></button>
      </div>
      {controls}
      <PlaybackControls voice={voice} />
      {!state.active && <p className="voice-disclosure mx-auto max-w-md text-center text-[10px] leading-4 text-muted">Voice sends words after a pause. Your browser may process audio. Replies follow your chosen mode.</p>}
      {analysis?.demo_mode && <p className="text-center text-[10px] text-sage-dark" role="status">Demo example · not live analysis</p>}
    </div>
  </main>;
}
