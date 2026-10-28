import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

export interface SpeechSession {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>; resultIndex: number }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechSession; webkitSpeechRecognition?: new () => SpeechSession };

export function VoiceInput({ disabled, onTranscript, onListening }: { disabled: boolean; onTranscript: (text: string) => void; onListening: (active: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState('');
  const session = useRef<SpeechSession | null>(null);
  const Constructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
  const microphone = !!navigator.mediaDevices?.getUserMedia;
  const supported = !!Constructor && microphone && window.isSecureContext;
  const callbacks = useRef({ onTranscript, onListening });
  callbacks.current = { onTranscript, onListening };
  useEffect(() => () => { session.current?.abort(); callbacks.current.onListening(false); }, []);
  useEffect(() => { if (disabled) session.current?.abort(); }, [disabled]);
  const start = async () => {
    if (!Constructor || !supported || disabled || !navigator.onLine) return;
    setNotice('');
    try {
      if (navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (permission.state === 'denied') { setNotice('Microphone permission was denied. You can keep typing, or change permission in your browser settings.'); return; }
        } catch { /* Safari may not implement microphone permission queries. */ }
      }
      const recognition = new Constructor();
      recognition.lang = document.documentElement.lang || 'en'; recognition.continuous = false; recognition.interimResults = false;
      recognition.onresult = event => {
        let text = '';
        for (let index = event.resultIndex; index < event.results.length; index++) if (event.results[index].isFinal) text += event.results[index][0].transcript;
        if (text.trim()) callbacks.current.onTranscript(text.trim());
      };
      recognition.onerror = event => {
        setNotice(['not-allowed', 'service-not-allowed'].includes(event.error) ? 'Microphone permission was denied. You can keep typing, or change permission in your browser settings.' : 'Dictation could not continue. Please use text input or try again.');
        setListening(false); callbacks.current.onListening(false);
      };
      recognition.onend = () => { setListening(false); callbacks.current.onListening(false); session.current = null; };
      session.current = recognition; recognition.start(); setListening(true); callbacks.current.onListening(true);
    } catch { setNotice('Dictation is unavailable right now. Text input still works.'); setListening(false); callbacks.current.onListening(false); }
  };
  return <div className="relative"><button type="button" className="icon-button text-muted" aria-label="Voice input" aria-expanded={open} onClick={() => setOpen(!open)}>{listening ? <MicOff size={17} /> : <Mic size={17} />}</button>
    {open && <div className="absolute bottom-full left-0 z-20 mb-2 w-[min(75vw,280px)] rounded-2xl border border-line bg-cream p-4 shadow-soft" aria-label="Voice input options"><p className="text-sm font-semibold">Optional dictation</p>
      <p className="mt-2 text-xs leading-6 text-muted">{supported ? 'Your browser may send audio to its speech service. Dictation needs a connection and browser permission. Review the text before sending; it is never sent automatically.' : 'Speech recognition or microphone access is not available in this browser. Please use text input. Your microphone is not being accessed.'}</p>
      {supported && <button type="button" className="text-button mt-3" disabled={disabled} onClick={() => listening ? session.current?.stop() : void start()}>{listening ? 'Stop dictation' : 'Start dictation'}</button>}
      {notice && <p role="status" className="mt-3 text-xs leading-6">{notice}</p>}
    </div>}
  </div>;
}
