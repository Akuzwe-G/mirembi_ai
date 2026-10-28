import type { Analysis, GuestAccess } from './types';

const key = 'mirembe.guest.v1';
export interface SavedGuest { access: GuestAccess; analysis?: Analysis }

export function readGuest(): SavedGuest | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!value || typeof value.access?.journey_id !== 'string'
      || !/^[0-9a-f-]{36}$/i.test(value.access.journey_id)
      || !/^[0-9a-f]{64}$/i.test(value.access.access_token)) return null;
    return value as SavedGuest;
  } catch { return null; }
}

export function saveGuest(access: GuestAccess, analysis?: Analysis): boolean {
  try { sessionStorage.setItem(key, JSON.stringify({ access, analysis })); return true; }
  catch { return false; }
}

export function forgetGuest(): boolean {
  try { sessionStorage.removeItem(key); return true; }
  catch { return false; }
}
