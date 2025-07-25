<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OzdemirBurak\Iris\Color\Hex;

class SuburbColor extends Model
{
    protected $fillable = ['suburb_id', 'date', 'color_hex', 'color_name'];
    
    protected $casts = [
        'date' => 'date'
    ];

    public function suburb(): BelongsTo
    {
        return $this->belongsTo(Suburb::class);
    }

    public static function getColorForSuburbAndDate(int $suburbId, Carbon $date): ?self
    {
        return static::where('suburb_id', $suburbId)
            ->whereDate('date', $date->format('Y-m-d'))
            ->first();
    }

    public static function getTodaysColorForSuburb(int $suburbId): ?self
    {
        return static::getColorForSuburbAndDate($suburbId, now());
    }

    public function toRgb(): array
    {
        $hex = new Hex($this->color_hex);
        $rgb = $hex->toRgb();
        
        return [
            'r' => $rgb->red(),
            'g' => $rgb->green(), 
            'b' => $rgb->blue()
        ];
    }

    public function toHsl(): array
    {
        $hex = new Hex($this->color_hex);
        $hsl = $hex->toHsl();
        
        return [
            'h' => $hsl->hue(),
            's' => $hsl->saturation(),
            'l' => $hsl->lightness()
        ];
    }
}
