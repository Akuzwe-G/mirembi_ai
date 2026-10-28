# Multilingual understanding and response modes

## Diagnosis

The inspected code exposed three separate gaps:

- Native recognition used one selected locale, English by default. It never detected arbitrary spoken languages, and no server transcription provider was configured. A model cannot reliably recover the original words from an incorrect transcript. Selecting French can request French recognition, but does not certify that the device's browser service supports it. Kinyarwanda acoustic recognition remains unverified.
- Typed messages called the journey send function directly and bypassed the voice playback controller. The UI had no independent Text / Voice / Both preference.
- The structured model response did not return its language. Playback followed the input preference rather than a validated response-language code, and missing voices did not produce a useful playback notice.

These are code-level findings. No private production transcripts were inspected, and no live billable reproduction was performed; the exact recognition quality of the user's device still needs a consented diagnostic run. There is no evidence here that Meta's language understanding caused the original acoustic failure.

## Independent input and output

Voice input and typed input now share response playback while retaining their independent lifecycles. The default is voice input with **Both** output. The compact response selector is on the avatar home and next to the typed composer:

| Mode | Behaviour for either input method |
| --- | --- |
| Text | Show the validated reflection/question; do not automatically speak |
| Voice | Speak the reply; accessible written captions remain available on request |
| Both | Display and speak the same reflection/question |

Switching to typing keeps the chosen response mode. Device preferences remember mode, language and input preference, never credentials or transcripts. Refresh never starts audio or capture. The playback controller is invoked by message events, not a React rendering effect, so rerenders cannot replay a response. A new submission cancels the previous playback. Explicit replay never resends a model request.

Stop speaking is available during playback. Browser-blocked playback exposes one **Enable audio** action. Missing language voices retain a written reply and explain the limitation. Spoken replies never automatically resume microphone capture after a typed message. Backgrounding, offline events, stopping and cleanup invalidate callbacks and stop resources; microphone permission changes affect active voice input rather than unrelated typed playback.

Replaying while a voice session is paused leaves the microphone paused. A replay requested while already listening temporarily stops capture and resumes that existing listening session only after playback completes. PWA updates are disabled during typed speech as well as active voice sessions and pending drafts.

## Language selection and structured output

The language selector supports Auto-detect, English, French, Kinyarwanda and Hindi. It is built from a language registry so adding options does not require rewriting controls; the backend allowlist/schema must also be updated for any new supported code.

Auto-detect identifies **typed text through Meta in the existing message request**, with no additional detection API call. The model returns a required `response_language` of `en`, `fr`, `rw` or `hi`. Auto-detect considers the current message, supports language switching, preserves meaning/code-switching where possible, and falls back to English for ambiguous or unsupported text. This is model-based text identification, not acoustic language detection or a confidence guarantee. Users can correct it with an explicit language selection.

An explicit selection overrides automatic identification, including English when selected. Instructions require human-readable reflections, questions, concern titles/categories and actions to use the response language, while JSON names and enum values remain compatible with Laravel. User text is explicitly untrusted and cannot override system-level safety/security instructions. Strict schema validation runs before persistence; missing/unsupported language codes and a code that contradicts an explicit selection return the existing safe 503 path without saving messages or concerns.

Old API clients can omit the new request metadata. Current clients send `language`, `language_source: "user_selected"` and `input_method: "typing" | "voice"`. `language` can be an allowlisted locale or `auto`; Auto is a requested policy, never falsely labelled as detected speech metadata. Existing tab cache/history may predate response-language metadata; restoration does not play that history automatically. Demo mode remains a clearly labelled, fixed English example with `response_language: "en"`.

## Verified capabilities and limits

| Language | Typed understanding/response | Browser recognition | Device speech output |
| --- | --- | --- | --- |
| English | Model instructions and validated en contract tested with mocks | en-US selected; actual service/device dependent | Available English voice or browser English locale default |
| French | fr contract, original text and voice routing tested with mocks | fr-FR selected; actual accuracy not verified | Matching installed French voice; otherwise written fallback |
| Kinyarwanda | rw contract and original text tested with mocks; live model quality unverified | rw-RW requested; reliable acoustic support **not established** | Matching installed Kinyarwanda voice only; never silently pronounced using English |
| Hindi | hi contract and original text tested with mocks; live model quality unverified | hi-IN selected; actual service/device dependent | Matching installed Hindi voice; otherwise written fallback |
| Auto-detect | Same-call model text identification; user can override | Browser adapter cannot identify languages automatically and asks for a specific choice before capture | Uses the validated response code, not the recognition preference |

Automated tests establish request/validation/persistence/rendering/playback contracts, not linguistic quality or microphone accuracy. No end-to-end multilingual acoustic pipeline is claimed verified on physical devices. Native SpeechRecognition exposes no reliable supported-language inventory here; its selected locale is a request, not a capability guarantee. Browser restrictions or unsupported languages retain typing. The transcription abstraction reports its browser provider and lack of acoustic identification; the future multilingual provider interface advertises language support, detection metadata and cancellation. No recorder upload or paid provider was invented.

