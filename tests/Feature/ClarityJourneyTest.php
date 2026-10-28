<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ClarityJourneyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    private function analysis(): array
    {
        return ['reflection' => 'Let us choose one task.', 'clarification_question' => null,
            'concerns' => [['title' => 'Coursework', 'category' => 'education', 'urgency' => 'high', 'deadline' => null]],
            'next_action' => 'List the first step.', 'avatar_state' => 'speaking'];
    }

    private function envelope(string $text): array
    {
        return ['status' => 'completed', 'output' => [
            ['type' => 'reasoning', 'summary' => []],
            ['type' => 'message', 'role' => 'assistant', 'status' => 'completed', 'content' => [
                ['type' => 'output_text', 'text' => substr($text, 0, 12)],
                ['type' => 'output_text', 'text' => substr($text, 12)],
            ]],
        ]];
    }

    private function metaMode(): void
    {
        config(['mirembe.mode' => 'meta', 'mirembe.meta_api_key' => 'mock-test-key',
            'mirembe.meta_url' => 'https://api.meta.ai/v1/responses']);
    }

    public function test_meta_analysis_is_parsed_validated_and_saved_with_history(): void
    {
        $this->metaMode();
        Http::fake(['api.meta.ai/*' => Http::response($this->envelope(json_encode($this->analysis())))]);
        $created = $this->postJson('/api/journeys')->assertCreated()->json();
        $url = '/api/journeys/'.$created['journey_id'];
        $auth = ['Authorization' => 'Bearer '.$created['access_token']];

        $this->postJson($url.'/messages', ['message' => 'Help me choose a task.'], $auth)
            ->assertOk()->assertJsonPath('phase', 'clarity_map')->assertJson(['analysis' => $this->analysis()]);
        $this->postJson($url.'/messages', ['message' => 'What comes next?'], $auth)->assertOk();

        $this->assertDatabaseCount('journey_messages', 4);
        $this->assertDatabaseCount('journey_concerns', 1);
        $this->assertDatabaseHas('journey_messages', ['journey_id' => $created['journey_id'], 'role' => 'assistant', 'content' => 'Let us choose one task.']);
        Http::assertSent(fn (Request $request) => $request['text']['format']['type'] === 'json_schema'
         && $request['text']['format']['strict'] === true
         && $request['text']['format']['schema']['additionalProperties'] === false
         && str_contains($request['instructions'], 'You are Mirembe')
         && str_contains($request['instructions'], 'Never diagnose')
         && str_contains($request['input'], 'assistant: Let us choose one task.')
         && $request['store'] === false);
    }

    public function test_meta_can_return_no_concerns(): void
    {
        $this->metaMode();
        $analysis = $this->analysis();
        $analysis['concerns'] = [];
        $analysis['clarification_question'] = 'What would you like to discuss?';
        Http::fake(['api.meta.ai/*' => Http::response($this->envelope(json_encode($analysis)))]);
        $created = $this->postJson('/api/journeys')->json();
        $this->postJson('/api/journeys/'.$created['journey_id'].'/messages', ['message' => 'Hello'],
            ['Authorization' => 'Bearer '.$created['access_token']])
            ->assertOk()->assertJsonPath('phase', 'clarify')->assertJsonCount(0, 'analysis.concerns');
        $this->assertDatabaseCount('journey_messages', 2);
        $this->assertDatabaseCount('journey_concerns', 0);
    }

    public static function failures(): array
    {
        return array_map(fn ($case) => [$case], ['prose', 'invalid_schema', 'missing_nullable', 'unknown_field', 'invalid_urgency', 'too_long', 'incomplete', 'refusal', 'empty', 'bad_envelope', 'http_400', 'http_401', 'http_429', 'http_500', 'timeout']);
    }

    #[DataProvider('failures')]
    public function test_meta_failures_return_503_without_changing_the_journey_or_logging_content(string $case): void
    {
        $this->metaMode();
        $analysis = $this->analysis();
        if ($case === 'invalid_schema') {
            $analysis['avatar_state'] = 'happy';
        }
        if ($case === 'missing_nullable') {
            unset($analysis['next_action']);
        }
        if ($case === 'unknown_field') {
            $analysis['private'] = 'sensitive marker';
        }
        if ($case === 'invalid_urgency') {
            $analysis['concerns'][0]['urgency'] = 'urgent';
        }
        if ($case === 'too_long') {
            $analysis['reflection'] = str_repeat('x', 1001);
        }
        $body = $this->envelope($case === 'prose' ? 'sensitive marker' : json_encode($analysis));
        if ($case === 'incomplete') {
            $body['status'] = 'incomplete';
        }
        if ($case === 'refusal') {
            $body['output'][1]['content'] = [['type' => 'refusal', 'refusal' => 'sensitive marker']];
        }
        if ($case === 'empty') {
            $body['output'] = [];
        }
        if ($case === 'bad_envelope') {
            $body['output'] = 'sensitive marker';
        }
        $status = str_starts_with($case, 'http_') ? (int) substr($case, 5) : 200;
        Http::fake(['api.meta.ai/*' => $case === 'timeout' ? Http::failedConnection('sensitive marker') : Http::response($body, $status)]);
        Log::spy();
        $created = $this->postJson('/api/journeys')->json();

        $this->postJson('/api/journeys/'.$created['journey_id'].'/messages', ['message' => 'sensitive marker'],
            ['Authorization' => 'Bearer '.$created['access_token']])
            ->assertStatus(503)->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('error', 'Mirembe could not analyse this message. Your journey is unchanged; please retry.');

        $this->assertDatabaseCount('journey_messages', 0);
        $this->assertDatabaseCount('journey_concerns', 0);
        $this->assertDatabaseHas('journeys', ['id' => $created['journey_id'], 'phase' => 'express']);
        Log::shouldHaveReceived('warning')->once()->with('Clarity analysis failed.', \Mockery::on(fn ($context) => array_keys($context) === ['exception_type']));
        Log::shouldNotHaveReceived('error');
        if ($case === 'invalid_schema') {
            Log::shouldHaveReceived('notice')->once()->with('Clarity response validation failed.', [
                'failed_rules' => ['avatar_state' => ['In']],
            ]);
        }
    }

    public function test_another_guest_cannot_send_messages_to_a_journey(): void
    {
        $first = $this->postJson('/api/journeys')->json();
        $second = $this->postJson('/api/journeys')->json();
        $this->postJson('/api/journeys/'.$first['journey_id'].'/messages', ['message' => 'Hello'],
            ['Authorization' => 'Bearer '.$second['access_token']])->assertForbidden();
        Http::assertNothingSent();
        $this->assertDatabaseCount('journey_messages', 0);
    }

    public function test_a_guest_can_create_analyse_and_delete_a_journey(): void
    {
        config(['mirembe.mode' => 'demo']);
        $created = $this->postJson('/api/journeys')->assertCreated()->json();
        $url = '/api/journeys/'.$created['journey_id'];
        $auth = ['Authorization' => 'Bearer '.$created['access_token']];
        $this->postJson($url.'/messages', ['message' => 'University and work both feel overwhelming'], $auth)
            ->assertOk()->assertJsonPath('analysis.demo_mode', true);
        $this->getJson($url, $auth)->assertOk()->assertJsonCount(2, 'concerns');
        $this->deleteJson($url, [], $auth)->assertNoContent();
    }

    public function test_guest_tokens_are_required(): void
    {
        $created = $this->postJson('/api/journeys')->assertCreated()->json();
        $this->getJson('/api/journeys/'.$created['journey_id'])->assertForbidden();
    }

    public function test_invalid_messages_are_rejected(): void
    {
        $created = $this->postJson('/api/journeys')->assertCreated()->json();
        $this->postJson('/api/journeys/'.$created['journey_id'].'/messages',
            ['message' => ''], ['Authorization' => 'Bearer '.$created['access_token']])->assertUnprocessable();
    }
}
