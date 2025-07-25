<?php

use App\Models\Suburb;
use App\Models\SuburbColor;
use App\Models\ColorPalette;
use Carbon\Carbon;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    ColorPalette::create(['name' => 'Test Red', 'hex_value' => '#FF0000', 'is_active' => true]);
});

test('can create suburb color with required fields', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash()]);
    
    $color = SuburbColor::create([
        'suburb_id' => $suburb->id,
        'date' => Carbon::today(),
        'color_hex' => '#FF0000',
        'color_name' => 'Test Red'
    ]);
    
    expect($color->suburb_id)->toBe($suburb->id)
        ->and($color->date)->toBeInstanceOf(Carbon::class)
        ->and($color->color_hex)->toBe('#FF0000')
        ->and($color->color_name)->toBe('Test Red');
});

test('belongs to suburb', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash()]);
    $color = SuburbColor::create([
        'suburb_id' => $suburb->id,
        'date' => Carbon::today(),
        'color_hex' => '#FF0000',
        'color_name' => 'Test Red'
    ]);
    
    expect($color->suburb)->toBeInstanceOf(Suburb::class)
        ->and($color->suburb->id)->toBe($suburb->id);
});

test('can get color for suburb and date', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash()]);
    $testDate = Carbon::today();
    
    $color = SuburbColor::create([
        'suburb_id' => $suburb->id,
        'date' => $testDate,
        'color_hex' => '#FF0000',
        'color_name' => 'Test Red'
    ]);
    
    $retrieved = SuburbColor::getColorForSuburbAndDate($suburb->id, $testDate);
    
    expect($retrieved->id)->toBe($color->id);
});

test('can get todays color for suburb', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash()]);
    
    $color = SuburbColor::create([
        'suburb_id' => $suburb->id,
        'date' => Carbon::today(),
        'color_hex' => '#FF0000',
        'color_name' => 'Test Red'
    ]);
    
    $retrieved = SuburbColor::getTodaysColorForSuburb($suburb->id);
    
    expect($retrieved->id)->toBe($color->id);
});

test('can convert to rgb array', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash()]);
    $color = SuburbColor::create([
        'suburb_id' => $suburb->id,
        'date' => Carbon::today(),
        'color_hex' => '#FF0000',
        'color_name' => 'Test Red'
    ]);
    
    $rgb = $color->toRgb();
    
    expect($rgb)->toHaveKeys(['r', 'g', 'b'])
        ->and($rgb['r'])->toBe(255)
        ->and($rgb['g'])->toBe(0)
        ->and($rgb['b'])->toBe(0);
});

test('can convert to hsl array', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash()]);
    $color = SuburbColor::create([
        'suburb_id' => $suburb->id,
        'date' => Carbon::today(),
        'color_hex' => '#FF0000',
        'color_name' => 'Test Red'
    ]);
    
    $hsl = $color->toHsl();
    
    expect($hsl)->toHaveKeys(['h', 's', 'l'])
        ->and($hsl['h'])->toBeNumeric()
        ->and($hsl['s'])->toBeNumeric()
        ->and($hsl['l'])->toBeNumeric();
});

test('enforces unique constraint on suburb and date', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash()]);
    $testDate = Carbon::today();
    
    SuburbColor::create([
        'suburb_id' => $suburb->id,
        'date' => $testDate,
        'color_hex' => '#FF0000',
        'color_name' => 'Test Red'
    ]);
    
    expect(fn() => SuburbColor::create([
        'suburb_id' => $suburb->id,
        'date' => $testDate,
        'color_hex' => '#0000FF',
        'color_name' => 'Test Blue'
    ]))->toThrow(Exception::class);
});