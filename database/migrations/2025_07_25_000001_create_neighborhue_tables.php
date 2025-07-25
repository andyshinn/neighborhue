<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Create color_palette table
        Schema::create('color_palette', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('hex_value');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Create suburbs table
        Schema::create('suburbs', function (Blueprint $table) {
            $table->id();
            $table->string('hash')->unique();
            $table->string('name')->nullable();
            $table->string('timezone')->default('UTC');
            $table->timestamps();
            
            $table->index('hash');
            $table->index('timezone');
        });

        // Create suburb_colors table
        Schema::create('suburb_colors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('suburb_id')->constrained('suburbs')->cascadeOnDelete();
            $table->date('date');
            $table->string('color_hex');
            $table->string('color_name')->nullable();
            $table->timestamps();
            
            $table->unique(['suburb_id', 'date']);
            $table->index(['suburb_id', 'date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('suburb_colors');
        Schema::dropIfExists('suburbs');
        Schema::dropIfExists('color_palette');
    }
};