import { ArrowDown, ArrowRight, Feather, LockKeyhole, Route, Sprout } from 'lucide-react';
import { Avatar } from './Avatar';

export function Welcome({ start, busy }: { start: () => void; busy: boolean }) {
  return <main id="main-content" className="mx-auto max-w-7xl px-5 sm:px-10 lg:px-16">
    <section className="welcome-grid grid items-center gap-6 pb-12 pt-12 md:grid-cols-2 md:gap-10 md:pb-20 md:pt-20">
      <div className="relative z-10 max-w-xl">
        <div className="eyebrow mb-6"><span className="status-dot" />A softer place to start</div>
        <h1 className="font-display text-[clamp(3rem,5.6vw,4.8rem)] leading-[1.08] tracking-[-0.055em]">A little less noise.<br /><span className="text-lavender-dark">A little more clarity.</span></h1>
        <p className="mt-7 max-w-md text-lg leading-relaxed text-muted">Meet Mirembe, your AI clarity companion.<br className="hidden sm:block" /> From overwhelm to clarity, one step at a time.</p>
        <p className="mt-4 max-w-sm text-sm leading-7 text-muted">You don’t need to have it all figured out. Bring what’s on your mind. We’ll untangle it together.</p>
        <button className="btn-primary mt-8 gap-5 px-7 py-4" disabled={busy} onClick={start}>{busy ? 'Making space for you…' : 'Begin my journey'}<ArrowRight size={19} /></button>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted"><LockKeyhole size={13} />No account needed. Start as a guest.</div>
      </div>
      <div className="welcome-art relative flex min-h-80 items-center justify-center md:min-h-[460px]">
        <span className="art-note note-one">Room to pause.</span>
        <Avatar state="idle" />
        <span className="art-note note-two">Space to see what matters.</span>
        <span className="absolute bottom-0 text-[10px] uppercase tracking-[0.22em] text-muted">A space for Mirembe’s future avatar</span>
      </div>
    </section>
    <section id="how-it-works" className="border-t border-line py-10 md:py-14" aria-labelledby="how-heading">
      <div className="mb-8 flex items-center justify-between gap-4"><h2 id="how-heading" className="eyebrow">Small steps. A clearer picture.</h2><ArrowDown size={17} className="text-lavender-dark" /></div>
      <div className="grid gap-7 md:grid-cols-3 md:gap-12">
        {[
          { icon: Feather, number: '01', title: 'Let it out', description: 'Share what’s taking up space in your mind. There’s no right way to begin.', color: 'bg-lavender/15' },
          { icon: Route, number: '02', title: 'Make room for clarity', description: 'See your concerns take shape. Review them, change them, make them yours.', color: 'bg-sage/30' },
          { icon: Sprout, number: '03', title: 'Find one small step', description: 'Choose something manageable, when you’re ready. Your pace is the right pace.', color: 'bg-peach/50' },
        ].map(({ icon: Icon, ...step }) => <article key={step.number} className="flex gap-4"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${step.color}`}><Icon size={21} strokeWidth={1.5} /></div><div><p className="mb-2 text-[10px] tracking-widest text-muted">{step.number}</p><h3 className="font-display text-xl">{step.title}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-muted">{step.description}</p></div></article>)}
      </div>
    </section>
  </main>;
}
