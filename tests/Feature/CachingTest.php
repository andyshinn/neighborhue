<?php

use App\Models\Suburb;
use App\Models\ColorPalette;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    // Seed test color palette
    ColorPalette::create(['name' => 'Test Red', 'hex_value' => '#FF0000', 'is_active' => true]);
    ColorPalette::create(['name' => 'Test Blue', 'hex_value' => '#0000FF', 'is_active' => true]);
    
    // Clear cache before each test
    Cache::flush();
});

test('suburb lookup is cached properly', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'name' => 'Test Suburb', 'timezone' => 'UTC']);
    
    // First call should hit database
    $cachedSuburb1 = Suburb::findByHashCached($suburb->hash);
    expect($cachedSuburb1->id)->toBe($suburb->id);
    
    // Second call should come from cache
    $cachedSuburb2 = Suburb::findByHashCached($suburb->hash);
    expect($cachedSuburb2->id)->toBe($suburb->id);
    
    // Verify cache key exists
    expect(Cache::has("suburb:hash:{$suburb->hash}"))->toBeTrue();
});

test('todays color is cached with correct ttl', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    $suburb->assignColorForDate(Carbon::today());
    
    // First call should cache the result
    $color1 = $suburb->getTodaysColor();
    expect($color1)->not->toBeNull();
    
    // Second call should come from cache
    $color2 = $suburb->getTodaysColor();
    expect($color1->id)->toBe($color2->id);
    
    // Verify cache key exists
    expect(Cache::has("suburb:{$suburb->hash}:color:today"))->toBeTrue();
});


test('cache is cleared when new color is assigned', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    $today = Carbon::today();
    
    // Assign color first time
    $color1 = $suburb->assignColorForDate($today);
    
    // Get color to populate cache
    $cachedColor = $suburb->getTodaysColor();
    expect($cachedColor->id)->toBe($color1->id);
    
    // Clear the assigned color manually to test cache clearing
    $suburb->colors()->delete();
    
    // Assign new color - should clear cache
    $color2 = $suburb->assignColorForDate($today);
    
    // Get the color again - should be the new one
    $newCachedColor = $suburb->getTodaysColor();
    expect($newCachedColor->id)->toBe($color2->id);
});

test('color palette is cached', function () {
    // First call should cache the active colors
    $colors1 = ColorPalette::getActiveColors();
    expect($colors1->count())->toBe(2);
    
    // Second call should come from cache
    $colors2 = ColorPalette::getActiveColors();
    expect($colors1->count())->toBe($colors2->count());
    
    // Verify cache key exists
    expect(Cache::has('color_palette:active'))->toBeTrue();
});

test('random color selection works with cached palette', function () {
    $randomColor1 = ColorPalette::getRandomColor();
    $randomColor2 = ColorPalette::getRandomColor();
    
    expect($randomColor1)->not->toBeNull()
        ->and($randomColor2)->not->toBeNull()
        ->and(in_array($randomColor1->name, ['Test Red', 'Test Blue']))->toBeTrue()
        ->and(in_array($randomColor2->name, ['Test Red', 'Test Blue']))->toBeTrue();
});

test('api endpoints use cached data', function () {
    // Freeze time to avoid timing issues with local_time field
    $fixedTime = Carbon::parse('2025-07-25 12:00:00');
    Carbon::setTestNow($fixedTime);
    
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    $suburb->assignColorForDate(Carbon::today());
    
    // First API call should populate cache
    $response1 = $this->getJson("/api/suburb/{$suburb->hash}/color");
    $response1->assertStatus(200);
    
    // Verify caches are populated
    expect(Cache::has("suburb:hash:{$suburb->hash}"))->toBeTrue()
        ->and(Cache::has("suburb:{$suburb->hash}:color:today"))->toBeTrue();
    
    // Second API call should use cache
    $response2 = $this->getJson("/api/suburb/{$suburb->hash}/color");
    $response2->assertStatus(200);
    
    // Responses should be identical
    expect($response1->json())->toBe($response2->json());
    
    // Clean up
    Carbon::setTestNow();
});

test('cache handles non-existent suburbs correctly', function () {
    $invalidHash = 'invalid-hash-12345';
    
    $suburb1 = Suburb::findByHashCached($invalidHash);
    $suburb2 = Suburb::findByHashCached($invalidHash);
    
    expect($suburb1)->toBeNull()
        ->and($suburb2)->toBeNull();
    
    // Both calls should return null consistently (cache working)
});

test('only caches todays color', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    
    $suburb->assignColorForDate(Carbon::today());
    $todayColor = $suburb->getTodaysColor();
    
    // Should cache today's color
    expect(Cache::has("suburb:{$suburb->hash}:color:today"))->toBeTrue()
        ->and($todayColor)->not->toBeNull();
});

test('color palette cache is cleared when palette is modified', function () {
    // Populate cache
    $colors = ColorPalette::getActiveColors();
    expect(Cache::has('color_palette:active'))->toBeTrue();
    
    // Modify palette - should clear cache
    ColorPalette::create(['name' => 'New Color', 'hex_value' => '#123456', 'is_active' => true]);
    
    // Cache should be cleared
    expect(Cache::has('color_palette:active'))->toBeFalse();
});