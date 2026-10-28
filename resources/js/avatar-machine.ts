export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'encouraging';
export type AvatarEvent = 'FOCUS' | 'BLUR' | 'SEND' | 'REPLY' | 'SETTLE' | 'CONFIRM' | 'ERROR';

export function avatarTransition(state: AvatarState, event: AvatarEvent): AvatarState {
  switch (event) {
    case 'SEND': return 'thinking';
    case 'REPLY': return 'speaking';
    case 'CONFIRM': return 'encouraging';
    case 'ERROR': return 'idle';
    case 'FOCUS': return state === 'thinking' ? state : 'listening';
    case 'BLUR': return state === 'listening' ? 'idle' : state;
    case 'SETTLE': return state === 'speaking' || state === 'encouraging' ? 'idle' : state;
  }
}
