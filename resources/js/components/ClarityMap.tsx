import { Check, Circle, Compass, Map } from 'lucide-react';
import type { Concern, ConcernEdit, JourneyAction } from '../types';
import { ConcernCard } from './ConcernCard';

export function ClarityMap({ concerns, actions, disabled, edit, confirm, complete }: {
  concerns: Concern[]; actions: JourneyAction[]; disabled: boolean;
  edit: (id: number, values: ConcernEdit) => Promise<boolean>;
  confirm: (id: number) => Promise<boolean>;
  complete: (action: JourneyAction) => Promise<boolean>;
}) {
  return <div>
    <div className="flex items-center justify-between"><div className="eyebrow flex items-center gap-2"><Map size={15} />Your Clarity Map</div><span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-plum/5 px-1 text-xs">{concerns.length}</span></div>
    <h2 className="mt-4 font-display text-3xl tracking-tight">A little more perspective.</h2>
    <p className="mt-3 text-sm leading-6 text-muted">These are possibilities, not conclusions. Only you know what feels right.</p>
    <div className="mt-6 grid gap-3">
      {concerns.length === 0 ? <div className="rounded-2xl border border-dashed border-lavender/50 bg-white/50 px-6 py-10 text-center"><Compass className="mx-auto mb-4 text-lavender-dark" size={30} strokeWidth={1.2} /><h3 className="font-display text-xl">Clarity starts with a conversation.</h3><p className="mt-2 text-sm leading-6 text-muted">Share what’s on your mind. We’ll gently begin to map it out here.</p></div>
        : concerns.map(concern => <ConcernCard key={concern.id} concern={concern} disabled={disabled} edit={edit} confirm={confirm} />)}
    </div>
    {actions.length > 0 && <section className="mt-8" aria-labelledby="actions-heading"><h3 id="actions-heading" className="eyebrow">Steps you’ve chosen</h3><div className="mt-4 grid gap-3">{actions.map(action => <button key={action.id} disabled={disabled} onClick={() => void complete(action)} className="flex w-full items-start gap-3 rounded-2xl border border-sage/70 bg-sage/15 p-4 text-left" aria-label={`${action.status === 'completed' ? 'Reopen' : 'Complete'} action: ${action.title}`} aria-pressed={action.status === 'completed'}>{action.status === 'completed' ? <Check className="mt-1 shrink-0 text-sage-dark" size={18} /> : <Circle className="mt-1 shrink-0 text-sage-dark" size={18} />}<span className="min-w-0"><span className={`block break-words text-sm ${action.status === 'completed' ? 'line-through opacity-70' : ''}`}>{action.title}</span><span className="mt-1 block text-xs text-muted">{action.status === 'completed' ? 'Completed. A step worth noticing.' : 'Chosen by you · Tap when complete'}</span></span></button>)}</div></section>}
    <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-lavender" />You can edit any card. Nothing needs to be decided all at once.</p>
  </div>;
}
