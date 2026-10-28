import { describe, expect, it, vi } from 'vitest';
import { forgetGuest, readGuest, saveGuest } from '../../resources/js/guest-storage';
import { access, analysis } from './fixtures';

describe('tab-scoped guest access', () => {
  it('restores valid access and the last analysis without using localStorage', () => {
    expect(saveGuest(access, analysis)).toBe(true);
    expect(readGuest()).toEqual({ access, analysis });
    expect(localStorage.length).toBe(0);
    expect(forgetGuest()).toBe(true);
    expect(readGuest()).toBeNull();
  });
  it('treats corrupt or invalid access as absent', () => {
    sessionStorage.setItem('mirembe.guest.v1', '{broken');
    expect(readGuest()).toBeNull();
    sessionStorage.setItem('mirembe.guest.v1', JSON.stringify({ access: { journey_id: '../other', access_token: 'invalid' } }));
    expect(readGuest()).toBeNull();
  });
  it('handles unavailable browser storage without exposing its contents', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Unavailable', 'QuotaExceededError'); });
    expect(saveGuest(access)).toBe(false);
    spy.mockRestore();
  });
});
