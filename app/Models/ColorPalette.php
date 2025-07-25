<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class ColorPalette extends Model
{
    protected $table = 'color_palette';
    
    protected $fillable = ['name', 'hex_value', 'is_active'];
    
    protected $casts = [
        'is_active' => 'boolean'
    ];

    public static function getActiveColors(): Collection
    {
        return Cache::remember('color_palette:active', now()->addHours(12), function() {
            return static::where('is_active', true)->get();
        });
    }

    public static function getRandomColor(): ?self
    {
        $activeColors = static::getActiveColors();
        
        if ($activeColors->isEmpty()) {
            return null;
        }
        
        return $activeColors->random();
    }

    /**
     * Boot method to add model event listeners for cache invalidation
     */
    protected static function boot()
    {
        parent::boot();
        
        // Clear cache when color palette is modified
        static::saved(function () {
            Cache::forget('color_palette:active');
        });
        
        static::deleted(function () {
            Cache::forget('color_palette:active');
        });
    }
}
