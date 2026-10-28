# Sprint 3: voice and response speed

The existing Laravel guest journey API now powers an optional hands-free conversation. No API route, credential or database migration is required.

## Experience

Select **Start talking** after reading the disclosure. Permission and audio activation happen only after this interaction. Mirembe welcomes you, listens, displays interim/final transcripts, sends final speech after a configurable pause, and speaks the validated reflection and clarification question. The optional grounding suggestion is not spoken as an agreed plan. The microphone stops before sending and stays off during playback.

The reusable controller exposes idle, requesting_permission, listening, processing, thinking, speaking, paused and error states. Avatar state follows this lifecycle rather than the model's avatar field. Controls include pause/resume, microphone mute, stop speech, end conversation, switch to typing, spoken replies, speech rate and pause duration. Repeated native events cannot submit the same turn twice. Failed requests require an explicit retry; they are not automatically resent.

Hidden pages, navigation, connection loss, permission revocation and component cleanup stop recognition and playback. Returning to the foreground requires a tap to resume. Stopping during an HTTP request prevents its late response from restarting audio; the already-sent request can still finish and persist normally. Partial transcripts remain available for typed review when recognition cannot finalise safely.

## Browser support and privacy

Recognition requires HTTPS (or localhost), a native SpeechRecognition/webkitSpeechRecognition implementation and microphone access. Browser recognition may send audio to the browser vendor's service; the UI discloses this before activation. Mirembe does not record or persist raw audio. Browser SpeechSynthesis uses an actually available English voice, preferring local voices. There is no fixed voice name or guaranteed voice quality across devices. Missing playback leaves readable replies.

No backend transcription provider is configured. Unsupported recognition, permission denial or blocked restart retains the fully functional text journey. No audio is uploaded to an invented fallback endpoint. A future transcription provider needs an explicit backend implementation, privacy/retention decisions and service credentials; a future server TTS adapter can implement the existing SpeechOutput interface. Browser support detection cannot guarantee recognition works reliably on a particular OS. Voice and live AI require connectivity; existing explicit encrypted offline copies remain read-only.

## Latency and validated output

The Meta request uses documented `reasoning: { effort: "low" }` by default. Configuration also accepts `medium`, never `none`. Defaults are 3072 maximum output tokens and six history messages. Supported process/config variables are `META_REASONING_EFFORT`, `META_MAX_OUTPUT_TOKENS` (1024–8192), `MIREMBE_HISTORY_MESSAGES` (0–8), and `MIREMBE_LOG_TIMINGS` (false by default). No secrets were changed. Output tokens include reasoning, so an aggressively small budget can cause incomplete responses.

Strict JSON Schema, personality instructions, complete-output validation and validation before database persistence remain mandatory. Partial streaming is intentionally not surfaced or spoken: transport streaming would not make partial JSON trustworthy. API failures and invalid/incomplete output keep the existing safe error path.

Message responses expose numeric `Server-Timing` durations: Meta HTTP call, validation, engine, backend excluding Meta time, and total application time. These are server durations, not microphone-to-audio latency or network timings. Optional timing logs contain only numeric timings and status, never conversation text, tokens or journey identifiers.

The automated demo sample in `storage/app/sprint3-demo-latency.json` measured total 12.590 ms, engine 0.015 ms and Meta 0 ms using in-memory SQLite. It is not live Meta performance evidence. Real low-versus-medium latency and response-quality comparisons remain unmeasured: they require approved billable requests with the same fictional prompts, repeated samples and validation/quality review. No speed or quality improvement is claimed from this demo measurement.

## Launch and verification

```powershell
npm.cmd run build
$env:MIREMBE_AI_MODE = 'demo'
php artisan serve --host=127.0.0.1 --port=8000
```

If configuration was previously cached, clear it with `php artisan config:clear` before using the process override. Open http://127.0.0.1:8000. Demo mode is credit-free and clearly labelled. Normal Meta mode consumes credits when a message is submitted. For hot reload use `npm.cmd run dev` in another terminal.

Mobile testing requires a trusted HTTPS origin reachable by the device, serving the built Laravel app with a valid certificate. Raw LAN HTTP does not satisfy microphone/PWA security requirements. Follow the existing Sprint 2 HTTPS deployment and installation guidance; Android install and Safari Share → Add to Home Screen remain available. No additional paid service is needed for native browser voice.

```powershell
php artisan test
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
npm.cmd run test:pwa
npm.cmd run test:voice
```

Backend and frontend tests mock Meta/API responses. Voice unit tests cover interim/final transcripts, silence, duplicate prevention, permission failure, blocked restart, late callbacks, cancellation and pending-request cleanup. Browser voice tests mock OS speech APIs in Android Chromium and iPhone WebKit emulation. Physical Android Chrome and iOS Safari microphone permission, audio routing, recognition restart, interruption, backgrounding and installed-PWA behaviour remain release checks. Emulation does not certify these device behaviours.

## Changed source groups

Verification on 2026-10-28: production build and TypeScript passed; 40 Laravel tests passed (285 assertions); 41 frontend tests passed; five journey browser tests passed; four voice browser tests passed across Chromium/WebKit; 11 PWA checks passed with one intentionally skipped duplicate WebKit Lighthouse check. PHP formatting passed. The PWA suite includes accessibility, offline API isolation, encrypted-copy deletion and service-worker update coverage. A 320px header overflow found during verification was fixed and the full journey browser suite rerun successfully.

- `resources/js/voice/`: contracts, native browser adapters, observable controller and lifecycle hook.
- `VoiceConversationPanel`, `Welcome`, `Conversation`, `App`, `useJourney` and application CSS: voice controls, consent, state-driven avatar and shared authenticated message path.
- `ClarityEngine`, `JourneyController`, `MeasureClarityRequest`, bootstrap and Mirembe config: bounded context, supported reasoning settings and privacy-safe timings.
- Voice frontend/browser tests, latency feature tests, Playwright voice configuration and package script; this document and README.

References: [Meta Responses protocol](https://dev.meta.ai/docs/protocols/responses), [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [MDN SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis).
