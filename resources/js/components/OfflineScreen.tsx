import { WifiOff } from 'lucide-react';
import { DeviceCopy } from './DeviceCopy';

export function OfflineScreen() {
  return <main id="main-content" className="mx-auto max-w-6xl px-5 py-10 sm:px-10"><div className="mx-auto max-w-2xl text-center"><WifiOff className="mx-auto mb-5 text-lavender-dark" size={32} /><p className="eyebrow justify-center">A pause in the connection</p><h1 className="mt-4 font-display text-4xl">You’re offline. Your space is still here.</h1><p className="mt-5 text-sm leading-7 text-muted">Live AI conversations, edits and confirmations need an internet connection. Nothing will be sent or queued while you’re offline. Reconnect to continue your journey.</p><p className="mt-3 text-sm leading-7 text-muted">If you explicitly saved a device copy, unlock it below. Without a saved copy, private journey information is not available offline.</p><button className="btn-secondary mt-5" onClick={() => location.reload()}>Check connection again</button></div><DeviceCopy online={false} /></main>;
}
