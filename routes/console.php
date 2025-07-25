<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule timezone-aware color assignment every 15 minutes
Schedule::command('colors:assign-by-timezone')->everyFifteenMinutes();

// Keep the old daily command as backup (can be removed later)
// Schedule::command('colors:assign-daily')->dailyAt('07:00');
