<?php
use App\Http\Controllers\Api\JourneyController;
use Illuminate\Support\Facades\Route;
Route::middleware('throttle:30,1')->group(function(){
 Route::post('/journeys',[JourneyController::class,'create']);
 Route::get('/journeys/{journey}',[JourneyController::class,'show']);
 Route::post('/journeys/{journey}/messages',[JourneyController::class,'message']);
 Route::post('/journeys/{journey}/confirm',[JourneyController::class,'confirm']);
 Route::patch('/journeys/{journey}/concerns/{concern}',[JourneyController::class,'updateConcern']);
 Route::post('/journeys/{journey}/actions',[JourneyController::class,'action']);
 Route::patch('/journeys/{journey}/actions/{action}',[JourneyController::class,'completeAction']);
 Route::delete('/journeys/{journey}',[JourneyController::class,'delete']);
});
