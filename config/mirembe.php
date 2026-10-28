<?php
return [
    'mode' => env('MIREMBE_AI_MODE', 'demo'), // demo or meta
    'meta_api_key' => env('MODEL_API_KEY'),
    'meta_model' => env('META_MODEL', 'muse-spark-1.3'),
    'meta_url' => env('META_API_URL', 'https://api.meta.ai/v1/responses'),
];
