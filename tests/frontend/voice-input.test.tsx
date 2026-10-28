import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceInput, type SpeechSession } from '../../resources/js/components/VoiceInput';

describe('progressive voice input', () => {
  it('leaves text as the fallback when speech recognition is unavailable', () => {
    render(<VoiceInput disabled={false} onTranscript={vi.fn()} onListening={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voice input' }));
    expect(screen.getByText(/Please use text input/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start dictation' })).not.toBeInTheDocument();
  });
  it('requests dictation only on a deliberate click and handles permission denial', async () => {
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
    let recognition!: SpeechSession;
    const start = vi.fn();
    vi.stubGlobal('SpeechRecognition', class {
      lang = ''; continuous = false; interimResults = false;
      onresult = null; onerror = null; onend = null;
      start = start; stop = vi.fn(); abort = vi.fn();
      constructor() { recognition = this; }
    });
    const onTranscript = vi.fn();
    render(<VoiceInput disabled={false} onTranscript={onTranscript} onListening={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voice input' }));
    expect(start).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start dictation' })));
    expect(start).toHaveBeenCalledTimes(1);
    act(() => recognition.onerror?.({ error: 'not-allowed' }));
    expect(screen.getByRole('status')).toHaveTextContent('You can keep typing');
    expect(onTranscript).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start dictation' })));
    act(() => recognition.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'A thought to review first.' } }] }));
    expect(onTranscript).toHaveBeenCalledWith('A thought to review first.');
  });
});
