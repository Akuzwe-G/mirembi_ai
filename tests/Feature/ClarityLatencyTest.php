<?php

namespace Tests\Feature;

use App\Models\Journey;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ClarityLatencyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['mirembe.mode' => 'meta', 'mirembe.meta_api_key' => 'mock-test-key']);
    }

    private function envelope(): array
    {
        return ['status' => 'completed', 'output' => [['type' => 'message', 'role' => 'assistant', 'content' => [['type' => 'output_text', 'text' => json_encode([
            'response_language' => 'en', 'reflection' => 'We can explore this one step at a time.', 'clarification_question' => 'What comes first?',
            'concerns' => [], 'next_action' => null, 'avatar_state' => 'speaking',
        ])]]]]];
    }

    public static function efforts(): array
    {
        return [['low', 3072], ['medium', 4096]];
    }

    #[DataProvider('efforts')]
    public function test_documented_latency_settings_preserve_validated_responses(string $effort, int $tokens): void
    {
        config(['mirembe.reasoning_effort' => $effort, 'mirembe.max_output_tokens' => $tokens]);
        Http::fake(['api.meta.ai/v1/responses' => Http::response($this->envelope())]);
        $guest = $this->postJson('/api/journeys')->json();
        $response = $this->postJson('/api/journeys/'.$guest['journey_id'].'/messages', ['message' => 'A fictional deadline is Friday.'], ['Authorization' => 'Bearer '.$guest['access_token']]);

        $response->assertOk()->assertJsonPath('analysis.reflection', 'We can explore this one step at a time.');
        Http::assertSent(fn (Request $request) => $request['reasoning']['effort'] === $effort
            && $request['max_output_tokens'] === $tokens && $request['text']['format']['strict'] === true
            && $request['store'] === false && str_contains($request['instructions'], 'You are Mirembe'));
        $header = $response->headers->get('Server-Timing');
        foreach (['meta', 'validation', 'engine', 'backend', 'total'] as $name) {
            $this->assertMatchesRegularExpression('/'.$name.';dur=\d+\.\d{3}/', $header);
        }
        $this->assertStringNotContainsString('fictional', $header);
        $this->assertDatabaseCount('journey_messages', 2);
    }

    public static function invalidSettings(): array
    {
        return [['none', 3072], ['low', 10], ['medium', 90000], ['low', 'bad']];
    }

    #[DataProvider('invalidSettings')]
    public function test_invalid_effort_or_budget_never_makes_a_provider_call(string $effort, int|string $tokens): void
    {
        config(['mirembe.reasoning_effort' => $effort, 'mirembe.max_output_tokens' => $tokens]);
        $guest = $this->postJson('/api/journeys')->json();
        $this->postJson('/api/journeys/'.$guest['journey_id'].'/messages', ['message' => 'A fictional thought.'], ['Authorization' => 'Bearer '.$guest['access_token']])->assertStatus(503);
        Http::assertNothingSent();
        $this->assertDatabaseCount('journey_messages', 0);
    }

    public function test_history_is_bounded_and_timing_logs_contain_only_approved_metrics(): void
    {
        config(['mirembe.history_messages' => 2, 'mirembe.log_timings' => true]);
        Http::fake(['api.meta.ai/v1/responses' => Http::response($this->envelope())]);
        Log::spy();
        $guest = $this->postJson('/api/journeys')->json();
        $journey = Journey::findOrFail($guest['journey_id']);
        foreach (['oldest private text', 'older private text', 'recent user', 'recent assistant'] as $index => $content) {
            $journey->messages()->create(['role' => $index % 2 ? 'assistant' : 'user', 'content' => $content]);
        }
        $this->postJson('/api/journeys/'.$guest['journey_id'].'/messages', ['message' => 'Current fictional text.'], ['Authorization' => 'Bearer '.$guest['access_token']])->assertOk();
        Http::assertSent(fn (Request $request) => str_contains($request['input'], 'recent user')
            && str_contains($request['input'], 'recent assistant') && ! str_contains($request['input'], 'oldest private text')
            && ! str_contains($request['input'], 'older private text'));
        Log::shouldHaveReceived('info')->once()->with('Clarity request timing.', \Mockery::on(fn ($metrics) => array_keys($metrics) === ['meta_ms', 'validation_ms', 'engine_ms', 'backend_ms', 'total_ms', 'status']
            && count(array_filter($metrics, 'is_numeric')) === 6));
    }

    public function test_demo_mode_emits_a_non_billable_pipeline_measurement(): void
    {
        config(['mirembe.mode' => 'demo']);
        $guest = $this->postJson('/api/journeys')->json();
        $response = $this->postJson('/api/journeys/'.$guest['journey_id'].'/messages', ['message' => 'Fictional study and work tasks.'], ['Authorization' => 'Bearer '.$guest['access_token']]);
        $response->assertOk()->assertJsonPath('analysis.demo_mode', true);
        $this->assertStringContainsString('meta;dur=0.000', $response->headers->get('Server-Timing'));
        file_put_contents(storage_path('app/sprint3-demo-latency.json'), json_encode([
            'source' => 'Automated demo test, in-memory SQLite; not live Meta latency.',
            'server_timing' => $response->headers->get('Server-Timing'),
        ], JSON_PRETTY_PRINT));
        Http::assertNothingSent();
    }
}
