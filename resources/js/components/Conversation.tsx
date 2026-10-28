import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Leaf, Mic, Sparkles } from 'lucide-react';
import type { AvatarEvent, AvatarState } from '../avatar-machine';
import type { JourneyAction, Message } from '../types';
import { Avatar } from './Avatar';

export function Conversation({ messages, draft, setDraft, busy, blocked, avatar, avatarEvent, send, saveAction, actions }: {
  messages: Message[]; draft: string; setDraft: (value: string) => void; busy: string | null; blocked: boolean;
  avatar: AvatarState; avatarEvent: (event: AvatarEvent) => void;
  send: (message: string) => Promise<boolean>; saveAction: (title: string) => Promise<boolean>; actions: JourneyAction[];
}) {
  const [voiceNotice, setVoiceNotice] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const region = bottom.current?.parentElement;
    if (messages.length && region) region.scrollTop = region.scrollHeight;
  }, [messages.length]);
  const submit = async () => {
    if (busy || blocked || !draft.trim()) return;
    if (await send(draft)) { setDraft(''); textarea.current?.focus(); }
  };
  const suggestion = messages.at(-1)?.analysis?.next_action;
  return <section aria-labelledby="conversation-heading" className="flex min-w-0 flex-col">
    <div className="flex items-center gap-4 border-b border-line px-5 py-5 sm:px-7"><Avatar state={avatar} compact /><div><h2 id="conversation-heading" className="font-display text-xl">A moment with Mirembe</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><span className="status-dot" />{busy === 'sending' ? 'Taking a moment to reflect…' : 'Here with you. At your pace.'}</p></div><Sparkles size={20} strokeWidth={1.2} className="ml-auto shrink-0 text-lavender-dark" /></div>
    <div className="conversation-scroll flex flex-col gap-6 overflow-y-auto overscroll-contain p-5 sm:p-7" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
      <div className="max-w-[92%]"><p className="message-name">Mirembe</p><div className="assistant-bubble"><p>I’m glad you’re here.</p><p className="mt-3">What’s taking up space in your mind today? A few words, a tangled thought, a whole list — start wherever you are.</p></div></div>
      {messages.map(message => <div key={message.id} className={`min-w-0 max-w-[92%] ${message.role === 'user' ? 'self-end' : 'self-start'}`}>
        <p className={`message-name ${message.role === 'user' ? 'text-right' : ''}`}>{message.role === 'user' ? 'You' : 'Mirembe'}{message.analysis?.demo_mode ? ' · Demo example' : ''}</p>
        <div className={message.role === 'user' ? 'user-bubble' : 'assistant-bubble'}><p className="whitespace-pre-wrap break-words">{message.content}</p>{message.analysis?.clarification_question && <div className="mt-4 border-t border-lavender/25 pt-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-lavender-dark">A gentle question</p><p className="whitespace-pre-wrap break-words font-medium">{message.analysis.clarification_question}</p></div>}</div>
      </div>)}
      {busy === 'sending' && <div className="flex items-center gap-3 text-sm text-muted" role="status"><span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>Mirembe is reflecting…</div>}<div ref={bottom} />
    </div>
    {messages.length === 0 && <div className="flex flex-wrap gap-2 px-5 pb-5 sm:px-7" aria-label="Ways to begin">{['There’s a lot on my mind', 'I don’t know where to start'].map(text => <button key={text} className="suggestion-chip" disabled={!!busy || blocked} onClick={() => { setDraft(text); textarea.current?.focus(); }}>{text}</button>)}</div>}
    {suggestion && <div className="mx-5 mb-5 rounded-2xl border border-peach bg-peach/25 p-4 sm:mx-7"><div className="flex items-center gap-2 text-xs font-medium"><Leaf size={14} />An optional grounding step</div><p className="mt-2 break-words text-sm leading-6">{suggestion}</p><p className="mt-1 text-xs leading-5 text-muted">Just a suggestion. You can keep talking without choosing this.</p>{actions.some(action => action.title === suggestion) ? <p className="mt-3 flex items-center gap-1.5 text-xs text-sage-dark"><Check size={14} />Added to your chosen steps</p> : <button className="text-button mt-3" disabled={!!busy || blocked} onClick={() => void saveAction(suggestion)}>Make this my next step <span aria-hidden="true">↗</span></button>}</div>}
    <form className="mt-auto border-t border-line p-4 sm:p-5" onSubmit={event => { event.preventDefault(); void submit(); }}><label htmlFor="message-input" className="sr-only">Your message to Mirembe</label>
      <div className="composer rounded-2xl border border-line bg-cream/50 p-3 focus-within:border-lavender focus-within:ring-2 focus-within:ring-lavender/15"><textarea id="message-input" ref={textarea} rows={2} value={draft} maxLength={3000} placeholder="You can start anywhere…" className="w-full resize-none border-0 bg-transparent p-1 text-sm leading-6 outline-none" disabled={!!busy || blocked} onFocus={() => avatarEvent('FOCUS')} onBlur={() => avatarEvent('BLUR')} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }} />
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><button type="button" className="icon-button text-muted" aria-label="Voice input — coming soon" aria-describedby={voiceNotice ? 'voice-notice' : undefined} onClick={() => setVoiceNotice(!voiceNotice)}><Mic size={17} /></button><span className="hidden text-[10px] text-muted sm:block">Enter to send · Shift + Enter for a new line</span></div><div className="flex items-center gap-3"><span className="text-[10px] text-muted" aria-label={`${draft.length} of 3000 characters`}>{draft.length}/3000</span><button type="submit" className="send-button" disabled={!draft.trim() || !!busy || blocked} aria-label={busy === 'sending' ? 'Sending message' : 'Send message'}><ArrowUp size={19} /></button></div></div>
      </div>{voiceNotice && <p id="voice-notice" className="mt-2 text-xs leading-5 text-muted" role="status">Voice input is coming later. Your microphone is not being accessed.</p>}<p className="mt-3 text-center text-[10px] leading-5 text-muted">Mirembe is an AI companion, not a therapist or emergency service.</p>
    </form>
  </section>;
}
