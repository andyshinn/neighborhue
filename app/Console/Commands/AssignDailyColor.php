<?php

namespace App\Console\Commands;

use App\Models\Suburb;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class AssignDailyColor extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'colors:assign-daily {--date= : Date to assign color for (YYYY-MM-DD format, defaults to today)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Assign random colors to all suburbs for the specified date';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $date = $this->option('date') ? now()->parse($this->option('date')) : now();
        $dateString = $date->format('Y-m-d');

        // Get all suburbs
        $suburbs = Suburb::all();
        
        if ($suburbs->isEmpty()) {
            $this->warn('No suburbs found. Create some suburbs first.');
            return 0;
        }

        $this->info("Assigning colors for {$dateString} to {$suburbs->count()} suburb(s):");
        $this->line('');

        $assigned = 0;
        $skipped = 0;

        foreach ($suburbs as $suburb) {
            try {
                $color = $suburb->assignColorForDate($date);
                
                // Check if this was a new assignment or existing
                if ($color->wasRecentlyCreated) {
                    $this->line("✓ {$suburb->name}: {$color->color_name} ({$color->color_hex})");
                    $assigned++;
                } else {
                    $this->line("- {$suburb->name}: Already has {$color->color_name} ({$color->color_hex})");
                    $skipped++;
                }
            } catch (\Exception $e) {
                $this->error("✗ {$suburb->name}: {$e->getMessage()}");
                return 1;
            }
        }

        $this->line('');
        $this->info("Summary: {$assigned} new assignments, {$skipped} already existed");
        
        // Clear any remaining cache that might be stale after bulk operations
        if ($assigned > 0) {
            $this->clearRelatedCaches($date);
            $this->line('✓ Cleared related caches');
        }
        
        return 0;
    }

    /**
     * Clear cache keys that might be stale after bulk color assignments
     */
    private function clearRelatedCaches($date): void
    {
        // Clear color palette cache in case it was updated
        Cache::forget('color_palette:active');
        
        // Note: Individual suburb caches are cleared by assignColorForDate()
        if ($date->isToday()) {
            $this->line('  - Cleared today-related caches');
        }
    }
}
