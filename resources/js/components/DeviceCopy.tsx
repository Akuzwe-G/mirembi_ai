import { useEffect, useState } from 'react';
import { Download, LockKeyhole, Trash2 } from 'lucide-react';
import { deleteOfflineCopy, offlineCopyDate, saveOfflineCopy, unlockOfflineCopy, type OfflineJourney } from '../offline-vault';

export function DeviceCopy({ online, current, disabled = false }: {
  online: boolean; current?: Pick<OfflineJourney, 'messages' | 'concerns' | 'actions'>; disabled?: boolean;
}) {
  const [date, setDate] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [unlocked, setUnlocked] = useState<OfflineJourney | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    const refresh = () => { setUnlocked(null); setPassphrase(''); void offlineCopyDate().then(setDate).catch(() => setError('This browser cannot access device storage.')); };
    const lock = () => { if (document.visibilityState === 'hidden') { setUnlocked(null); setPassphrase(''); } };
    refresh(); window.addEventListener('mirembe:device-copy-changed', refresh); document.addEventListener('visibilitychange', lock);
    return () => { window.removeEventListener('mirembe:device-copy-changed', refresh); document.removeEventListener('visibilitychange', lock); };
  }, []);
  useEffect(() => {
    if (!unlocked) return;
    const timer = setTimeout(() => setUnlocked(null), 10 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [unlocked]);
  const operate = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); } catch (exception) { setError(exception instanceof Error ? exception.message : 'Device storage could not be accessed.'); }
    finally { setBusy(false); setPassphrase(''); }
  };
  return <section className="device-copy mx-auto my-7 max-w-5xl rounded-2xl border border-line bg-white p-5 sm:p-7" aria-label="Offline journey on this device"><details open={!online || !!unlocked || undefined}>
    <summary className="cursor-pointer text-sm font-semibold"><LockKeyhole size={15} className="mr-2 inline" />Offline journey on this device</summary>
    <div className="mt-4 grid gap-4 text-sm leading-7">
      <p className="text-muted">Saving is optional. Keep one encrypted, read-only copy valid for 7 days. Expired copies are removed on the next access. Use a private device and a unique passphrase. Your guest access token is never included. This copy does not update automatically.</p>
      {date ? <p>Saved {new Date(date).toLocaleString()}. Your passphrase cannot be recovered.</p> : <p>No journey has been saved offline on this device.</p>}
      {online && current && current.messages.length > 0 && <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void operate(async () => {
        await saveOfflineCopy(current, passphrase); setDate(await offlineCopyDate()); setUnlocked(null); setNotice('Encrypted copy saved on this device. It is separate from your online journey.');
      }); }}><label className="field-label">{date ? 'Choose a passphrase for the replacement copy' : 'Choose an offline passphrase'}<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={passphrase} onChange={event => setPassphrase(event.target.value)} placeholder="At least 12 characters" disabled={busy} /></label><button type="submit" className="btn-secondary justify-self-start gap-2" disabled={busy || disabled || passphrase.length < 12}><Download size={15} />{date ? 'Replace saved device copy' : 'Save encrypted offline copy'}</button></form>}
      {date && !unlocked && <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void operate(async () => setUnlocked(await unlockOfflineCopy(passphrase))); }}><label className="field-label">Unlock saved offline copy<input type="password" autoComplete="off" maxLength={128} required value={passphrase} onChange={event => setPassphrase(event.target.value)} disabled={busy} /></label><button className="btn-primary justify-self-start" disabled={busy || !passphrase}>Unlock read-only copy</button></form>}
      {date && <div>{confirmDelete ? <div className="flex flex-wrap items-center gap-3"><p>Delete the device copy? Your online journey will stay.</p><button className="text-button" disabled={busy} onClick={() => void operate(async () => { await deleteOfflineCopy(); setDate(null); setUnlocked(null); setConfirmDelete(false); setNotice('Saved device copy deleted. Your online journey is unchanged.'); })}>Delete device copy</button><button className="text-button" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button></div> : <button className="text-button flex items-center gap-2" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14} />Remove saved device copy</button>}</div>}
      {notice && <p role="status" className="text-sage-dark">{notice}</p>}{error && <p role="alert" className="text-[#84442E]">{error}</p>}
      {unlocked && <div className="grid gap-5 border-t border-line pt-5" aria-label="Saved journey, read only"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl">Your saved journey</h2><button className="text-button" onClick={() => setUnlocked(null)}>Lock saved copy</button></div><p className="text-xs text-muted">Read only · Saved {new Date(unlocked.savedAt).toLocaleString()} · May be out of date</p>
        {unlocked.messages.map(message => <article key={message.id} className="rounded-xl bg-cream p-4"><h3 className="message-name">{message.role === 'user' ? 'You' : 'Mirembe'}{message.analysis?.demo_mode ? ' · Demo example' : ''}</h3><p className="whitespace-pre-wrap break-words">{message.content}</p>{message.analysis?.clarification_question && <p className="mt-3 break-words font-medium">{message.analysis.clarification_question}</p>}</article>)}
        <h3 className="eyebrow">Saved Clarity Map</h3>{unlocked.concerns.map(concern => <article key={concern.id} className="rounded-xl border border-line p-4"><h4 className="break-words font-display text-xl">{concern.title}</h4><p className="break-words text-xs text-muted">{concern.category} · {concern.urgency} priority{concern.deadline ? ` · ${concern.deadline}` : ''}</p><p className="text-xs">{concern.confirmed ? 'Confirmed by you' : 'Unconfirmed possibility — needs your review'}</p></article>)}
        {unlocked.actions.length > 0 && <><h3 className="eyebrow">Saved chosen steps</h3>{unlocked.actions.map(action => <p key={action.id} className="break-words rounded-xl bg-sage/20 p-4">{action.title} · {action.status.replaceAll('_', ' ')}</p>)}</>}
      </div>}
    </div></details></section>;
}
