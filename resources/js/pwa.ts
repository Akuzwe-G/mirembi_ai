import { useEffect, useState } from 'react';

interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let waitingWorker: ServiceWorker | null = null;
let reloadForUpdate = false;
let registration: ServiceWorkerRegistration | undefined;
let pendingInstallPrompt: InstallPrompt | null = null;
let offlineShellUnavailable = false;

export function registerPwa(): void {
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadForUpdate) location.reload(); });
  void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(result => {
    registration = result;
    const announce = () => {
      if (result.waiting && navigator.serviceWorker.controller) {
        waitingWorker = result.waiting; window.dispatchEvent(new Event('mirembe:update-ready'));
      }
    };
    announce();
    result.addEventListener('updatefound', () => {
      const installing = result.installing;
      installing?.addEventListener('statechange', () => {
        announce();
        if (installing.state === 'redundant' && !result.active) window.dispatchEvent(new Event('mirembe:offline-unavailable'));
      });
    });
  }).catch(() => window.dispatchEvent(new Event('mirembe:offline-unavailable')));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && navigator.onLine) void registration?.update().catch(() => {}); });
}
export function applyPwaUpdate(): void {
  if (waitingWorker) { reloadForUpdate = true; waitingWorker.postMessage({ type: 'SKIP_WAITING' }); }
}
export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener('online', change); window.addEventListener('offline', change);
    return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); };
  }, []);
  return online;
}
export function useInstallation() {
  const standalone = () => !!window.matchMedia?.('(display-mode: standalone)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
  const [installed, setInstalled] = useState(standalone);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(pendingInstallPrompt);
  const [updateReady, setUpdateReady] = useState(!!waitingWorker);
  const [offlineUnavailable, setOfflineUnavailable] = useState(offlineShellUnavailable);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); pendingInstallPrompt = event as InstallPrompt; setPrompt(pendingInstallPrompt); };
    const consumed = () => setPrompt(null);
    const installedEvent = () => { pendingInstallPrompt = null; setInstalled(true); setPrompt(null); };
    const ready = () => setUpdateReady(true);
    const failed = () => { offlineShellUnavailable = true; setOfflineUnavailable(true); };
    const mode = window.matchMedia?.('(display-mode: standalone)');
    const modeChanged = () => setInstalled(standalone());
    window.addEventListener('beforeinstallprompt', capture); window.addEventListener('appinstalled', installedEvent);
    window.addEventListener('mirembe:install-consumed', consumed);
    window.addEventListener('mirembe:update-ready', ready); window.addEventListener('mirembe:offline-unavailable', failed);
    mode?.addEventListener('change', modeChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installedEvent);
      window.removeEventListener('mirembe:install-consumed', consumed);
      window.removeEventListener('mirembe:update-ready', ready); window.removeEventListener('mirembe:offline-unavailable', failed);
      mode?.removeEventListener('change', modeChanged);
    };
  }, []);
  const install = async () => {
    if (!prompt) return;
    try { await prompt.prompt(); await prompt.userChoice; } finally { pendingInstallPrompt = null; setPrompt(null); window.dispatchEvent(new Event('mirembe:install-consumed')); }
  };
  return { installed, ios, canPrompt: !!prompt, install, updateReady, offlineUnavailable };
}
