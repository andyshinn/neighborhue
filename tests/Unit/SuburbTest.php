<?php

use App\Models\Suburb;
use App\Models\SuburbColor;
use App\Models\ColorPalette;
use Carbon\Carbon;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    // Seed some test colors
    ColorPalette::create(['name' => 'Test Red', 'hex_value' => '#FF0000', 'is_active' => true]);
    ColorPalette::create(['name' => 'Test Blue', 'hex_value' => '#0000FF', 'is_active' => true]);
});

test('can generate unique uuid hash', function () {
    $hash1 = Suburb::generateHash();
    $hash2 = Suburb::generateHash();
    
    expect($hash1)->toBeString()
        ->and($hash1)->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i')
        ->and($hash1)->not->toBe($hash2);
});

test('can create suburb with hash and optional name', function () {
    $suburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'Test Suburb',
        'timezone' => 'UTC'
    ]);
    
    expect($suburb->hash)->toBeString()
        ->and($suburb->name)->toBe('Test Suburb')
        ->and($suburb->created_at)->toBeInstanceOf(Carbon::class);
});

test('can assign color for date', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    $testDate = Carbon::today();
    
    $color = $suburb->assignColorForDate($testDate);
    
    expect($color)->toBeInstanceOf(SuburbColor::class)
        ->and($color->suburb_id)->toBe($suburb->id)
        ->and($color->date->format('Y-m-d'))->toBe($testDate->format('Y-m-d'))
        ->and($color->color_hex)->toMatch('/^#[0-9A-F]{6}$/i')
        ->and($color->color_name)->toBeString();
});

test('returns existing color when assigning for same date', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    $testDate = Carbon::today();
    
    $color1 = $suburb->assignColorForDate($testDate);
    $color2 = $suburb->assignColorForDate($testDate);
    
    expect($color1->id)->toBe($color2->id)
        ->and($color1->color_hex)->toBe($color2->color_hex);
});

test('can get todays color', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    
    // Initially no color
    expect($suburb->getTodaysColor())->toBeNull();
    
    // Assign color
    $assignedColor = $suburb->assignColorForDate(Carbon::today());
    $retrievedColor = $suburb->getTodaysColor();
    
    expect($retrievedColor->id)->toBe($assignedColor->id);
});


test('throws exception when no active colors in palette', function () {
    // Remove all active colors
    ColorPalette::query()->update(['is_active' => false]);
    
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    
    expect(fn() => $suburb->assignColorForDate(Carbon::today()))
        ->toThrow(Exception::class, 'No active colors found in palette');
});