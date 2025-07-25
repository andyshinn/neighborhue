<?php

use App\Models\Suburb;
use App\Models\SuburbColor;
use App\Models\ColorPalette;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;

beforeEach(function () {
    // Seed test color palette
    ColorPalette::create(['name' => 'Test Red', 'hex_value' => '#FF0000', 'is_active' => true]);
    ColorPalette::create(['name' => 'Test Blue', 'hex_value' => '#0000FF', 'is_active' => true]);
    ColorPalette::create(['name' => 'Test Green', 'hex_value' => '#00FF00', 'is_active' => true]);
});

test('assign daily color command works for all suburbs', function () {
    // Create test suburbs
    $suburb1 = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Suburb 1', 'timezone' => 'UTC']);
    $suburb2 = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Suburb 2', 'timezone' => 'America/New_York']);
    $suburb3 = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Suburb 3', 'timezone' => 'Asia/Tokyo']);
    
    // Run the command
    Artisan::call('colors:assign-daily');
    $output = Artisan::output();
    
    // Check that all suburbs got colors assigned
    expect($suburb1->getTodaysColor())->not->toBeNull()
        ->and($suburb2->getTodaysColor())->not->toBeNull()
        ->and($suburb3->getTodaysColor())->not->toBeNull();
    
    // Verify output mentions all suburbs
    expect($output)->toContain('Suburb 1')
        ->and($output)->toContain('Suburb 2')
        ->and($output)->toContain('Suburb 3');
});

test('assign daily color command can handle specific date', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Test Suburb', 'timezone' => 'UTC']);
    $specificDate = Carbon::yesterday();
    
    Artisan::call('colors:assign-daily', ['--date' => $specificDate->format('Y-m-d')]);
    
    $color = SuburbColor::getColorForSuburbAndDate($suburb->id, $specificDate);
    expect($color)->not->toBeNull()
        ->and($color->date->format('Y-m-d'))->toBe($specificDate->format('Y-m-d'));
});

test('assign daily color command handles empty suburb list gracefully', function () {
    // No suburbs exist
    Artisan::call('colors:assign-daily');
    $output = Artisan::output();
    
    expect($output)->toContain('No suburbs found');
});

test('assign daily color command handles no active colors gracefully', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Test Suburb', 'timezone' => 'UTC']);
    
    // Deactivate all colors
    ColorPalette::query()->update(['is_active' => false]);
    
    Artisan::call('colors:assign-daily');
    $output = Artisan::output();
    
    expect($output)->toContain('No active colors found');
});

test('assign daily color command doesnt overwrite existing colors', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Test Suburb', 'timezone' => 'UTC']);
    
    // Manually assign a color
    $originalColor = $suburb->assignColorForDate(Carbon::today());
    
    // Run command again
    Artisan::call('colors:assign-daily');
    
    // Should keep the same color
    $currentColor = $suburb->getTodaysColor();
    expect($currentColor->id)->toBe($originalColor->id)
        ->and($currentColor->color_hex)->toBe($originalColor->color_hex);
});

test('different suburbs get colors assigned on same day', function () {
    $suburb1 = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Suburb 1', 'timezone' => 'UTC']);
    $suburb2 = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Suburb 2', 'timezone' => 'UTC']);
    $suburb3 = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Suburb 3', 'timezone' => 'UTC']);
    
    Artisan::call('colors:assign-daily');
    
    $color1 = $suburb1->getTodaysColor();
    $color2 = $suburb2->getTodaysColor();
    $color3 = $suburb3->getTodaysColor();
    
    // All suburbs should have colors assigned
    expect($color1)->not->toBeNull()
        ->and($color2)->not->toBeNull()
        ->and($color3)->not->toBeNull();
    
    // Colors should be from our palette
    $validColors = ['#FF0000', '#0000FF', '#00FF00'];
    expect(in_array($color1->color_hex, $validColors))->toBeTrue()
        ->and(in_array($color2->color_hex, $validColors))->toBeTrue()
        ->and(in_array($color3->color_hex, $validColors))->toBeTrue();
});

test('command provides useful output with color assignments', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Test Suburb', 'timezone' => 'UTC']);
    
    Artisan::call('colors:assign-daily');
    $output = Artisan::output();
    
    expect($output)->toContain('Test Suburb')
        ->and($output)->toContain('#') // Should show hex color
        ->and($output)->toMatch('/Test (Red|Blue|Green)/'); // Should show color name
});

test('command handles invalid date parameter gracefully', function () {
    $this->expectException(\Carbon\Exceptions\InvalidFormatException::class);
    Artisan::call('colors:assign-daily', ['--date' => 'invalid-date']);
});