<?php

namespace App\Console\Commands;

use App\Models\Suburb;
use Illuminate\Console\Command;

class RemoveSuburb extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'suburb:remove {hash? : Full hash or partial hash of the suburb}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Remove a suburb by hash';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $hash = $this->argument('hash');
        
        if (!$hash) {
            // List all suburbs for selection
            $suburbs = Suburb::all();
            
            if ($suburbs->isEmpty()) {
                $this->error('No suburbs found.');
                return 1;
            }
            
            $this->info('Available suburbs:');
            foreach ($suburbs as $suburb) {
                $this->line("- {$suburb->name} (Hash: {$suburb->hash})");
            }
            
            $hash = $this->ask('Enter the full hash or partial hash of the suburb to remove');
        }

        // Find suburb by exact hash or partial match
        $suburb = Suburb::where('hash', $hash)->first();
        
        if (!$suburb) {
            // Try partial match
            $suburb = Suburb::where('hash', 'LIKE', $hash . '%')->first();
        }
        
        if (!$suburb) {
            $this->error("Suburb with hash '{$hash}' not found.");
            return 1;
        }

        $this->info("Found suburb: " . ($suburb->name ?: '(unnamed)'));
        $this->line("Hash: {$suburb->hash}");
        
        if (!$this->confirm('Are you sure you want to remove this suburb?')) {
            $this->info('Suburb removal cancelled.');
            return 0;
        }

        $suburb->delete();
        
        $this->info('Suburb removed successfully.');
        
        return 0;
    }
}
