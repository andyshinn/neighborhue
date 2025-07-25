<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyColor;
use App\Models\Suburb;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class SuburbApiController extends Controller
{
    public function getTodaysColor(string $hash): JsonResponse
    {
        $suburb = Suburb::findByHashCached($hash);
        if (!$suburb) {
            return response()->json(['error' => 'Suburb not found'], 404);
        }
        
        $todaysColor = $suburb->getTodaysColor();

        if (!$todaysColor) {
            return response()->json([
                'error' => 'No color assigned for today',
                'date' => now()->format('Y-m-d')
            ], 404);
        }

        return response()->json([
            'suburb' => [
                'hash' => $suburb->hash,
                'name' => $suburb->name,
                'timezone' => $suburb->timezone,
                'local_time' => $suburb->getLocalTime()->format('Y-m-d\TH:i:sP'),
            ],
            'color' => [
                'date' => $todaysColor->date->format('Y-m-d'),
                'local_date' => $suburb->getLocalToday()->format('Y-m-d'),
                'hex' => $todaysColor->color_hex,
                'name' => $todaysColor->color_name,
                'assigned_at_local' => '07:00:00',
                'rgb' => $todaysColor->toRgb(),
                'hsl' => $todaysColor->toHsl(),
            ]
        ]);
    }

}
