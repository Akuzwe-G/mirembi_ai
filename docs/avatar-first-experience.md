# Avatar-first voice PWA

## What opens now

The application opens directly to one central abstract avatar placeholder, a short greeting, visible microphone status and bottom voice controls. There is no compulsory onboarding, check-in, account or planning screen. Select **Enable microphone** once to start the existing hands-free loop. The microphone stays off during speech playback. Pause, mute, stop, panel opening, backgrounding and connection loss stop voice resources. Resuming requires a tap after an interruption.

**Type instead** opens the conversation panel and creates a guest journey without calling Meta. **My Journey** opens the secondary Clarity Map. Users can edit/confirm concerns and choose optional actions there without being forced into a plan. Settings and the menu contain installation, encrypted offline-copy and privacy/deletion controls. Sign in and Register are clearly identified placeholders that collect no credentials; secure account authentication has not been invented.

Only the language and preferred input mode are remembered in localStorage. No microphone grant, transcript, raw audio or token is stored there. Guest access retains the existing tab-scoped sessionStorage strategy. A remembered voice preference never starts capture or audio on page load. Selecting typing emphasises that choice on subsequent visits while keeping the avatar home.

## Actual language capabilities

| Language | Text / Clarity Engine | Native recognition | Speech playback |
| --- | --- | --- | --- |
| English | Original text preserved; default preference | Selected en-US locale, where browser service works | Actual available English voice or browser English default |
| French | Original text preserved; fr-FR preference sent to Meta | Selected fr-FR locale, device/service dependent | Matching available French voice; otherwise captions |
| Kinyarwanda | Original text preserved; rw-RW preference sent to Meta | Requested rw-RW locale, **unverified**; typing may be required | Only an actual matching voice; otherwise captions |

The API accepts allowlisted `language` and `language_source: "user_selected"` metadata; old clients can omit it. This is not detected-language metadata. Meta receives these preferences through `instructions` and is instructed to respond in the current utterance's language, preserve code-switching and leave JSON keys/enums unchanged. Strict JSON Schema and validation before persistence remain intact. Text and transcript strings are never unnecessarily translated in application code.

Browser recognition does not reliably identify arbitrary spoken languages automatically. The user must select/correct the language in Settings. Code-switching transcription depends on the browser service; no reliable multilingual transcription is claimed. A `MultilingualTranscriptionProvider` interface defines a future explicit provider boundary with language capabilities, optional detected locale/confidence, cancellation and an audio result contract. No provider is configured, no raw audio upload endpoint was added and no paid service is silently selected. A configured and tested multilingual speech-to-text provider is required for reliable automatic language identification and Kinyarwanda speech support. A server TTS provider would be needed where installed matching voices are unavailable; the existing SpeechOutput interface is replaceable.

French/Kinyarwanda automated tests use fictional text and mocked model responses to verify transport, instructions, rendering and persistence. They do not establish live Meta language quality or native acoustic recognition accuracy. Physical Android Chrome, iOS Safari and installed iOS PWA testing remain required. Native support is detected per browser rather than assumed from an OS or browser name. Permission denial, unsupported languages, blocked restarts and missing voices retain typing/captions.

References: [recognition language selection](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/lang) and [available synthesis voices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices).

## Latency

The existing default low reasoning effort, bounded history and configurable response budget remain unchanged. No extra model requests are used for language selection. Structured JSON is still fully validated before it is persisted, displayed or spoken.

Settings → Response timings shows numeric, in-memory metrics for the latest turn:

- Endpointing time since the last transcript event, including the configurable silence pause.
- Observed finalisation delay when a final result follows a native speech-end event. It is **not** audio-to-text latency: browser recognition exposes no reliable audio timestamps.
- Laravel round trip including network and client JSON processing.
- Meta HTTP duration, structured-output validation and backend excluding Meta time, from the existing Server-Timing header.
- Time from requesting speech playback to the actual utterance start event.

Timings contain no text or credentials and are not stored by the frontend. Real Meta latency and low-versus-medium response quality were not measured: live billable requests require approval. Automated/demo timings are synthetic and cannot substantiate a production speed claim. Immediate transcribing/thinking/speaking feedback improves visibility while waiting without exposing partial unvalidated JSON.

## Local and mobile testing

For the existing real Meta integration:

```powershell
npm.cmd run build
$env:MIREMBE_AI_MODE = 'meta'
php artisan config:clear
php artisan serve --host=127.0.0.1 --port=8000
```

