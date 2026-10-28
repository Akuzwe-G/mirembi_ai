import { useState } from 'react';
import { CalendarDays, Check, CheckCheck, Pencil, X } from 'lucide-react';
import type { Concern, ConcernEdit, Urgency } from '../types';

const urgencyLabels: Record<Urgency, string> = { high: 'High priority', medium: 'Medium priority', low: 'Low priority', unknown: 'Priority to explore', ongoing: 'Ongoing' };

export function ConcernCard({ concern, disabled, edit, confirm }: {
  concern: Concern; disabled: boolean;
  edit: (id: number, values: ConcernEdit) => Promise<boolean>;
  confirm: (id: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(concern.title);
  const [category, setCategory] = useState(concern.category);
  const [urgency, setUrgency] = useState(concern.urgency);
  const [deadline, setDeadline] = useState(concern.deadline ?? '');
  const beginEdit = () => { setTitle(concern.title); setCategory(concern.category); setUrgency(concern.urgency); setDeadline(concern.deadline ?? ''); setEditing(true); };

  return <article className={`concern-card rounded-2xl border bg-white p-5 ${concern.confirmed ? 'border-sage' : 'border-line'}`}>
    {editing ? <form aria-label={`Edit ${concern.title}`} className="grid gap-3" onSubmit={async event => {
      event.preventDefault();
      if (await edit(concern.id, { title: title.trim(), category: category.trim(), urgency, deadline: deadline.trim() || null, confirmed: false })) setEditing(false);
    }}>
      <div className="flex items-center justify-between"><h3 className="font-semibold">Make this yours</h3><button type="button" className="icon-button" disabled={disabled} onClick={() => setEditing(false)} aria-label="Cancel editing"><X size={17} /></button></div>
      <label className="field-label">Concern<input required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} autoFocus /></label>
      <label className="field-label">Category<input required maxLength={40} value={category} onChange={event => setCategory(event.target.value)} /></label>
      <label className="field-label">Priority<select value={urgency} onChange={event => setUrgency(event.target.value as Urgency)}>{Object.entries(urgencyLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="field-label">Deadline, if known<input maxLength={100} placeholder="e.g. Friday, or leave blank" value={deadline} onChange={event => setDeadline(event.target.value)} /></label>
      <p className="text-xs leading-5 text-muted">Changes return this card to “Needs your review”.</p>
      <button className="btn-primary justify-center" disabled={disabled || !title.trim() || !category.trim()} type="submit">{disabled ? 'Saving…' : 'Save changes'}</button>
    </form> : <>
      <div className="flex items-start justify-between gap-3"><span className="category-label">{concern.category}</span><button type="button" className="icon-button -mr-2 -mt-2" aria-label={`Edit ${concern.title}`} disabled={disabled} onClick={beginEdit}><Pencil size={15} /></button></div>
      <h3 className="mt-2 break-words font-display text-xl leading-snug">{concern.title}</h3>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className={`priority priority-${concern.urgency}`}><span />{urgencyLabels[concern.urgency]}</span></div>
      {concern.deadline && <p className="mt-3 flex items-start gap-2 break-words text-xs leading-5 text-muted"><CalendarDays size={14} className="mt-0.5 shrink-0" />{concern.deadline}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <span className={`flex items-center gap-1.5 text-[11px] ${concern.confirmed ? 'text-sage-dark' : 'text-muted'}`}>{concern.confirmed && <CheckCheck size={14} />}{concern.confirmed ? 'Confirmed by you' : 'Needs your review'}</span>
        {!concern.confirmed && <button className="text-button flex items-center gap-1" disabled={disabled} onClick={() => void confirm(concern.id)} aria-label={`Confirm ${concern.title}`}><Check size={14} />This feels right</button>}
      </div>
    </>}
  </article>;
}
