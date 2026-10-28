<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class MeasureClarityRequest
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethod('POST') || ! $request->is('api/journeys/*/messages')) {
            return $next($request);
        }
        $started = hrtime(true);
        $response = $next($request);
        $timings = $request->attributes->get('mirembe.timings', ['meta' => 0.0, 'validation' => 0.0, 'engine' => 0.0]);
        $timings['total'] = (hrtime(true) - $started) / 1e6;
        $timings['backend'] = max(0, $timings['total'] - $timings['meta']);
        $parts = [];
        foreach (['meta', 'validation', 'engine', 'backend', 'total'] as $name) {
            $parts[] = $name.';dur='.number_format($timings[$name], 3, '.', '');
        }
        $response->headers->set('Server-Timing', implode(', ', $parts));
        if (config('mirembe.log_timings')) {
            Log::info('Clarity request timing.', [
                'meta_ms' => round($timings['meta'], 3),
                'validation_ms' => round($timings['validation'], 3),
                'engine_ms' => round($timings['engine'], 3),
                'backend_ms' => round($timings['backend'], 3),
                'total_ms' => round($timings['total'], 3),
                'status' => $response->getStatusCode(),
            ]);
        }

        return $response;
    }
}
