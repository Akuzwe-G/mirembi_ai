import type { AvatarState } from '../avatar-machine';

const labels: Record<AvatarState, string> = {
  idle: 'A little space to breathe', listening: 'Here to listen', thinking: 'Finding a little clarity',
  speaking: 'A reflection for you', encouraging: 'One step, at your pace',
};

export function Avatar({ state, compact = false }: { state: AvatarState; compact?: boolean }) {
  return <div className={`avatar ${compact ? 'avatar-compact' : ''}`} data-state={state} role="img" aria-label={`Mirembe avatar placeholder: ${state}`}>
    <div className="avatar-orbit orbit-one" aria-hidden="true" />
    <div className="avatar-orbit orbit-two" aria-hidden="true" />
    <div className="avatar-core" aria-hidden="true"><span /><span /><span /></div>
    {!compact && <><span className="avatar-spark spark-one" aria-hidden="true">✧</span><span className="avatar-spark spark-two" aria-hidden="true">✦</span>
      <div className="avatar-caption"><span className="status-dot" />{labels[state]}</div></>}
  </div>;
}
