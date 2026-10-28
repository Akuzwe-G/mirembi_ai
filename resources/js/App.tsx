import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Check, LockKeyhole, Map, MessageCircle, RotateCcw, Sprout, Trash2, X } from 'lucide-react';
import { useJourney } from './useJourney';
import { Welcome } from './components/Welcome';
import { ClarityMap } from './components/ClarityMap';
import { Conversation } from './components/Conversation';

function ClearDialog({ busy, unavailable, close, clear, forget }: { busy: boolean; unavailable: boolean; close: () => void; clear: () => void; forget: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialog} className="clear-dialog rounded-3xl bg-cream p-7 text-plum" aria-labelledby="clear-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <div className="flex items-start justify-between gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-peach/60"><Trash2 size={20} /></div><button className="icon-button" onClick={close} disabled={busy} aria-label="Close clear journey dialog"><X size={18} /></button></div>
    <h2 id="clear-title" className="mt-5 font-display text-3xl">A fresh page?</h2><p className="mt-4 text-sm leading-7 text-muted">Clearing your journey deletes its conversation, concerns and chosen steps from Mirembe, and removes guest access from this tab. This cannot be undone.</p>
    {unavailable && <p className="mt-3 text-sm leading-6 text-muted">If your access is no longer valid, you can forget this tab’s access instead. This does not delete data on the server.</p>}
    <div className="mt-6 flex flex-wrap gap-3"><button className="btn-primary" onClick={clear} disabled={busy}>{busy ? 'Clearing…' : 'Delete my journey'}</button><button className="btn-secondary" onClick={close} disabled={busy}>Keep my journey</button></div>
    {unavailable && <button className="text-button mt-5" onClick={forget} disabled={busy}>Forget access on this tab</button>}
  </dialog>;
}

