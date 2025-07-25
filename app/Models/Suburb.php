<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class Suburb extends Model
{
    protected $fillable = ['hash', 'name', 'timezone'];

    public static function findByHashCached(string $hash): ?self
    {
        $cacheKey = "suburb:hash:{$hash}";
        
        return Cache::remember($cacheKey, now()->addHours(24), function() use ($hash) {
            return static::where('hash', $hash)->first();
        });
    }

    public static function generateHash(): string
    {
        return (string) Str::uuid();
    }

    public function colors(): HasMany
    {
        return $this->hasMany(SuburbColor::class);
    }

    public function getTodaysColor(): ?SuburbColor
    {
        $cacheKey = "suburb:{$this->hash}:color:today";
        
        return Cache::remember($cacheKey, now()->addHours(12), function() {
            return SuburbColor::getTodaysColorForSuburb($this->id);
        });
    }


    public function assignColorForDate(Carbon $date): SuburbColor
    {
        // Check if color already exists for this date
        $existingColor = SuburbColor::getColorForSuburbAndDate($this->id, $date);
        if ($existingColor) {
            return $existingColor;
        }

        // Get random color from palette
        $randomColor = ColorPalette::getRandomColor();
        
        if (!$randomColor) {
            throw new \Exception('No active colors found in palette');
        }

        // Create new color assignment
        $color = $this->colors()->create([
            'date' => $date->format('Y-m-d'),
            'color_hex' => $randomColor->hex_value,
            'color_name' => $randomColor->name,
        ]);

        // Clear relevant caches
        $this->clearColorCaches($date);

        return $color;
    }

    public function getLocalTime(?Carbon $utcTime = null): Carbon
    {
        $time = $utcTime ?? now();
        return $time->setTimezone($this->timezone);
    }
    
    public function getLocalToday(): Carbon
    {
        return $this->getLocalTime()->startOfDay();
    }
    
    public function isColorAssignmentTime(?Carbon $utcTime = null): bool
    {
        $localTime = $this->getLocalTime($utcTime);
        return $localTime->hour === 7 && $localTime->minute < 30;
    }

    private function clearColorCaches(Carbon $date): void
    {
        // Only clear today's cache since we only store current colors
        if ($date->isToday()) {
            Cache::forget("suburb:{$this->hash}:color:today");
        }
    }
}
