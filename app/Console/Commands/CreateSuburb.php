<?php

namespace App\Console\Commands;

use App\Models\Suburb;
use Illuminate\Console\Command;

class CreateSuburb extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'suburb:create {--name= : Optional name for the suburb} {--timezone=UTC : Timezone for the suburb}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new suburb with a unique hash';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $name = $this->option('name');
        $timezone = $this->option('timezone');
        
        if (!$name) {
            $name = $this->ask('Enter a name for the suburb (optional)');
        }
        
        if (!$timezone || $timezone === 'UTC') {
            $timezone = $this->choice('Select timezone', [
                'UTC',
                'America/New_York',
                'America/Chicago', 
                'America/Denver',
                'America/Los_Angeles',
                'Europe/London',
                'Europe/Paris',
                'Asia/Tokyo',
                'Asia/Shanghai',
                'Australia/Sydney'
            ], 'UTC');
        }

        $suburb = Suburb::create([
            'hash' => Suburb::generateHash(),
            'name' => $name,
            'timezone' => $timezone,
        ]);

        // Assign today's color immediately when creating the suburb
        try {
            $color = $suburb->assignColorForDate(now());
            $this->info("Suburb created successfully with today's color assigned!");
            $this->line("Name: " . ($suburb->name ?: '(unnamed)'));
            $this->line("Hash: {$suburb->hash}");
            $this->line("Today's Color: {$color->color_name} ({$color->color_hex})");
            $this->line("URL: " . url("/suburb/{$suburb->hash}"));
            $this->line("API: " . url("/api/suburb/{$suburb->hash}/color"));
        } catch (\Exception $e) {
            $this->error("Suburb created, but could not assign today's color: " . $e->getMessage());
            $this->line("Name: " . ($suburb->name ?: '(unnamed)'));
            $this->line("Hash: {$suburb->hash}");
            $this->line("URL: " . url("/suburb/{$suburb->hash}"));
            $this->line("API: " . url("/api/suburb/{$suburb->hash}/color"));
        }

        return 0;
    }
}
