import { Mic, MicOff, Pause, Play, Square, Volume2, VolumeX, Keyboard } from 'lucide-react';
import { Avatar } from './Avatar';
import type { useVoiceConversation } from '../voice/useVoiceConversation';
import type { VoicePhase } from '../voice/contracts';

const labels: Record<VoicePhase, string> = {
  idle: 'A conversation at your pace', requesting_permission: 'Preparing your microphone', listening: 'Listening to you',
  processing: 'One moment', thinking: 'Mirembe is reflecting', speaking: 'A reflection from Mirembe', paused: 'Voice is paused', error: 'Let’s take a pause',
};
export const voiceConsent = 'Voice mode sends final transcripts automatically after you pause and speaks replies aloud. Your browser may process audio through its speech service. You can mute, pause or end at any time.';

export function VoiceConversationPanel({ voice, onTyping, disabled = false }: {
  voice: ReturnType<typeof useVoiceConversation>; onTyping: (transcript: string) => void; disabled?: boolean;
}) {
  const { state, controller } = voice;
  const running = state.active && !['paused', 'error'].includes(state.phase);
  const typing = () => {
    const text = ['error', 'paused'].includes(state.phase) ? `${state.transcript} ${state.interim}`.trim() : '';
    controller.end(); onTyping(text);
  };
  return <section className="voice-panel mx-auto my-6 max-w-5xl rounded-3xl border border-lavender/30 bg-white p-5 shadow-soft sm:p-7" aria-labelledby="voice-title" data-voice-state={state.phase}>
    <div className="flex items-center gap-4"><Avatar compact state={voice.avatar} /><div><p className="eyebrow">Talk with Mirembe</p><h2 id="voice-title" className="mt-1 font-display text-2xl">{labels[state.phase]}</h2></div><span className={`ml-auto inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs ${state.microphoneActive ? 'bg-sage/25 text-sage-dark' : 'bg-plum/5 text-muted'}`} role="status">{state.microphoneActive ? <Mic size={14} /> : <MicOff size={14} />}<span>{state.microphoneActive ? 'Mic on' : 'Mic off'}</span></span></div>
    {state.phase === 'idle' ? <><p className="mt-4 text-xs leading-6 text-muted">{voiceConsent}</p><button className="btn-primary mt-4" disabled={disabled} onClick={() => void controller.start()}><Mic size={16} />Start talking</button></> : <>
      <div className={`voice-wave my-5 flex h-12 items-center justify-center gap-1.5 ${state.microphoneActive || state.phase === 'speaking' ? 'voice-wave-active' : ''}`} aria-hidden="true">{Array.from({ length: 17 }, (_, index) => <span key={index} style={{ height: `${10 + (index * 13 % 30)}px`, animationDelay: `${index * .06}s` }} />)}</div>
      <p className="text-center text-sm leading-7" role={state.phase === 'error' ? 'alert' : 'status'}>{state.notice}</p>
      {(state.transcript || state.interim) && <div className="mt-4 rounded-2xl bg-cream p-4" aria-label="Your voice transcript"><p className="message-name">Your words</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{state.transcript}<span className="text-muted">{state.interim ? ` ${state.interim}` : ''}</span></p><p className="mt-2 text-xs text-muted">{state.requestPending ? 'Sent once. Waiting for Mirembe.' : 'Final speech is sent automatically after your pause.'}</p></div>}
      {state.spokenText && <details className="mt-4 rounded-2xl bg-lavender/10 p-4"><summary className="cursor-pointer text-xs font-semibold">Mirembe’s spoken reply</summary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{state.spokenText}</p></details>}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {running ? <button className="btn-secondary gap-2" onClick={() => controller.pause()}><Pause size={15} />Pause voice</button> : <button className="btn-primary gap-2" disabled={disabled || state.requestPending || state.muted} onClick={() => void controller.resume()}><Play size={15} />Resume voice</button>}
        <button className="btn-secondary gap-2" aria-pressed={state.muted} onClick={() => controller.setMuted(!state.muted)}>{state.muted ? <Mic size={15} /> : <MicOff size={15} />}{state.muted ? 'Unmute microphone' : 'Mute microphone'}</button>
        {state.phase === 'speaking' && <button className="btn-secondary" onClick={() => controller.pause('Speech stopped. Tap Resume voice when you’re ready to talk.')}>Stop speaking</button>}
        <button className="btn-secondary gap-2" onClick={() => controller.end()}><Square size={13} />End conversation</button>
        <button className="btn-secondary gap-2" onClick={typing}><Keyboard size={15} />Switch to typing</button>
      </div>
      <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={state.outputEnabled} onChange={event => controller.setOutputEnabled(event.target.checked)} />{state.outputEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}Spoken replies</label><label className="field-label">Speech rate: {state.rate.toFixed(1)}×<input type="range" min="0.7" max="1.4" step="0.1" value={state.rate} onChange={event => controller.setRate(Number(event.target.value))} /></label><label className="field-label">Pause before sending: {(state.silenceMs / 1000).toFixed(1)}s<input type="range" min="800" max="4000" step="200" value={state.silenceMs} onChange={event => controller.setSilenceMs(Number(event.target.value))} /></label></div>
      {!controller.outputSupported && <p className="mt-3 text-xs leading-6 text-muted">Speech playback is not available here. Mirembe’s replies remain visible as text.</p>}
      <p className="mt-3 text-xs leading-6 text-muted">Voice needs a connection. The microphone is stopped while Mirembe speaks and when the app is paused, hidden or closed. Nothing is recorded or saved as raw audio by Mirembe.</p>
    </>}
  </section>;
}
