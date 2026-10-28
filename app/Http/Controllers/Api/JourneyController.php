<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Journey;
use App\Services\ClarityEngine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class JourneyController extends Controller
{
    private function owned(Request $request, Journey $journey): void
    {
        $token = $request->bearerToken();
        abort_unless(is_string($token) && strlen($token) >= 32 && hash_equals($journey->access_token_hash, hash('sha256', $token)), 403);
    }

    public function create()
    {
        $token = bin2hex(random_bytes(32));
        $j = Journey::create(['access_token_hash' => hash('sha256', $token), 'phase' => 'express']);

        return response()->json(['journey_id' => $j->id, 'access_token' => $token, 'phase' => $j->phase], 201)->header('Cache-Control', 'no-store');
    }

    public function show(Request $request, Journey $journey)
    {
        $this->owned($request, $journey);

        return response()->json(['journey' => $journey->only(['id', 'phase']),
            'concerns' => $journey->concerns()->get(), 'actions' => $journey->actions()->get(),
            'messages' => $journey->messages()->orderBy('id')->get(['id', 'role', 'content'])
                ->map(fn ($message) => ['id' => $message->id, 'role' => $message->role, 'content' => $message->content]),
        ])->header('Cache-Control', 'no-store');
    }

    public function message(Request $request, Journey $journey, ClarityEngine $engine)
    {
        $this->owned($request, $journey);
        $data = $request->validate(['message' => 'required|string|min:1|max:3000']);
        $history = $journey->messages()->orderByDesc('id')->limit(8)->get(['role', 'content'])
            ->reverse()->values()->map(fn ($message) => [
                'role' => $message->role,
                'content' => $message->content,
            ])->all();
        try {
            $result = $engine->analyse($data['message'], $history);
        } catch (Throwable $e) {
            Log::warning('Clarity analysis failed.', ['exception_type' => get_class($e)]);

            return response()->json(['error' => 'Mirembe could not analyse this message. Your journey is unchanged; please retry.'], 503)->header('Cache-Control', 'no-store');
        }
        DB::transaction(function () use ($journey, $data, $result) {
            $journey->messages()->create(['role' => 'user', 'content' => $data['message']]);
            $journey->messages()->create(['role' => 'assistant', 'content' => $result['reflection']]);
            foreach ($result['concerns'] as $c) {
                $journey->concerns()->firstOrCreate(['title' => $c['title']], [
                    'category' => $c['category'], 'urgency' => $c['urgency'], 'deadline' => $c['deadline'] ?? null,
                ]);
            }
            $journey->update(['phase' => empty($result['clarification_question']) ? 'clarity_map' : 'clarify']);
        });

        return response()->json(['phase' => $journey->phase, 'analysis' => $result,
            'concerns' => $journey->concerns()->get()])->header('Cache-Control', 'no-store');
    }

    public function confirm(Request $request, Journey $journey)
    {
        $this->owned($request, $journey);
        $data = $request->validate(['concern_ids' => 'required|array|min:1', 'concern_ids.*' => 'integer|distinct']);
        $count = $journey->concerns()->whereIn('id', $data['concern_ids'])->count();
        abort_unless($count === count($data['concern_ids']), 422, 'Invalid concern IDs');
        $journey->concerns()->whereIn('id', $data['concern_ids'])->update(['confirmed' => true]);
        $journey->update(['phase' => 'focus']);

        return response()->json(['phase' => 'focus', 'concerns' => $journey->concerns()->get()]);
    }

    public function updateConcern(Request $request, Journey $journey, int $concern)
    {
        $this->owned($request, $journey);
        $c = $journey->concerns()->findOrFail($concern);
        $data = $request->validate(['title' => 'sometimes|required|string|max:180', 'deadline' => 'nullable|string|max:100',
            'category' => 'sometimes|required|string|max:40',
            'urgency' => 'sometimes|in:high,medium,low,unknown,ongoing', 'confirmed' => 'sometimes|boolean']);
        $c->update($data);

        return response()->json($c);
    }

    public function action(Request $request, Journey $journey)
    {
        $this->owned($request, $journey);
        $data = $request->validate(['title' => 'required|string|max:300', 'concern_id' => 'nullable|integer']);
        if (isset($data['concern_id'])) {
            abort_unless($journey->concerns()->whereKey($data['concern_id'])->exists(), 422);
        }

        return response()->json($journey->actions()->create($data), 201);
    }

    public function completeAction(Request $request, Journey $journey, int $action)
    {
        $this->owned($request, $journey);
        $a = $journey->actions()->findOrFail($action);
        $data = $request->validate(['status' => 'required|in:pending,completed,partly_done,not_started']);
        $a->update($data);

        return response()->json($a);
    }

    public function delete(Request $request, Journey $journey)
    {
        $this->owned($request, $journey);
        $journey->delete();

        return response()->noContent();
    }
}
