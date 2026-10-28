import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Panel({ title, close, children }: { title: string; close(): void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus(); else document.getElementById('navigation-button')?.focus(); };
  }, []);
  return <dialog ref={ref} className="app-panel" aria-labelledby="panel-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4"><h2 id="panel-title" className="font-display text-2xl">{title}</h2><button className="icon-button" onClick={close} aria-label={`Close ${title}`}><X size={20} /></button></header>
    <div className="panel-scroll min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
  </dialog>;
}
