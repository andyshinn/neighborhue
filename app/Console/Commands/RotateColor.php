<?php

namespace App\Console\Commands;

use App\Models\ColorPalette;
use App\Models\Suburb;
use App\Models\SuburbColor;
use Illuminate\Console\Command;

class RotateColor extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'colors:rotate {suburb? : Suburb hash or partial hash (optional)} {--date= : Date to rotate color for (YYYY-MM-DD format, defaults to today)} {--force : Force rotation even if color already exists} {--all : Rotate colors for all suburbs}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Manually rotate/change the color assignment for specific suburb(s)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $date = $this->option('date') ? now()->parse($this->option('date')) : now();
        $dateString = $date->format('Y-m-d');
        $force = $this->option('force');
        $all = $this->option('all');
        $suburbHash = $this->argument('suburb');

        // Determine which suburbs to rotate
        $suburbs = [];
        
        if ($all) {
            $suburbs = Suburb::all();
        } elseif ($suburbHash) {
            // Find suburb by exact hash or partial match
            $suburb = Suburb::where('hash', $suburbHash)->first();
            if (!$suburb) {
                $suburb = Suburb::where('hash', 'LIKE', $suburbHash . '%')->first();
            }
            
            if (!$suburb) {
                $this->error("Suburb with hash '{$suburbHash}' not found.");
                return 1;
            }
            
            $suburbs = [$suburb];
        } else {
            // Interactive selection
            $allSuburbs = Suburb::all();
            
            if ($allSuburbs->isEmpty()) {
                $this->error('No suburbs found.');
                return 1;
            }
            
            $this->info('Available suburbs:');
            foreach ($allSuburbs as $index => $suburb) {
                $this->line(($index + 1) . ". {$suburb->name} ({$suburb->hash})");
            }
            
            $choice = $this->ask('Enter suburb number, or "all" for all suburbs');
            
            if (strtolower($choice) === 'all') {
                $suburbs = $allSuburbs;
            } else {
                $index = (int)$choice - 1;
                if (isset($allSuburbs[$index])) {
                    $suburbs = [$allSuburbs[$index]];
                } else {
                    $this->error('Invalid selection.');
                    return 1;
                }
            }
        }

        if (empty($suburbs)) {
            $this->error('No suburbs to process.');
            return 1;
        }

        $this->info("Rotating colors for {$dateString} for " . count($suburbs) . " suburb(s):");
        $this->line('');

        foreach ($suburbs as $suburb) {
            $this->rotateSuburbColor($suburb, $date, $force);
        }
        
        return 0;
    }

    private function rotateSuburbColor(Suburb $suburb, $date, bool $force): void
    {
        $dateString = $date->format('Y-m-d');
        
        // Check if color already exists
        $existingColor = \App\Models\SuburbColor::getColorForSuburbAndDate($suburb->id, $date);
        
        if ($existingColor && !$force) {
            $this->line("- {$suburb->name}: Already has {$existingColor->color_name} ({$existingColor->color_hex})");
            return;
        }

        // Get random color from active palette
        $randomColor = ColorPalette::getRandomColor();
        
        if (!$randomColor) {
            $this->error("✗ {$suburb->name}: No active colors found in palette");
            return;
        }

        if ($existingColor) {
            // Update existing record
            $existingColor->update([
                'color_hex' => $randomColor->hex_value,
                'color_name' => $randomColor->name,
            ]);
            
            $this->line("↻ {$suburb->name}: Changed to {$randomColor->name} ({$randomColor->hex_value})");
        } else {
            // Create new record
            $suburb->colors()->create([
                'date' => $dateString,
                'color_hex' => $randomColor->hex_value,
                'color_name' => $randomColor->name,
            ]);

            $this->line("✓ {$suburb->name}: Assigned {$randomColor->name} ({$randomColor->hex_value})");
        }
    }
}
