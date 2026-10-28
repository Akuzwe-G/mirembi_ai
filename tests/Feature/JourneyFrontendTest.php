<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class JourneyFrontendTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['mirembe.mode' => 'demo']);
        Http::preventStrayRequests();
    }

    public function test_the_frontend_shell_is_served_by_laravel(): void
    {
        $this->withoutVite()->get('/')->assertOk()
            ->assertSee('Mirembe — A little more clarity')
            ->assertSee('id="app"', false);
    }

    public function test_authenticated_guests_can_restore_their_conversation_without_exposing_tokens(): void
    {
        $guest = $this->postJson('/api/journeys')->assertCreated()->json();
        $url = '/api/journeys/'.$guest['journey_id'];
        $auth = ['Authorization' => 'Bearer '.$guest['access_token']];
        $this->postJson($url.'/messages', ['message' => 'Help me organise my studies.'], $auth)->assertOk();

        $this->getJson($url, $auth)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(2, 'messages')
            ->assertJsonPath('messages.0.role', 'user')
            ->assertJsonPath('messages.0.content', 'Help me organise my studies.')
            ->assertJsonPath('messages.1.role', 'assistant')
            ->assertJsonMissingPath('journey.access_token_hash')
            ->assertDontSee($guest['access_token']);
        $this->getJson($url)->assertForbidden()->assertDontSee('Help me organise my studies.');
        $other = $this->postJson('/api/journeys')->json();
        $this->getJson($url, ['Authorization' => 'Bearer '.$other['access_token']])
            ->assertForbidden()->assertDontSee('Help me organise my studies.');
        Http::assertNothingSent();
    }

    public function test_guests_can_correct_and_confirm_concerns_then_choose_and_complete_an_action(): void
    {
        $guest = $this->postJson('/api/journeys')->json();
        $url = '/api/journeys/'.$guest['journey_id'];
        $auth = ['Authorization' => 'Bearer '.$guest['access_token']];
        $result = $this->postJson($url.'/messages', ['message' => 'Studies and work'], $auth)->assertOk()->json();
        $id = $result['concerns'][0]['id'];

        $this->patchJson($url.'/concerns/'.$id, ['title' => 'My assignment', 'category' => 'study',
            'urgency' => 'high', 'deadline' => 'Friday', 'confirmed' => false], $auth)
            ->assertOk()->assertJsonPath('category', 'study')->assertJsonPath('confirmed', false);
        $this->postJson($url.'/confirm', ['concern_ids' => [$id]], $auth)
            ->assertOk()->assertJsonPath('phase', 'focus');
        $this->assertDatabaseHas('journey_concerns', ['id' => $id, 'title' => 'My assignment', 'confirmed' => true]);
        $this->assertDatabaseCount('journey_actions', 0);

        $action = $this->postJson($url.'/actions', ['title' => 'Open my assignment brief'], $auth)
            ->assertCreated()->json();
        $this->patchJson($url.'/actions/'.$action['id'], ['status' => 'completed'], $auth)->assertOk();
        $this->getJson($url, $auth)->assertOk()->assertJsonPath('actions.0.status', 'completed');
        $this->assertDatabaseHas('journey_actions', ['id' => $action['id'], 'status' => 'completed']);
        $this->deleteJson($url, [], $auth)->assertNoContent();
        $this->assertDatabaseCount('journey_messages', 0);
        $this->assertDatabaseCount('journey_concerns', 0);
        $this->assertDatabaseCount('journey_actions', 0);
    }

    public function test_concern_corrections_are_validated_and_scoped_to_the_guest_journey(): void
    {
        $first = $this->postJson('/api/journeys')->json();
        $second = $this->postJson('/api/journeys')->json();
        $firstUrl = '/api/journeys/'.$first['journey_id'];
        $secondUrl = '/api/journeys/'.$second['journey_id'];
        $auth = ['Authorization' => 'Bearer '.$first['access_token']];
        $otherAuth = ['Authorization' => 'Bearer '.$second['access_token']];
        $id = $this->postJson($firstUrl.'/messages', ['message' => 'Study'], $auth)->json('concerns.0.id');

        $this->patchJson($firstUrl.'/concerns/'.$id, ['category' => ''], $auth)
            ->assertUnprocessable()->assertJsonValidationErrors('category');
        $this->patchJson($firstUrl.'/concerns/'.$id, ['category' => str_repeat('a', 41)], $auth)
            ->assertUnprocessable()->assertJsonValidationErrors('category');
        $this->patchJson($secondUrl.'/concerns/'.$id, ['title' => 'Changed'], $otherAuth)->assertNotFound();
        $this->postJson($secondUrl.'/confirm', ['concern_ids' => [$id]], $otherAuth)->assertUnprocessable();
        $this->assertDatabaseMissing('journey_concerns', ['title' => 'Changed']);
    }
}
