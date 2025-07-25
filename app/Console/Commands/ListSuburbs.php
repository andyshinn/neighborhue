<?php

namespace App\Console\Commands;

use App\Models\Suburb;
use Illuminate\Console\Command;

class ListSuburbs extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'suburb:list';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'List all suburbs with their details';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $suburbs = Suburb::orderBy('created_at', 'desc')->get();

        if ($suburbs->isEmpty()) {
            $this->info('No suburbs found.');
            return 0;
        }

        $this->info('All suburbs:');
        $this->line('');

        foreach ($suburbs as $suburb) {
            $this->line("Name: " . ($suburb->name ?: '(unnamed)'));
            $this->line("Hash: {$suburb->hash}");
            $this->line("Created: " . $suburb->created_at->format('Y-m-d H:i:s'));
            $this->line("URL: " . url("/suburb/{$suburb->hash}"));
            $this->line("API: " . url("/api/suburb/{$suburb->hash}/color"));
            $this->line(str_repeat('-', 60));
        }

        $this->info("Total: {$suburbs->count()} suburb(s)");

        return 0;
    }
}
