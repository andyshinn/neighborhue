<?php

namespace Database\Seeders;

use App\Models\ColorPalette;
use Illuminate\Database\Seeder;

class ColorPaletteSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $colors = [
            ['name' => 'Warm White', 'hex_value' => '#FFE4B5'],
            ['name' => 'Cool White', 'hex_value' => '#F0F8FF'],
            ['name' => 'Soft Red', 'hex_value' => '#FF6B6B'],
            ['name' => 'Ocean Blue', 'hex_value' => '#4ECDC4'],
            ['name' => 'Forest Green', 'hex_value' => '#45B7D1'],
            ['name' => 'Sunset Orange', 'hex_value' => '#FFA07A'],
            ['name' => 'Lavender', 'hex_value' => '#DDA0DD'],
            ['name' => 'Golden Yellow', 'hex_value' => '#FFD700'],
            ['name' => 'Mint Green', 'hex_value' => '#98FB98'],
            ['name' => 'Coral Pink', 'hex_value' => '#FF7F7F'],
        ];

        foreach ($colors as $color) {
            ColorPalette::create([
                'name' => $color['name'],
                'hex_value' => $color['hex_value'],
                'is_active' => true,
            ]);
        }
    }
}
