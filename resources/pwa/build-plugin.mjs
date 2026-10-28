export function offlineShell() {
  return {
    name: 'mirembe-offline-shell',
    apply: 'build',
    generateBundle(_, bundle) {
      const entry = Object.values(bundle).find(item => item.type === 'chunk' && item.isEntry && item.facadeModuleId?.endsWith('/main.tsx'));
      const css = Object.values(bundle).filter(item => item.type === 'asset' && item.fileName.endsWith('.css'));
      if (!entry) throw new Error('The offline shell requires the React entry point.');
      this.emitFile({ type: 'asset', fileName: 'offline.html', source: `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#40335B"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Mirembe"><meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="description" content="Mirembe: from overwhelm to clarity, one step at a time."><title>Mirembe — A little more clarity</title>
<link rel="manifest" href="/build/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><link rel="icon" href="/icons/icon-192.png" type="image/png">
${css.map(asset => `<link rel="stylesheet" href="/build/${asset.fileName}">`).join('\n')}
<script type="module" src="/build/${entry.fileName}"></script></head><body><div id="app"></div><noscript>Please enable JavaScript to use Mirembe.</noscript></body></html>` });
    },
  };
}
