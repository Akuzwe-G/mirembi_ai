import { describe, expect, it } from 'vitest';
import { avatarTransition } from '../../resources/js/avatar-machine';

describe('avatar interaction lifecycle', () => {
  it('listens during composition, thinks while waiting, speaks on reply and settles', () => {
    expect(avatarTransition('idle', 'FOCUS')).toBe('listening');
    expect(avatarTransition('listening', 'BLUR')).toBe('idle');
    expect(avatarTransition('listening', 'SEND')).toBe('thinking');
    expect(avatarTransition('thinking', 'FOCUS')).toBe('thinking');
    expect(avatarTransition('thinking', 'REPLY')).toBe('speaking');
    expect(avatarTransition('speaking', 'SETTLE')).toBe('idle');
  });
  it('encourages an intentional choice and recovers from errors', () => {
    expect(avatarTransition('idle', 'CONFIRM')).toBe('encouraging');
    expect(avatarTransition('encouraging', 'SETTLE')).toBe('idle');
    expect(avatarTransition('thinking', 'ERROR')).toBe('idle');
  });
});
