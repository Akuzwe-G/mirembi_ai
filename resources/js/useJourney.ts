import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { avatarTransition } from './avatar-machine';
import { forgetGuest, readGuest, saveGuest } from './guest-storage';
import { deleteOfflineCopy } from './offline-vault';
import type { Analysis, Concern, ConcernEdit, GuestAccess, JourneyAction, Message } from './types';

export function useJourney() {
  const [access, setAccess] = useState<GuestAccess | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [actions, setActions] = useState<JourneyAction[]>([]);
  const [analysis, setAnalysis] = useState<Analysis>();
  const [busy, setBusy] = useState<string | null>('restoring');
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [avatar, avatarEvent] = useReducer(avatarTransition, 'idle');
  const lock = useRef(false);
  const currentAccess = useRef<GuestAccess | null>(null);
  const latestAnalysis = useRef<Analysis | null>(null);

  const remember = (guest: GuestAccess, result?: Analysis) => setStorageWarning(!saveGuest(guest, result));

  const perform = async (name: string, operation: () => Promise<void>) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(name); setError(null);
    try { await operation(); return true; }
    catch (exception) {
      setError(exception instanceof ApiError ? exception.message : 'Something went wrong. Please refresh your journey.');
      if (exception instanceof ApiError && [403, 404].includes(exception.status)) setUnavailable(true);
      if (name === 'restoring' || !(exception instanceof ApiError) || exception.status === 0 || exception.status >= 500 && exception.status !== 503) setNeedsRefresh(true);
      avatarEvent('ERROR');
      return false;
    } finally { lock.current = false; setBusy(null); }
  };

  const restore = useCallback(async () => {
    if (!navigator.onLine) { setBusy(null); return; }
    const saved = readGuest() ?? (currentAccess.current ? { access: currentAccess.current, analysis: undefined } : null);
    if (!saved) { setBusy(null); return; }
    currentAccess.current = saved.access;
    setAccess(saved.access);
    await perform('restoring', async () => {
      const snapshot = await api.restore(saved.access);
      const latest = snapshot.messages.at(-1);
      const cached = saved.analysis && latest?.role === 'assistant' && latest.content === saved.analysis.reflection ? saved.analysis : undefined;
      setMessages(snapshot.messages.map((message, index) => index === snapshot.messages.length - 1 && cached ? { ...message, analysis: cached } : message));
      setConcerns(snapshot.concerns); setActions(snapshot.actions); setAnalysis(cached);
      setNeedsRefresh(false); setUnavailable(false);
    });
  }, []);

  useEffect(() => { void restore(); }, [restore]);
  useEffect(() => {
    if (avatar !== 'speaking' && avatar !== 'encouraging') return;
    const timer = setTimeout(() => avatarEvent('SETTLE'), avatar === 'speaking' ? 4500 : 2400);
    return () => clearTimeout(timer);
  }, [avatar]);

  const start = () => perform('starting', async () => {
    const created = await api.create();
    const guest = { journey_id: created.journey_id, access_token: created.access_token };
    currentAccess.current = guest;
    remember(guest); setAccess(guest); setNeedsRefresh(false); setUnavailable(false);
  });

  const send = (text: string) => {
    const guest = currentAccess.current;
    if (!navigator.onLine || !guest || !text.trim() || needsRefresh || unavailable) return Promise.resolve(false);
    return perform('sending', async () => {
      avatarEvent('SEND');
      const result = await api.send(guest, text.trim());
      latestAnalysis.current = result.analysis;
      const stamp = Date.now();
      setMessages(current => [...current, { id: `u-${stamp}`, role: 'user', content: text.trim() },
        { id: `a-${stamp}`, role: 'assistant', content: result.analysis.reflection, analysis: result.analysis }]);
      setConcerns(result.concerns); setAnalysis(result.analysis); remember(guest, result.analysis);
      avatarEvent('REPLY');
    });
  };

  const sendVoice = async (text: string): Promise<Analysis | null> => {
    return await send(text) ? latestAnalysis.current : null;
  };

  const edit = (id: number, values: ConcernEdit) => {
    if (!access || unavailable) return Promise.resolve(false);
    return perform('saving', async () => {
      const updated = await api.edit(access, id, values);
      setConcerns(current => current.map(concern => concern.id === id ? updated : concern));
    });
  };

  const confirm = (id: number) => {
    if (!access || unavailable) return Promise.resolve(false);
    return perform('saving', async () => {
      const result = await api.confirm(access, id);
      setConcerns(result.concerns); avatarEvent('CONFIRM');
    });
  };

  const saveAction = (title: string) => {
    if (!access || unavailable) return Promise.resolve(false);
    return perform('saving', async () => {
      const result = await api.action(access, title);
      setActions(current => [...current, result]); avatarEvent('CONFIRM');
    });
  };

  const complete = (action: JourneyAction) => {
    if (!access || unavailable) return Promise.resolve(false);
    return perform('saving', async () => {
      const updated = await api.complete(access, action.id, action.status === 'completed' ? 'pending' : 'completed');
      setActions(current => current.map(item => item.id === updated.id ? updated : item));
      avatarEvent('CONFIRM');
    });
  };

  const resetLocal = () => {
    currentAccess.current = null;
    forgetGuest(); setAccess(null); setMessages([]); setConcerns([]); setActions([]);
    setAnalysis(undefined); setError(null); setNeedsRefresh(false); setUnavailable(false);
    setStorageWarning(false); avatarEvent('ERROR');
  };

  const clear = () => {
    if (!access) return Promise.resolve(false);
    return perform('deleting', async () => {
      try { await api.clear(access); }
      catch (exception) {
        if (!(exception instanceof ApiError && exception.status === 404)) throw exception;
      }
      let deviceRemoved = true;
      try { await deleteOfflineCopy(); } catch { deviceRemoved = false; }
      resetLocal();
      window.dispatchEvent(new Event('mirembe:device-copy-changed'));
      if (!deviceRemoved) setError('Your online journey was deleted, but its device copy could not be removed. Use the device-copy deletion control below to retry.');
    });
  };

  return { access, messages, concerns, actions, analysis, busy, error, needsRefresh, unavailable,
    storageWarning, avatar, avatarEvent, start, send, sendVoice, edit, confirm, saveAction, complete, clear, restore, resetLocal };
}
