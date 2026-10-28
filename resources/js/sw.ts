/// <reference lib="webworker" />
import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };

setCacheNameDetails({ prefix: 'mirembe-static', suffix: 'v1' });
clientsClaim();
cleanupOutdatedCaches();

// Personal API traffic always goes to the network, including authenticated GETs.
for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const) {
  registerRoute(({ request, url }) => url.pathname.startsWith('/api/') || request.headers.has('Authorization'), new NetworkOnly(), method);
}
precacheAndRoute(self.__WB_MANIFEST.map(entry => {
  const item = typeof entry === 'string' ? { url: entry, revision: null } : entry;
  return { ...item, url: new URL(item.url, new URL('/build/', self.location.origin)).href };
}));

// Never store Laravel's rendered HTML, session cookies or API results.
registerRoute(({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin && url.pathname === '/', async ({ request }) => {
  try {
    const response = await fetch(request);
    if (response.status < 500) return response;
  } catch { /* The generated shell contains no guest data. */ }
  return await matchPrecache('/build/offline.html') ?? new Response('You are offline. Reconnect to open Mirembe.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
