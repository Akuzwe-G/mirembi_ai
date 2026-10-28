# Sprint 2: mandatory cross-platform PWA acceptance

PWA support is part of the Sprint 2 MVP. It is not deferred to another sprint. Automated evidence below does not replace the physical-device or production deployment gates.

## Implementation

- React, TypeScript, Tailwind 4 and Laravel Vite remain the application foundation. `vite-plugin-pwa` builds a custom Workbox worker using `injectManifest`.
- `/build/manifest.webmanifest` declares Mirembe AI, short name Mirembe, start URL `/`, scope `/`, standalone display, plum theme and cream background. Generated PNGs include ordinary and maskable 192/512 icons plus an opaque 180px Apple touch icon. Icons use the abstract sprout brand mark, not a final character design.
- `/sw.js` is served by Laravel with root scope and no-cache headers. The precache contains only generated static shell HTML, versioned JS/CSS, self-hosted fonts, icons and the manifest. Rendered Laravel HTML, session cookies, guest tokens and API responses are never precached.
- All API and Authorization-bearing requests are network-only. There is no background sync, offline message queue, automatic POST retry, or claim that AI works offline.
- A new worker waits for user consent. Updating is disabled while a draft or operation is active. Activation removes obsolete precache assets. Startup and returning to the app check for updates.
- Android installation uses `beforeinstallprompt` when the browser supplies it. iPhone/iPad instructions describe Safari → Share → Add to Home Screen. Standalone detection hides installation guidance. Browser eligibility, user settings and installation UI remain browser-controlled.
- Safe-area padding covers all four edges; the viewport uses `viewport-fit=cover`. Dialogs respect the available dynamic viewport height. Portrait and landscape layouts are checked automatically.

## Private offline data

Nothing personal is saved to durable offline storage automatically. While online, the user can explicitly choose **Save encrypted offline copy** and provide a passphrase of at least 12 characters.

One snapshot is stored in IndexedDB using AES-256-GCM, a fresh IV and salt, and PBKDF2-SHA-256 with 250,000 iterations. The save timestamp is authenticated with the ciphertext. Only selected message, concern and action fields are included. Guest bearer tokens, model credentials, encryption keys and passphrases are not stored in the vault. The last save time is visible metadata.

Offline access requires the passphrase. The view is read-only, labelled with its save time, and does not synchronise changes. It locks when the app is hidden or after ten minutes. Copies expire after seven days and are removed on the next access; unopened browser storage cannot be reliably scheduled for deletion at an exact time. Users can delete the device copy without unlocking it. This leaves the online journey intact.

Successful online journey deletion also attempts to delete this browser's saved copy. A local deletion failure is reported with a retry control. Other browsers or installed-app storage containers must be cleared separately. Browser storage can be evicted, so offline copies are not backups.

Existing guest access remains in tab-scoped session storage. Installation may create a separate browser storage container, particularly on iOS. The app does not promise that an existing Safari tab's guest session or saved copy transfers into the installed app. Start a new guest journey inside the installed app if necessary. Offline snapshots are not a mechanism for recovering expired/lost online access.

## Voice compatibility

Text is always the baseline. Optional dictation requires a secure context, a microphone API, an available SpeechRecognition/webkitSpeechRecognition constructor, and connectivity. No microphone is accessed merely by opening the page or its voice options.

The user sees the browser speech-service privacy explanation and must choose **Start dictation**. Browser permission denial, unsupported APIs and recognition errors leave text input working. Transcripts populate the editable composer; they are never sent automatically. Some browsers process audio using their own remote service. This feature makes no offline recognition or uniform Android/iOS support guarantee.

## Production HTTPS gate

The application redirects production HTTP page requests to HTTPS, rejects production HTTP API requests with 426, and returns HSTS on secure production responses. Tests exercise these behaviours.

Deployment acceptance still requires a valid TLS certificate and HTTP-to-HTTPS redirection at the web server/load balancer, including static `/build` and `/icons` paths. Set the deployed application URL to HTTPS. At a TLS-terminating proxy, trust only the known proxy addresses and forward the correct scheme; never trust arbitrary public forwarded headers. Keep the service-worker route reachable with JavaScript MIME type and root scope. No deployed domain/certificate was supplied for live verification.

