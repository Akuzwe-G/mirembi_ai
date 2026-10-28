# Mirembe Clarity Engine — Laravel 13 starter overlay

Mirembe is a Laravel application with a React, TypeScript and Tailwind CSS frontend, bundled through Vite. The existing Laravel guest journey API remains the backend.

## Launch the current application

From `C:\laragon\www\mirembe-ai`, run:

```powershell
npm.cmd ci
npm.cmd run build
php artisan serve
```

Open the address printed by Artisan. No new migration is needed for Sprint 2. For frontend hot reload, run `npm.cmd run dev` in a second terminal while Artisan is running.

To launch a credit-free demo without editing `.env`, use this in the server terminal instead of the final command above:

```powershell
$env:MIREMBE_AI_MODE = 'demo'
php artisan serve
```

This process environment override requires configuration not to be cached. If you previously cached configuration, run `php artisan config:clear` first. Demo output is clearly labelled as a fixed example in the interface. Normal launch uses the existing configured mode; sending messages in Meta mode uses API credits.

## Frontend behaviour and privacy

- Begin as a guest, send follow-up messages and review the reflection and clarification question.
- Concern cards are labelled as needing review until the user confirms them. Edits return them to review. Title, category, priority and deadline can be corrected.
- A suggested grounding step is optional. It is saved as an action only after selecting “Make this my next step”. Chosen actions can be marked complete or reopened.
- The guest token and latest structured response are stored in `sessionStorage`, scoped to the current tab. They survive refresh and are never added to URLs, logs or analytics. Conversation history, concerns and chosen actions restore from the authenticated API. Tokens are script-accessible in this storage; keep the app on a trusted origin and use HTTPS outside local development.
- Closing a tab can lose guest access; it does not delete server records. Use “Clear journey” to explicitly delete the journey and its data before leaving. Failed deletion keeps access so the user can retry.
- The server currently persists message text, not historical structured response metadata. The latest clarification and grounding suggestion restore from the tab cache; older reflections restore from the database.
- Voice is a placeholder and does not access the microphone. The abstract avatar placeholder has idle, listening, thinking, speaking and encouraging states based on interaction events, with reduced-motion support. A final 3D design, animation asset, voice capture/transcription and speech playback remain future work.

## Verify without Meta credits

```powershell
php artisan test
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:browser
```

Laravel tests use an in-memory SQLite database and mocked Meta responses. Component tests mock the journey API. Browser tests launch a temporary Laravel server on port 8017, intercept every API request, block external requests, and use synthetic fixtures. They cover 320, 390, 768 and 1440 pixel layouts, refresh, editing, confirmation, deletion, keyboard navigation and reduced motion. They do not write to the application database or call Meta. The test server stops after the browser suite finishes.

The root web route still serves the Laravel Blade shell. No API routes were added: `GET /api/journeys/{journey}` now also returns authenticated message history, and the existing concern PATCH accepts a category correction.

## Setup on Windows / Laragon
1. In your Laragon terminal: `composer create-project laravel/laravel mirembe-ai`
2. `cd mirembe-ai`
3. Run `php artisan install:api` if `routes/api.php` does not exist. This enables Laravel API routing.
4. Copy the directories `app`, `config`, `database`, `routes`, `tests` from this ZIP **into** `mirembe-ai`, merging files. Do not replace unrelated existing files.
5. Copy the lines from `.env.example.additions` into `.env`.
6. Create a MySQL database named `mirembe_ai`. Configure `.env`:
   ```
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=mirembe_ai
   DB_USERNAME=root
   DB_PASSWORD=
   ```
   Alternatively use the app's existing SQLite configuration for quick testing.
7. Run `php artisan migrate` then `php artisan test --filter=ClarityJourneyTest`.
8. Run `php artisan serve`.

## Test without any AI key (demo mode)
**PowerShell:**
```powershell
$created = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/journeys' -Method POST
$headers = @{ Authorization = "Bearer $($created.access_token)" }
$body = @{ message = 'I have university assignments and a work deadline.' } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/journeys/$($created.journey_id)/messages" -Method POST -Headers $headers -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 8
```
You should receive an analysis with two sample concerns and `demo_mode: true`. Demo mode is deliberately **static**, not a real model output.

## Connect Meta AI
In `.env`:
```
MIREMBE_AI_MODE=meta
MODEL_API_KEY=your_actual_api_key
```
Run `php artisan config:clear`. Never commit your `.env` or API key.

## Routes
`POST /api/journeys` creates a guest journey and returns a secret access token. Provide `Authorization: Bearer <access_token>` for all other routes. `POST /api/journeys/{id}/messages` analyses and saves concerns. `GET /api/journeys/{id}` loads concerns and actions. `POST .../confirm` confirms selected concerns. `PATCH .../concerns/{concern}` edits. `POST .../actions` and `PATCH .../actions/{action}` manage actions. `DELETE /api/journeys/{id}` deletes all associated data.

## Scope and limitations
- Text frontend is implemented; voice, a final 3D avatar and PWA remain future work.
- Meta Responses requests use `instructions` and strict `text.format` JSON Schema output, followed by server validation before persistence.
- Demo responses are fixed examples and must not be represented as real inference.
- Production hardening still includes data retention expiry, encryption-at-rest for message content, a privacy policy, comprehensive safety escalation and moderating tools, and deployment-specific origin/security controls.
- This scaffold does not claim live API testing because no Meta API key was supplied.
- The model must not override user-confirmed changes: this first version adds newly extracted concerns but does not automatically overwrite persisted concerns.

## Official references
- https://dev.meta.ai/docs/protocols/responses
- https://laravel.com/docs/13.x/routing
