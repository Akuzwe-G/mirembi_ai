import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Analysis } from '../types';
import { BrowserSpeechInput, BrowserSpeechOutput, requestMicrophone } from './browser-speech';
import { VoiceConversation } from './VoiceConversation';
import type { AvatarState } from '../avatar-machine';
import type { VoiceLanguage, ResponseMode } from './languages';

export function useVoiceConversation(options: { ensureJourney: () => Promise<boolean>; send: (text: string, inputMethod?: 'voice' | 'typing') => Promise<Analysis | null>; language?: VoiceLanguage; responseMode?: ResponseMode }) {
  const callbacks = useRef(options); callbacks.current = options;
  const [controller] = useState(() => new VoiceConversation({
    input: new BrowserSpeechInput(), output: new BrowserSpeechOutput(), permission: requestMicrophone,
    ensureJourney: () => callbacks.current.ensureJourney(), send: (text, method) => callbacks.current.send(text, method),
    available: () => navigator.onLine && document.visibilityState !== 'hidden',
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => { controller.setLanguage(options.language ?? 'en-US'); }, [controller, options.language]);
  useEffect(() => { controller.setResponseMode(options.responseMode ?? 'both'); }, [controller, options.responseMode]);
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') controller.pause('Voice paused because Mirembe went into the background. Tap Resume voice when you return.'); };
    const offline = () => controller.pause('Connection lost. Voice is paused; nothing is queued. Reconnect, then tap Resume voice.');
    const pagehide = () => controller.pause('Voice paused when you left the page. Tap Resume voice to continue.');
    let permission: PermissionStatus | undefined; let disposed = false;
    const permissionChanged = () => { if (permission?.state === 'denied' && controller.getSnapshot().active) controller.permissionRevoked(); };
    void navigator.permissions?.query({ name: 'microphone' as PermissionName }).then(status => {
      if (disposed) return;
      permission = status; status.addEventListener('change', permissionChanged);
    }).catch(() => {});
    document.addEventListener('visibilitychange', hidden); window.addEventListener('offline', offline); window.addEventListener('pagehide', pagehide);
    return () => {
      disposed = true; permission?.removeEventListener('change', permissionChanged);
      document.removeEventListener('visibilitychange', hidden); window.removeEventListener('offline', offline); window.removeEventListener('pagehide', pagehide);
      controller.dispose();
    };
  }, [controller]);
  const avatar: AvatarState = state.phase === 'listening' ? 'listening' : state.phase === 'speaking' ? 'speaking'
    : ['processing', 'thinking', 'requesting_permission'].includes(state.phase) ? 'thinking' : 'idle';
  return { controller, state, avatar };
}
