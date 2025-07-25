<?php

namespace App\Console\Commands;

use App\Models\Suburb;
use App\Models\ColorPalette;
use Carbon\Carbon;
use Illuminate\Console\Command;

class AssignColorsByTimezone extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'colors:assign-by-timezone';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Assign colors to suburbs when it\'s 7 AM in their local timezone';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Checking suburbs for 7 AM local time...');
        
        // Get all unique timezones
        $timezones = Suburb::distinct('timezone')->pluck('timezone');
        
        if ($timezones->isEmpty()) {
            $this->info('No suburbs found.');
            return;
        }
        
        $totalProcessed = 0;
        
        foreach ($timezones as $timezone) {
            $processed = $this->processTimezone($timezone);
            $totalProcessed += $processed;
        }
        
        if ($totalProcessed === 0) {
            $this->info('No suburbs are currently at their 7 AM assignment time.');
        } else {
            $this->info("Processed {$totalProcessed} suburbs across " . $timezones->count() . " timezones.");
        }
    }
    
    private function processTimezone(string $timezone): int
    {
        try {
            $now = now();
            $localTime = $now->copy()->setTimezone($timezone);
            
            // Check if it's 7:00-7:30 AM in this timezone
            if ($localTime->hour !== 7 || $localTime->minute >= 30) {
                return 0; // Not assignment time for this timezone
            }
            
            $suburbs = Suburb::where('timezone', $timezone)->get();
            
            if ($suburbs->isEmpty()) {
                return 0;
            }
            
            $this->line("Processing {$suburbs->count()} suburbs in {$timezone} (local time: {$localTime->format('H:i')})");
            
            $processedCount = 0;
            
            foreach ($suburbs as $suburb) {
                if ($this->assignColorToSuburb($suburb, $localTime)) {
                    $processedCount++;
                }
            }
            
            return $processedCount;
            
        } catch (\Exception $e) {
            $this->error("Error processing timezone {$timezone}: " . $e->getMessage());
            return 0;
        }
    }
    
    private function assignColorToSuburb(Suburb $suburb, Carbon $localTime): bool
    {
        try {
            // Use the local date for assignment
            $localDate = $localTime->startOfDay();
            $color = $suburb->assignColorForDate($localDate);
            
            $suburbName = $suburb->name ?: $suburb->hash;
            $this->line("  ✓ {$suburbName}: {$color->color_name} ({$color->color_hex})");
            return true;
            
        } catch (\Exception $e) {
            // Check if it's because no active colors are available
            if (str_contains($e->getMessage(), 'No active colors found')) {
                $this->error('No active colors found in palette. Please seed the color palette.');
                return false;
            }
            
            $suburbName = $suburb->name ?: $suburb->hash;
            $this->error("  ✗ Failed to assign color to {$suburbName}: " . $e->getMessage());
            return false;
        }
    }
}
