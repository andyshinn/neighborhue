<?php

use App\Models\ColorPalette;
use Tests\TestCase;

uses(TestCase::class);

test('can create color palette entry', function () {
    $color = ColorPalette::create([
        'name' => 'Test Red',
        'hex_value' => '#FF0000',
        'is_active' => true
    ]);
    
    expect($color->name)->toBe('Test Red')
        ->and($color->hex_value)->toBe('#FF0000')
        ->and($color->is_active)->toBeTrue();
});

test('is_active defaults to true', function () {
    $color = ColorPalette::create([
        'name' => 'Test Blue',
        'hex_value' => '#0000FF'
    ]);
    
    // Refresh from database to get default value
    $color->refresh();
    
    expect($color->is_active)->toBeTrue();
});

test('can get active colors only', function () {
    ColorPalette::create(['name' => 'Active Red', 'hex_value' => '#FF0000', 'is_active' => true]);
    ColorPalette::create(['name' => 'Inactive Blue', 'hex_value' => '#0000FF', 'is_active' => false]);
    ColorPalette::create(['name' => 'Active Green', 'hex_value' => '#00FF00', 'is_active' => true]);
    
    $activeColors = ColorPalette::getActiveColors();
    
    expect($activeColors)->toHaveCount(2)
        ->and($activeColors->pluck('name')->toArray())->toContain('Active Red', 'Active Green')
        ->and($activeColors->pluck('name')->toArray())->not->toContain('Inactive Blue');
});

test('can get random color from active colors', function () {
    ColorPalette::create(['name' => 'Red', 'hex_value' => '#FF0000', 'is_active' => true]);
    ColorPalette::create(['name' => 'Blue', 'hex_value' => '#0000FF', 'is_active' => true]);
    ColorPalette::create(['name' => 'Inactive', 'hex_value' => '#FFFFFF', 'is_active' => false]);
    
    $randomColor = ColorPalette::getRandomColor();
    
    expect($randomColor)->toBeInstanceOf(ColorPalette::class)
        ->and($randomColor->is_active)->toBeTrue()
        ->and($randomColor->name)->toBeIn(['Red', 'Blue']);
});

test('returns null when no active colors available', function () {
    ColorPalette::create(['name' => 'Inactive', 'hex_value' => '#FFFFFF', 'is_active' => false]);
    
    $randomColor = ColorPalette::getRandomColor();
    
    expect($randomColor)->toBeNull();
});

test('validates hex color format', function () {
    $validColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000'];
    
    foreach ($validColors as $hex) {
        $color = ColorPalette::create([
            'name' => "Test {$hex}",
            'hex_value' => $hex,
            'is_active' => true
        ]);
        
        expect($color->hex_value)->toBe($hex);
    }
});