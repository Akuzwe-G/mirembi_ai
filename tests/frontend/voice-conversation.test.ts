import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceConversation } from '../../resources/js/voice/VoiceConversation';
import type { RecognitionEvents, SpeechOutcome } from '../../resources/js/voice/contracts';
import { analysis } from './fixtures';

function fixture() {
  let events!: RecognitionEvents;
  let available = true;
  const input = { supported: true, start: vi.fn((value: RecognitionEvents) => { events = value; value.started(); }), stop: vi.fn(), abort: vi.fn() };
  const output = { supported: true, activate: vi.fn(), speak: vi.fn(async (_text: string, _rate: number, start: () => void): Promise<SpeechOutcome> => { start(); return 'completed'; }), stop: vi.fn(), dispose: vi.fn() };
  const permission = vi.fn().mockResolvedValue(undefined);
  const ensureJourney = vi.fn().mockResolvedValue(true);
  const send = vi.fn().mockResolvedValue(analysis);
  const controller = new VoiceConversation({ input, output, permission, ensureJourney, send, available: () => available });
  return { controller, input, output, permission, ensureJourney, send, events: () => events, offline: () => { available = false; controller.pause('Connection lost.'); } };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('hands-free conversation lifecycle', () => {
  it('has no capture or playback before activation and welcomes only after a user action', async () => {
    const f = fixture();
    expect(f.controller.getSnapshot().phase).toBe('idle');
    expect(f.input.start).not.toHaveBeenCalled();
    expect(f.output.speak).not.toHaveBeenCalled();
    const phases: string[] = [];
    f.controller.subscribe(() => phases.push(f.controller.getSnapshot().phase));
    await f.controller.start();
    expect(f.permission).toHaveBeenCalledOnce();
    expect(f.ensureJourney).toHaveBeenCalledOnce();
    expect(f.output.activate).toHaveBeenCalledOnce();
    expect(phases).toEqual(expect.arrayContaining(['requesting_permission', 'speaking', 'processing', 'listening']));
    expect(f.controller.getSnapshot().microphoneActive).toBe(true);
    f.controller.dispose();
  });

  it('collects interim speech, sends a final utterance once and resumes only after reply playback ends', async () => {
    const f = fixture(); await f.controller.start();
    let finishSpeech!: (value: SpeechOutcome) => void;
    f.output.speak.mockImplementationOnce((_text, _rate, start) => { start(); return new Promise(resolve => { finishSpeech = resolve; }); });
    f.events().transcript('', 'I am juggling');
    expect(f.controller.getSnapshot().interim).toBe('I am juggling');
    f.events().transcript('I am juggling studies and work.', '');
    const stale = f.events();
    await vi.advanceTimersByTimeAsync(1600);
    expect(f.send).toHaveBeenCalledExactlyOnceWith('I am juggling studies and work.');
    expect(f.controller.getSnapshot()).toMatchObject({ phase: 'speaking', microphoneActive: false });
    expect(f.input.start).toHaveBeenCalledTimes(1);
    stale.ended(); stale.transcript('I am juggling studies and work.', '');
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.output.speak.mock.calls.at(-1)![0]).toBe(`${analysis.reflection} ${analysis.clarification_question}`);
    finishSpeech('completed'); await vi.advanceTimersByTimeAsync(0);
    expect(f.input.start).toHaveBeenCalledTimes(2);
    expect(f.controller.getSnapshot().phase).toBe('listening');
    f.controller.dispose();
  });

  it('rejects immediate repeated recognizer transcripts but allows a deliberate repeat after resume', async () => {
    const f = fixture(); await f.controller.start();
    f.events().transcript('Friday comes first.', ''); f.events().ended();
    await vi.advanceTimersByTimeAsync(0);
    f.events().transcript('Friday comes first.', ''); f.events().ended();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot().phase).toBe('paused');
    await f.controller.resume();
    f.events().transcript('Friday comes first.', ''); f.events().ended();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.send).toHaveBeenCalledTimes(2);
    f.controller.dispose();
  });

  it('does not submit interim-only guesses when the browser fails to finalise them', async () => {
    const f = fixture(); await f.controller.start();
    f.events().transcript('', 'not yet a final result');
    await vi.advanceTimersByTimeAsync(1600);
    expect(f.input.stop).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot().phase).toBe('processing');
    await vi.advanceTimersByTimeAsync(1500);
    expect(f.controller.getSnapshot().phase).toBe('paused');
    expect(f.send).not.toHaveBeenCalled(); f.controller.dispose();
  });

  it('handles permission denial without creating a journey or leaving capture running', async () => {
    const f = fixture(); f.permission.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    await f.controller.start();
    expect(f.controller.getSnapshot()).toMatchObject({ phase: 'error', active: false, microphoneActive: false });
    expect(f.input.start).not.toHaveBeenCalled(); expect(f.ensureJourney).not.toHaveBeenCalled();
    expect(f.output.stop).toHaveBeenCalled(); f.controller.dispose();
  });

  it('pauses on blocked automatic restart and offers a deliberate resume', async () => {
    const f = fixture(); f.input.start.mockImplementationOnce(() => { throw new Error('gesture required'); });
    await f.controller.start();
    expect(f.controller.getSnapshot().phase).toBe('paused');
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.input.start).toHaveBeenCalledTimes(1);
    await f.controller.resume();
    expect(f.controller.getSnapshot().phase).toBe('listening'); f.controller.dispose();
  });

  it('bounds silence restarts and never submits an empty message', async () => {
    const f = fixture(); await f.controller.start();
    for (let index = 0; index < 3; index++) { f.events().ended(); await vi.advanceTimersByTimeAsync(500); }
    expect(f.controller.getSnapshot().phase).toBe('paused');
    expect(f.send).not.toHaveBeenCalled(); expect(f.input.start).toHaveBeenCalledTimes(3); f.controller.dispose();
  });

  it('stops both speech directions on pause, mute, permission revocation and end', async () => {
    const f = fixture(); await f.controller.start(); const old = f.events();
    f.controller.setMuted(true);
    expect(f.controller.getSnapshot()).toMatchObject({ phase: 'paused', muted: true, microphoneActive: false });
    await f.controller.resume(); expect(f.input.start).toHaveBeenCalledTimes(1);
    old.transcript('A late transcript', ''); old.ended(); expect(f.send).not.toHaveBeenCalled();
    f.controller.setMuted(false); await f.controller.resume();
    f.controller.permissionRevoked();
    expect(f.controller.getSnapshot()).toMatchObject({ phase: 'error', active: false, microphoneActive: false });
    f.controller.end(); expect(f.controller.getSnapshot().phase).toBe('idle');
    expect(f.input.abort).toHaveBeenCalled(); expect(f.output.stop).toHaveBeenCalled(); f.controller.dispose();
  });

  it('ignores late permission completion after the user ends voice mode', async () => {
    const f = fixture(); let grant!: () => void;
    f.permission.mockReturnValue(new Promise<void>(resolve => { grant = resolve; }));
    const started = f.controller.start(); f.controller.end(); grant(); await started;
    expect(f.ensureJourney).not.toHaveBeenCalled(); expect(f.input.start).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().phase).toBe('idle'); f.controller.dispose();
  });

  it('never retries a failed API request automatically and retains the transcript for review', async () => {
    const f = fixture(); f.send.mockResolvedValue(null); await f.controller.start();
    f.events().transcript('A fictional deadline is Friday.', ''); f.events().ended();
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot()).toMatchObject({ phase: 'error', transcript: 'A fictional deadline is Friday.', microphoneActive: false });
    f.controller.dispose();
  });

  it('does not play or restart capture after stopping while a request is in flight', async () => {
    const f = fixture(); let respond!: (value: typeof analysis) => void;
    f.send.mockReturnValue(new Promise(resolve => { respond = resolve; })); await f.controller.start();
    f.events().transcript('One fictional concern.', ''); f.events().ended();
    expect(f.controller.getSnapshot().requestPending).toBe(true);
    f.controller.end(); respond(analysis); await vi.advanceTimersByTimeAsync(0);
    expect(f.controller.getSnapshot()).toMatchObject({ phase: 'idle', active: false, requestPending: false });
    expect(f.output.speak).toHaveBeenCalledTimes(1); expect(f.input.start).toHaveBeenCalledTimes(1); f.controller.dispose();
  });

  it('pauses offline without queuing and applies speech/silence controls', async () => {
    const f = fixture(); f.controller.setOutputEnabled(false); f.controller.setRate(1.2); f.controller.setSilenceMs(2400);
    await f.controller.start(); expect(f.output.speak).not.toHaveBeenCalled();
    f.events().transcript('A fictional concern.', ''); await vi.advanceTimersByTimeAsync(1600);
    expect(f.send).not.toHaveBeenCalled();
    f.offline(); await vi.advanceTimersByTimeAsync(10000);
    expect(f.send).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot()).toMatchObject({ phase: 'paused', rate: 1.2, silenceMs: 2400, microphoneActive: false }); f.controller.dispose();
  });
});
