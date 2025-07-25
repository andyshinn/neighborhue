<?php

use App\Http\Controllers\Api\SuburbApiController;
use Illuminate\Support\Facades\Route;

Route::prefix('suburb/{hash}')->group(function () {
    Route::get('/color', [SuburbApiController::class, 'getTodaysColor']);
});