Deploy assets and the new worker atomically. Keep old hashed asset files briefly while active clients transition. Do not apply private API caching rules at the CDN or reverse proxy. Browser service workers operate only in production builds; Vite hot reload does not install a worker.

## Automated acceptance evidence

Run from the application root:

```powershell
npm.cmd ci
npm.cmd run build
php artisan test
npm.cmd test
npx.cmd playwright install chromium webkit
npm.cmd run test:browser
npm.cmd run test:pwa
```

The browser servers use a dedicated port, demo mode and an in-memory database configuration. PWA tests use synthetic journeys; no billable Meta calls or production database writes are made.

| Check | Evidence |
| --- | --- |
| Manifest, icons, Apple metadata and production HTTPS rules | Laravel PWA feature tests |
| Encryption, explicit opt-in, credential exclusion, wrong passphrase and expiry | Vitest vault tests |
| Install event, Safari guidance, standalone suppression and update deferral | Component tests |
| Unsupported speech and permission-denial fallback | Voice component tests |
| Android Chrome behaviour | Pixel 7 Chromium emulation; not physical Android certification |
| iOS Safari behaviour | iPhone 13 WebKit emulation; not physical Safari certification |
| Offline shell, encrypted save/unlock/delete and network-only API failure | Both browser engines |
| Prompted update and obsolete precache invalidation | Both browser engines |
| Orientation and no horizontal overflow | Both browser engines; existing 320–1440px layout tests |
| WCAG automated accessibility | axe in Chromium and WebKit |
| Lighthouse accessibility | 100/100; report in `storage/app/pwa-lighthouse-accessibility.json` |

Lighthouse 12 and later removed the PWA category. There is no current Lighthouse PWA score to claim; direct installability, service-worker and offline tests supply that evidence. Lighthouse is Chromium-only, so its duplicate WebKit test is intentionally skipped.

Verified automated results on 2026-10-28: 32 Laravel tests (246 assertions), 25 component tests, five existing browser tests, and 11 PWA checks passed. One duplicate Lighthouse-on-WebKit check is intentionally skipped. Lighthouse accessibility scored 100/100 and axe reported no violations in the checked welcome/standalone views in either engine. These are automated checks of the covered views, not a claim of complete accessibility certification.

The runtime dependency audit reported no vulnerabilities. The development-only Workbox build chain reported four low-severity advisories through `deepmerge`; the offered automatic remedy was an incompatible downgrade of the PWA plugin, so it was not applied. Revisit the build-tool audit when compatible upstream fixes are available.

## Required physical-device acceptance before MVP release

These remain mandatory, not future enhancements:

- [ ] On a physical Android device, open the HTTPS deployment in Chrome. Install when eligible; launch from the home screen and verify standalone display, icon, theme and portrait/landscape layout.
- [ ] On a physical iPhone, open the HTTPS deployment in Safari. Follow Share → Add to Home Screen, launch the app, and verify safe areas around the notch, status bar, keyboard and home indicator.
- [ ] On both devices, save an encrypted synthetic journey. Enable airplane mode, terminate/relaunch the app, unlock the saved copy, and verify that AI sending, edits and confirmations cannot happen offline. Delete the local copy and verify its absence after relaunch.
- [ ] Verify permission denied, permission revoked, unsupported speech and interrupted dictation paths. Text entry must remain usable. Do not use personal audio or live billable Meta requests for certification.
- [ ] Deploy a changed asset/worker version. Check that an active draft is protected, an update requires consent, the new shell loads and obsolete cache entries disappear.
- [ ] Verify reconnect, browser storage eviction, installed-app storage isolation and guest access continuity within the supported app session.
- [ ] Verify the real production TLS certificate, edge redirects and API no-store policy. Complete keyboard and assistive-technology review beyond automated checks.

## References

- [Vite PWA Laravel integration](https://vite-pwa-org.netlify.app/frameworks/laravel.html)
- [Vite PWA custom worker and update handling](https://vite-pwa-org.netlify.app/guide/inject-manifest)
- [Apple: add a website as an iPhone web app](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)
- [MDN: SpeechRecognition availability and remote processing](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [Google: Lighthouse 12 removed the PWA category](https://developers.google.com/speed/docs/insights/release_notes)
