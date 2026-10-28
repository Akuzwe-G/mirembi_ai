<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class ClarityEngine
{
    private array $timings = [];

    public function timings(): array
    {
        return $this->timings;
    }

    public function analyse(string $message, array $recentMessages = [], string $language = 'en-US'): array
    {
        $started = hrtime(true);
        $this->timings = ['meta' => 0.0, 'validation' => 0.0];
        try {
            return $this->requestAnalysis($message, $recentMessages, $language);
        } finally {
            $this->timings['engine'] = (hrtime(true) - $started) / 1e6;
        }
    }

    private function requestAnalysis(string $message, array $recentMessages, string $language): array
    {
        if (config('mirembe.mode') === 'demo') {
            return $this->demo($message);
        }
        $key = config('mirembe.meta_api_key');
        if (! $key) {
            throw new RuntimeException('MODEL_API_KEY is missing.');
        }
        $effort = config('mirembe.reasoning_effort');
        $tokens = filter_var(config('mirembe.max_output_tokens'), FILTER_VALIDATE_INT);
        if (! in_array($effort, ['low', 'medium'], true) || $tokens === false || $tokens < 1024 || $tokens > 8192) {
            throw new RuntimeException('Invalid Clarity response settings.');
        }
        $system = <<<'PROMPT'
You are Mirembe, a warm, practical AI clarity companion, not a therapist.
Help the user distinguish competing responsibilities without inventing facts.
Return ONLY JSON, exactly with keys: reflection (string), clarification_question (string or null),
concerns (array of objects with title, category, urgency, deadline), next_action (string or null), avatar_state (string).
Allowed urgency: high, medium, low, unknown, ongoing. Category is a brief lowercase word.
Allowed avatar_state: speaking, listening, thinking, neutral. Use an empty concerns array when no concerns are identified.
Deadline must be explicit in the user's words or null. Keep reflection to 1-3 short, conversational sentences.
Ask no more than one clarifying question; propose only a small achievable next action.
Never diagnose or claim to be human. For imminent personal danger, prioritise real-world emergency support.
PROMPT;
        $languageName = match ($language) {
            'fr-FR' => 'French',
            'rw-RW' => 'Kinyarwanda',
            default => 'English',
        };
        $system .= "\nThe user-selected preferred language is {$languageName} ({$language}); this is not automatically detected speech metadata."
            .' Respond in the language of the current user utterance; use the preferred language when the utterance is ambiguous.'
            .' Preserve the original language and natural code-switching. Do not unnecessarily translate to English.'
            .' Apply this to reflection, clarification_question, concern titles and next_action. Keep JSON keys and urgency/avatar enums unchanged.';
        $limit = max(0, min(8, (int) config('mirembe.history_messages')));
        $history = $limit === 0 ? [] : array_slice($recentMessages, -$limit);
        $context = collect($history)->map(fn ($m) => $m['role'].': '.$m['content'])->implode("\n");
        $metaStarted = hrtime(true);
        try {
            $response = Http::withToken($key)
                ->acceptJson()
                ->connectTimeout(10)
                ->timeout(60)
                ->post(config('mirembe.meta_url'), [
                    'model' => config('mirembe.meta_model'),

                    'instructions' => $system,

                    'input' => "Previous conversation:\n"
                        .$context
                        ."\n\nCurrent user message:\n"
                        .$message,

                    'reasoning' => ['effort' => $effort],
                    'max_output_tokens' => $tokens,
                    'store' => false,
                    'text' => ['format' => [
                        'type' => 'json_schema',
                        'name' => 'clarity_analysis',
                        'strict' => true,
                        'schema' => $this->schema(),
                    ]],
                ]);
        } finally {
            $this->timings['meta'] = (hrtime(true) - $metaStarted) / 1e6;
        }

        if (! $response->successful()) {
            throw new RuntimeException('Meta API request failed (HTTP '.$response->status().').');
        }
        if ($response->json('status') !== 'completed' || $response->json('error') !== null) {
            throw new RuntimeException('Meta response was not completed.');
        }
        $blocks = $response->json('output', []);
        if (! is_array($blocks)) {
            throw new RuntimeException('Meta response envelope was invalid.');
        }
        $text = '';
        foreach ($blocks as $block) {
            if (! is_array($block) || ($block['type'] ?? '') !== 'message') {
                continue;
            }
            if (($block['role'] ?? 'assistant') !== 'assistant' || ($block['phase'] ?? null) === 'commentary') {
                continue;
            }
            if (($block['status'] ?? 'completed') !== 'completed' || ! is_array($block['content'] ?? null)) {
                throw new RuntimeException('Meta response envelope was invalid.');
            }
            foreach ($block['content'] as $part) {
                if (! is_array($part) || ($part['type'] ?? '') !== 'output_text' || ! is_string($part['text'] ?? null)) {
                    throw new RuntimeException('Meta response contained no usable text.');
                }
                $text .= $part['text'];
            }
        }
        $parsed = json_decode(trim($text), true);
        if (! is_array($parsed)) {
            throw new RuntimeException('Meta returned non-JSON output. Please retry.');
        }

        $validationStarted = hrtime(true);
        try {
            return $this->validateResult($parsed);
        } finally {
            $this->timings['validation'] = (hrtime(true) - $validationStarted) / 1e6;
        }
    }

    private function schema(): array
    {
        $string = fn (int $max, bool $nullable = false) => array_merge(
            ['type' => $nullable ? ['string', 'null'] : 'string', 'maxLength' => $max],
            $nullable ? [] : ['minLength' => 1, 'pattern' => '\\S'],
        );
        $concern = [
            'title' => $string(180), 'category' => $string(40),
            'urgency' => ['type' => 'string', 'enum' => ['high', 'medium', 'low', 'unknown', 'ongoing']],
            'deadline' => $string(100, true),
        ];
        $properties = [
            'reflection' => $string(1000), 'clarification_question' => $string(500, true),
            'concerns' => ['type' => 'array', 'maxItems' => 10, 'items' => [
                'type' => 'object', 'properties' => $concern, 'required' => array_keys($concern), 'additionalProperties' => false,
            ]],
            'next_action' => $string(300, true),
            'avatar_state' => ['type' => 'string', 'enum' => ['speaking', 'listening', 'thinking', 'neutral']],
        ];

        return ['type' => 'object', 'properties' => $properties, 'required' => array_keys($properties), 'additionalProperties' => false];
    }

    private function validateResult(array $data): array
    {
        if (array_diff(array_keys($data), array_keys($this->schema()['properties']))) {
            throw new RuntimeException('AI response contained unexpected fields.');
        }
        $v = Validator::make($data, [
            'reflection' => 'required|string|max:1000',
            'clarification_question' => 'present|nullable|string|max:500',
            'concerns' => 'present|array|list|max:10',
            'concerns.*' => 'required|array:title,category,urgency,deadline',
            'concerns.*.title' => 'required|string|max:180',
            'concerns.*.category' => 'required|string|max:40',
            'concerns.*.urgency' => 'required|in:high,medium,low,unknown,ongoing',
            'concerns.*.deadline' => 'present|nullable|string|max:100',
            'next_action' => 'present|nullable|string|max:300',
            'avatar_state' => 'required|in:speaking,listening,thinking,neutral',
        ]);
        if ($v->fails()) {
            $allowedFields = [
                'reflection', 'clarification_question', 'concerns', 'concerns.*',
                'concerns.*.title', 'concerns.*.category', 'concerns.*.urgency',
                'concerns.*.deadline', 'next_action', 'avatar_state',
            ];
            $failedRules = [];
            foreach ($v->failed() as $field => $rules) {
                $field = preg_replace('/\.\d+(?=\.|$)/', '.*', $field);
                if (in_array($field, $allowedFields, true)) {
                    $failedRules[$field] = array_keys($rules);
                }
            }
            Log::notice('Clarity response validation failed.', ['failed_rules' => $failedRules]);
            throw new RuntimeException('AI response failed validation. Please retry.');
        }

        return $v->validated();
    }

    private function demo(string $message): array
    {
        return [
            'reflection' => 'You have several things competing for your attention. We can organise them one at a time.',
            'clarification_question' => 'Which responsibility has the earliest deadline?',
            'concerns' => [
                ['title' => 'Study responsibilities', 'category' => 'education', 'urgency' => 'unknown', 'deadline' => null],
                ['title' => 'Work responsibilities', 'category' => 'work', 'urgency' => 'unknown', 'deadline' => null],
            ],
            'next_action' => 'Write down the nearest deadline and what it requires.',
            'avatar_state' => 'speaking',
            'demo_mode' => true,
        ];
    }
}