export default function App() {
  const journey = useJourney();
  const [tab, setTab] = useState<'conversation' | 'map'>('conversation');
  const [draft, setDraft] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const disabled = !!journey.busy || journey.unavailable || journey.needsRefresh;
  const confirmed = journey.concerns.filter(concern => concern.confirmed).length;
  const step = journey.actions.length ? 3 : journey.concerns.length ? 2 : 1;
  return <div className="min-h-dvh bg-cream text-plum">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <header className="border-b border-line/70"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-10 lg:px-16">
      <a href="#main-content" className="flex items-center gap-2.5" aria-label="Mirembe"><span className="brand-mark" aria-hidden="true"><Sprout size={22} strokeWidth={1.5} /></span><span className="font-display text-[27px] tracking-[-0.05em]">mirembe<span className="text-lavender">.</span></span></a>
      {journey.access ? <div className="flex items-center gap-3 sm:gap-6"><span className="hidden items-center gap-1.5 text-xs text-muted sm:flex"><LockKeyhole size={12} />Guest journey</span><button className="text-button flex items-center gap-2" disabled={!!journey.busy} onClick={() => setClearOpen(true)}><Trash2 size={14} />Clear journey</button></div> : <a href="#how-it-works" className="text-button flex items-center gap-2">A gentler way forward<ArrowRight size={14} className="hidden sm:block" /></a>}
    </div></header>
    {journey.storageWarning && <div role="status" className="mx-auto max-w-6xl px-5 pt-5 text-sm text-muted">This browser couldn’t save your guest access. Keep this page open to continue your journey.</div>}
    {journey.error && <div className="error-banner mx-auto my-5 flex max-w-5xl flex-wrap items-start gap-3 rounded-2xl border border-peach bg-peach/30 p-4" role="alert"><AlertCircle size={19} className="mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm leading-6">{journey.error}</p><div className="mt-2 flex flex-wrap gap-4">{journey.access && !journey.unavailable && <button className="text-button flex items-center gap-1.5" disabled={!!journey.busy} onClick={() => void journey.restore()}><RotateCcw size={13} />Refresh journey</button>}{!journey.access && <button className="text-button" disabled={!!journey.busy} onClick={() => void journey.start()}>Try again</button>}{journey.unavailable && <button className="text-button" onClick={() => setClearOpen(true)}>Manage guest access</button>}</div></div></div>}
    {journey.busy === 'restoring' ? <main id="main-content" className="flex min-h-[65vh] items-center justify-center gap-3 text-muted" aria-busy="true"><span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span><p role="status">Finding your place…</p></main> : !journey.access ? <Welcome start={() => void journey.start()} busy={!!journey.busy} /> : <main id="main-content" className="mx-auto max-w-7xl px-4 pb-10 pt-7 sm:px-10 sm:pt-10 lg:px-16">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow mb-2">Your space to untangle</p><h1 className="font-display text-3xl tracking-tight sm:text-4xl">Let’s take it one thought at a time.</h1></div><span className="text-xs text-muted">No rush. No perfect answers.</span></div>
      <ol className="journey-steps mb-7 grid grid-cols-3 gap-2" aria-label="Journey progress">{['Express yourself', 'Explore your map', 'Choose a small step'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`flex items-center gap-2 rounded-full px-2 py-2.5 text-[10px] sm:gap-3 sm:px-4 sm:text-xs ${step === index + 1 ? 'bg-lavender/15 font-medium' : 'text-muted'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${index + 1 <= step ? 'bg-plum text-cream' : 'border border-line'}`}>{index + 1 < step ? <Check size={11} /> : `0${index + 1}`}</span><span>{label}</span></li>)}</ol>
      {journey.analysis?.demo_mode && <div className="mb-5 rounded-xl bg-sage/20 px-4 py-3 text-xs leading-6 text-sage-dark" role="status">Demo mode · Mirembe is showing a fixed example, not analysing your message.</div>}
      <div className="mb-5 grid grid-cols-2 rounded-2xl border border-line bg-white p-1 lg:hidden" role="tablist" aria-label="Journey views">{(['conversation', 'map'] as const).map(view => <button key={view} id={`${view}-tab`} role="tab" aria-selected={tab === view} aria-controls={`${view}-panel`} tabIndex={tab === view ? 0 : -1} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { const next = view === 'map' ? 'conversation' : 'map'; setTab(next); document.getElementById(`${next}-tab`)?.focus(); } }} className={`mobile-tab ${tab === view ? 'bg-lavender/15' : ''}`} onClick={() => setTab(view)}>{view === 'map' ? <Map size={15} /> : <MessageCircle size={15} />}{view === 'map' ? 'Clarity Map' : 'Conversation'}{view === 'map' && journey.concerns.length > 0 && <span className="rounded-full bg-plum/10 px-1.5 text-[10px]">{journey.concerns.length}</span>}</button>)}</div>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] xl:gap-10">
        <div id="conversation-panel" aria-label="Conversation view" className={`min-w-0 overflow-hidden rounded-3xl border border-line bg-white shadow-soft ${tab === 'conversation' ? '' : 'hidden lg:block'}`}><Conversation messages={journey.messages} draft={draft} setDraft={setDraft} busy={journey.busy} blocked={disabled} avatar={journey.avatar} avatarEvent={journey.avatarEvent} send={journey.send} saveAction={journey.saveAction} actions={journey.actions} /></div>
        <aside id="map-panel" aria-label="Clarity Map view" className={`min-w-0 rounded-3xl bg-[#F1EFE8] p-5 sm:p-7 ${tab === 'map' ? '' : 'hidden lg:block'}`}><ClarityMap concerns={journey.concerns} actions={journey.actions} disabled={disabled} edit={journey.edit} confirm={journey.confirm} complete={journey.complete} />{confirmed > 0 && <p className="mt-5 text-xs text-sage-dark" role="status">{confirmed} of {journey.concerns.length} concerns confirmed by you.</p>}</aside>
      </div><p className="mt-7 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-muted"><LockKeyhole size={12} className="shrink-0" />Guest access stays in this tab. Refresh to return; clear your journey when you’re done.</p>
    </main>}
    <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-6 text-[11px] text-muted sm:px-10 lg:px-16"><p>Mirembe · A little space for what matters.</p><p>AI clarity companion. Always at your pace.</p></footer>
    {clearOpen && journey.access && <ClearDialog busy={!!journey.busy} unavailable={journey.unavailable} close={() => setClearOpen(false)} clear={() => { void journey.clear().then(ok => { setClearOpen(false); if (ok) { setDraft(''); setTab('conversation'); } }); }} forget={() => { journey.resetLocal(); setClearOpen(false); setDraft(''); setTab('conversation'); }} />}
  </div>;
}
