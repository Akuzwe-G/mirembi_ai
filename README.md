# Mirembe Clarity Engine — Laravel 13 starter overlay

This ZIP contains **implementation files for a fresh Laravel 13 app**, not the Laravel framework itself. Start with a clean Laravel project (do not copy into Higa or Barihafi).

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
- Text-only initial implementation; voice, avatar, frontend and PWA are next.
- The Meta API request uses Responses API basic `model` and `input`; output JSON is requested through the prompt and **validated**. This is NOT a strict JSON-Schema API request yet.
- Demo responses are fixed examples and must not be represented as real inference.
- A strict production implementation must add: stronger CSRF/origin protection for the eventual SPA, data retention expiry, encryption-at-rest for message content, privacy policy, comprehensive safety escalation and moderating tools, async queues, robust retry handling, and a schema-constrained Meta API call.
- This scaffold does not claim live API testing because no Meta API key was supplied.
- The model must not override user-confirmed changes: this first version adds newly extracted concerns but does not automatically overwrite persisted concerns.

## Official references
- https://dev.meta.ai/docs/protocols/responses
- https://laravel.com/docs/13.x/routing
