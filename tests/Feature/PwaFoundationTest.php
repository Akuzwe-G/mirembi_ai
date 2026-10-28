<?php

namespace Tests\Feature;

use Tests\TestCase;

class PwaFoundationTest extends TestCase
{
    public function test_the_shell_links_the_manifest_and_apple_metadata(): void
    {
        $this->withoutVite()->get('/')->assertOk()
            ->assertSee('/build/manifest.webmanifest', false)
            ->assertSee('viewport-fit=cover', false)
            ->assertSee('apple-mobile-web-app-capable', false)
            ->assertSee('/icons/apple-touch-icon.png', false);
    }

    public function test_the_root_service_worker_has_root_scope_and_cannot_be_stored_as_a_stale_script(): void
    {
        if (! is_file(public_path('build/sw.js'))) {
            $this->markTestSkipped('Build the frontend before testing the generated worker.');
        }
        $this->get('/sw.js')->assertOk()
            ->assertHeader('Content-Type', 'application/javascript')
            ->assertHeader('Service-Worker-Allowed', '/')
            ->assertHeader('Cache-Control', 'must-revalidate, no-cache, no-store, public');
    }

    public function test_production_http_pages_redirect_and_http_api_requests_are_rejected(): void
    {
        $this->app->instance('env', 'production');

        $this->get('http://localhost/')->assertStatus(308)->assertRedirect('https://localhost');
        $this->postJson('http://localhost/api/journeys')->assertStatus(426)
            ->assertJsonPath('error', 'HTTPS is required.');
    }

    public function test_production_https_pages_advertise_hsts(): void
    {
        $this->app->instance('env', 'production');
        $this->withoutVite()->get('https://localhost/')->assertOk()
            ->assertHeader('Strict-Transport-Security', 'max-age=31536000');
    }

    public function test_built_manifest_and_icons_support_standalone_installation(): void
    {
        if (! is_file(public_path('build/manifest.webmanifest'))) {
            $this->markTestSkipped('Build the frontend before testing generated PWA assets.');
        }
        $manifest = json_decode(file_get_contents(public_path('build/manifest.webmanifest')), true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame('Mirembe AI', $manifest['name']);
        $this->assertSame('standalone', $manifest['display']);
        $this->assertSame('/', $manifest['start_url']);
        $this->assertSame('/', $manifest['scope']);
        $this->assertSame('#40335B', $manifest['theme_color']);
        foreach ([192, 512] as $size) {
            foreach (['icon', 'maskable'] as $kind) {
                $dimensions = getimagesize(public_path('icons/'.$kind.'-'.$size.'.png'));
                $this->assertSame($size, $dimensions[0]);
                $this->assertSame($size, $dimensions[1]);
            }
        }
        $this->assertSame(180, getimagesize(public_path('icons/apple-touch-icon.png'))[0]);
    }
}
