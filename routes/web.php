<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/sw.js', function () {
    $path = public_path('build/sw.js');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'application/javascript',
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
        'Service-Worker-Allowed' => '/',
        'X-Content-Type-Options' => 'nosniff',
    ]);
})->name('pwa.worker');