Open the local address printed by Artisan. Selecting Enable microphone requests permission and activates audio; submitting a final utterance or typed message in Meta mode uses API credits. Tests use mocks only. For a credit-free manual demo, set the process override to `demo` before starting Artisan. No .env secret needs to be edited.

Mobile microphone/PWA testing requires the Laravel app on a trusted HTTPS origin reachable by the device, such as the existing Cloud staging environment. Raw LAN HTTP is not sufficient. On Android Chrome install from the menu when available; on iOS open Safari → Share → Add to Home Screen. No native-browser voice credentials are needed. In each installed app test permission denial, English and French turns, Kinyarwanda fallback, switching to typing, speech interruption, app background/foreground, permission changes, offline recovery, orientation and virtual keyboard behaviour. These physical-device tests were not performed by browser emulation.

The home uses dynamic viewport height, safe-area padding, responsive avatar scaling, compact short-screen layouts and a visualViewport listener. Secondary panels scroll independently and adapt their available height when the virtual keyboard changes the viewport. Automated viewport checks include 320×568, 375×667, 390×844, 412×915, 844×390, tablet and desktop; they assert the microphone lies within the viewport and there is no horizontal overflow. A real iOS keyboard still requires device verification.

## Files and verification

- `App.tsx` now enters `VoiceApp.tsx`; `AvatarHome.tsx` and `Panel.tsx` provide the main screen and accessible native dialog panels.
- `Conversation.tsx` is secondary and no longer renders a duplicate avatar/microphone.
- `app.css` adds the viewport, safe-area, short-screen and landscape layouts.
- `voice/languages.ts`, contracts, browser adapters, controller and hook add selected locales, matching voices, provider boundary and per-turn timing observations.
- `api.ts`, `types.ts` and `useJourney.ts` carry selected language and numeric timing metadata through the existing authenticated request path.
- `JourneyController.php` validates language metadata; `ClarityEngine.php` adds language instructions without changing the response schema.
- `pwa.ts` and `PwaControls.tsx` retain Android install events while menu controls are unmounted and keep update notices available on the home screen.
- Feature, component, voice and browser tests cover the redesigned entry, languages, guest flow, responsive controls and unchanged PWA privacy boundaries.

Run `php artisan test`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:browser`, `npm.cmd run test:voice` and `npm.cmd run test:pwa`. All Meta calls and speech services in automated tests are mocked. No destructive migration or credential edit is needed.

Verification completed on 2026-10-28: 44 Laravel tests passed (306 assertions); 51 frontend tests passed; eight journey/viewport browser tests and four mobile-emulation voice browser tests passed; 11 PWA checks passed with one intentional duplicate WebKit Lighthouse skip. TypeScript, production build and PHP formatting passed. Chromium Lighthouse accessibility scored 100 and axe found no covered accessibility violations in either browser engine. The automated demo timing sample was 9.584 ms total/backend, 0.012 ms engine and 0 ms Meta/validation (demo bypass); it is in-memory test evidence, not live AI latency.

## Deploy this update to Laravel Cloud

No Cloud deployment was executed. This workspace has no Git metadata; put the changed source files into the repository connected to the existing Cloud environment before releasing.

1. Run the verification commands above and review the source changes. Keep `.env`, guest data, recordings and test artifacts out of the commit.
2. Confirm the target Cloud application, environment and branch. Review staged environment/resource changes. Preserve the existing database, Meta credentials and production HTTPS settings.
3. Ensure the existing build command installs PHP production dependencies and JS build dependencies and runs the production build, for example `composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader` followed by `npm ci --include=dev` and `npm run build`. Run any existing Laravel optimisation in the build stage. Vite, TypeScript and the PWA plugin are build-time devDependencies and must be installed for the asset build.
4. This change has no migration. Keep the reviewed existing deploy settings; do not add reset/fresh/seed commands. Push the reviewed commit to the configured environment branch when push-to-deploy is enabled, or trigger that commit from the environment's Deploy control.
5. Monitor build, deploy and health-check logs. On the HTTPS environment verify the avatar home, `/sw.js`, manifest, one approved real conversation, language preference, guest restoration and deletion. Install on physical Android and iOS devices and repeat lifecycle/keyboard checks.
6. An existing installed app offers Update and reload after the new worker is ready. Finish any active voice session or draft before updating. Verify the new shell works offline and API responses remain network-only.

Cloud's build/deploy and staged environment behaviour is documented in [Laravel Cloud deployments](https://laravel.com/cloud/docs/deployments). No new Cloud resources, services or credentials are needed for this interface update.