Playback uses actual voices from SpeechSynthesis.getVoices and chooses a matching response language. A missing non-English voice is not replaced by an English voice. The replaceable SpeechOutput service remains the boundary for a future multilingual cloud TTS provider. Reliable automatic multilingual voice recognition, especially Kinyarwanda, requires a separately configured and tested transcription service. A cloud TTS provider is optional where suitable device voices are missing. No new service credentials are required for the implemented native-browser features.

References: [SpeechRecognition language selection](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/lang), [available device voices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices).

## Development diagnostics and manual verification

Run Laravel normally and `npm.cmd run dev` locally. Settings contains **Language diagnostics · development only** showing requested locale, in-memory transcript, acoustic detection availability, validated AI response language, selected synthesis voice language and missing capabilities. Vite's development flag gates this view; it is absent from the production bundle regardless of APP_DEBUG. Do not enable production debug logging for this purpose. No diagnostic transcript is logged, stored or sent to analytics.

For a real manual turn, retain the configured Meta mode; submitting it uses credits. No live requests were made during implementation. Test on a trusted HTTPS mobile origin or localhost. First compare the displayed transcript with what was spoken. If it is already wrong, correct the recognition language or use typing; inspect Meta response language only after a correct transcript reaches Laravel. Then check the actual synthesis voice language. Test French/Hindi explicitly, Kinyarwanda fallback, changing languages within one journey, Text/Voice/Both for typing and voice, denial, interrupted audio, backgrounding and refresh without autoplay. Physical Android Chrome, iOS Safari and installed iOS PWA checks remain required.

## Modified files

- `app/Services/ClarityEngine.php`: language instructions, required response code, strict code validation and explicit-selection consistency.
- `app/Http/Controllers/Api/JourneyController.php`: allowlisted Auto/Hindi/input metadata, preserving guest authentication and transactional persistence.
- `resources/js/voice/{languages,contracts,browser-speech,VoiceConversation,useVoiceConversation}.ts`: registry/preferences, provider capabilities, shared typed/voice delivery, replay/blocked/unavailable states and lifecycle cleanup.
- `resources/js/{VoiceApp,api,types,useJourney}`: independent preferences, shared authenticated request path, response metadata and settings diagnostics.
- `resources/js/components/{ResponseControls,PlaybackControls,LanguageDiagnostics,AvatarHome,Conversation}.tsx`: inline selectors, captions, playback controls and development-only pipeline view.
- `resources/css/app.css`: 44px radio targets, visible keyboard focus and narrow/landscape layout adjustments.
- Backend language/schema/latency fixtures, frontend mode/language/controller tests and mobile browser assertions; README and this handoff.

## Laravel Cloud update

No deployment was performed. Use the existing connected repository and environment; no new resource, migration, API key or database reset is needed.

1. Run `php artisan test`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:browser`, `npm.cmd run test:voice` and `npm.cmd run test:pwa`. Browser suites share port 8017 and must run sequentially.
2. Commit the reviewed source and lockfiles to the branch connected to the intended Cloud staging/production environment. Exclude .env, personal data and test artifacts.
3. Preserve existing Cloud credentials, database attachments and HTTPS configuration. Ensure the build installs JS build dependencies (`npm ci --include=dev`) and executes `npm run build`, alongside the existing production Composer install/optimisation. Release PHP and the new frontend together because the strict response schema now requires response_language.
4. Push to the configured branch when push-to-deploy is enabled, or use that environment's Deploy control. Review staged changes and monitor build/deploy/health-check logs. Do not add destructive migrations or seed/reset commands.
5. Open the HTTPS deployment, finish any existing draft/audio session, then accept the PWA Update and reload prompt. Verify the three response options, language choices, guest continuity and written fallback. Perform a real Meta turn only when billable testing is approved. Repeat physical-device microphone, keyboard, installed-mode and offline checks.

Cloud update behaviour follows the [Laravel Cloud deployment documentation](https://laravel.com/cloud/docs/deployments). Existing static-shell-only caching remains unchanged; personal API responses are never served from a generic static cache.

## Verification results · 2026-10-29

- Laravel: 52 tests passed, 340 assertions; all Meta calls mocked.
- Frontend: 67 tests passed, including typed Text/Voice/Both, no duplicate playback on rerender, language changes within a guest journey, missing voices, blocked audio, preference restoration and replay without microphone reactivation.
- Browser layouts/journeys: eight checks passed across requested phone sizes, landscape, tablet/desktop and keyboard navigation. Both microphone and response selector bounds fit the viewport without horizontal scrolling.
- Voice browser checks: Chromium and WebKit mobile emulation cover the hands-free turn, typed speech, mode retention, denial and refresh without autoplay. These mock speech and API providers; physical-device acoustic accuracy is not certified.
- PWA: 11 checks passed, one intentional duplicate WebKit Lighthouse skip. Installation guidance, offline API isolation, encrypted-copy deletion, worker updates, production diagnostic exclusion and accessibility pass. Chromium Lighthouse accessibility scored 100.
- Production PWA build, TypeScript and targeted PHP formatting pass. No live Meta calls, new paid providers, credential edits, destructive database commands or Cloud deployment were performed.
