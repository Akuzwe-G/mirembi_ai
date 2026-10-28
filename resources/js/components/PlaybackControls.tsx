import { Play, Square } from 'lucide-react';
import type { useVoiceConversation } from '../voice/useVoiceConversation';

export function PlaybackControls({ voice }: { voice: ReturnType<typeof useVoiceConversation> }) {
  const { state, controller } = voice;
  if (!state.spokenText || state.responseMode === 'text') return null;
  return <div className="playback-controls text-center">
    {state.playbackNotice && <p className="mx-auto max-w-md text-xs leading-5 text-muted" role="status">{state.playbackNotice}</p>}
    {state.phase === 'speaking' || state.phase === 'processing' ? <button className="text-button inline-flex min-h-11 items-center gap-1.5" onClick={() => controller.pause('Speech stopped. Replay the reply when you’re ready.')}><Square size={13} />Stop speaking</button> : state.playbackStatus !== 'unavailable' && <button className="text-button inline-flex min-h-11 items-center gap-1.5" onClick={() => controller.replay()} disabled={state.requestPending}><Play size={13} />{state.playbackStatus === 'blocked' ? 'Enable audio' : 'Replay reply'}</button>}
  </div>;
}
