import { useState } from 'react';
import { Download, RefreshCw, Share } from 'lucide-react';
import { applyPwaUpdate, useInstallation } from '../pwa';

export function PwaControls({ busy }: { busy: boolean }) {
  const pwa = useInstallation();
  const [guide, setGuide] = useState(false);
  return <div className="mx-auto max-w-7xl px-5 sm:px-10 lg:px-16">
    {!pwa.installed && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 text-xs text-muted"><span>A little space on your home screen.</span>{pwa.canPrompt ? <button className="text-button flex items-center gap-2" onClick={() => void pwa.install()}><Download size={14} />Install Mirembe</button> : <button className="text-button flex items-center gap-2" aria-expanded={guide} onClick={() => setGuide(!guide)}><Share size={14} />{pwa.ios ? 'Install on iPhone or iPad' : 'How to install'}</button>}
      {guide && <p className="w-full rounded-xl bg-lavender/10 p-4 text-sm leading-7">{pwa.ios ? 'Open Mirembe in Safari. Tap Share, then Add to Home Screen. If shown, keep “Open as Web App” enabled and tap Add.' : 'In a supported browser, choose Install Mirembe or Add to Home Screen from its menu. On iPhone or iPad, open Safari and use Share → Add to Home Screen.'} Installation availability depends on your browser. Guest access may not transfer to the installed app; save an encrypted offline copy here or start a new journey there.</p>}
    </div>}
    {pwa.updateReady && <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-sage/20 p-4 text-sm"><p>A fresh version of Mirembe is ready.{busy && ' Finish your message or operation before updating.'}</p><button className="text-button flex items-center gap-2" disabled={busy} onClick={applyPwaUpdate}><RefreshCw size={14} />Update and reload</button></div>}
    {pwa.offlineUnavailable && <p role="status" className="py-3 text-xs text-muted">The offline shell could not be installed. Stay online and refresh to try again.</p>}
    {window.isSecureContext === false && <p role="status" className="py-3 text-xs text-muted">Installation and offline support need HTTPS, or localhost during development.</p>}
  </div>;
}
