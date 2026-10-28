<?php

return [
    'mode' => env('MIREMBE_AI_MODE', 'demo'), // demo or meta
    'meta_api_key' => env('MODEL_API_KEY'),
    'meta_model' => env('META_MODEL', 'muse-spark-1.3'),
    'meta_url' => env('META_API_URL', 'https://api.meta.ai/v1/responses'),
    'reasoning_effort' => env('META_REASONING_EFFORT', 'low'),
    'max_output_tokens' => env('META_MAX_OUTPUT_TOKENS', 3072),
    'history_messages' => env('MIREMBE_HISTORY_MESSAGES', 6),
    'log_timings' => env('MIREMBE_LOG_TIMINGS', false),
];
