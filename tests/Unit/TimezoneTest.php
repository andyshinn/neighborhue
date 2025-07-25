<?php

use App\Models\Suburb;
use App\Models\ColorPalette;
use Carbon\Carbon;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    // Seed some test colors
    ColorPalette::create(['name' => 'Test Red', 'hex_value' => '#FF0000', 'is_active' => true]);
});

test('suburb can get local time correctly', function () {
    $suburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'timezone' => 'Asia/Tokyo'
    ]);
    
    $utcTime = Carbon::create(2025, 1, 15, 14, 30, 0, 'UTC'); // 2:30 PM UTC
    $localTime = $suburb->getLocalTime($utcTime);
    
    expect($localTime->timezone->getName())->toBe('Asia/Tokyo')
        ->and($localTime->hour)->toBe(23) // 11:30 PM in Tokyo
        ->and($localTime->minute)->toBe(30);
});

test('suburb can get local today correctly', function () {
    $suburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'timezone' => 'America/New_York'
    ]);
    
    $localToday = $suburb->getLocalToday();
    
    expect($localToday->timezone->getName())->toBe('America/New_York')
        ->and($localToday->hour)->toBe(0)
        ->and($localToday->minute)->toBe(0)
        ->and($localToday->second)->toBe(0);
});

test('color assignment respects timezone', function () {
    $tokyoSuburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'timezone' => 'Asia/Tokyo'
    ]);
    
    $nySuburb = Suburb::create([
        'hash' => Suburb::generateHash(), 
        'timezone' => 'America/New_York'
    ]);
    
    // When it's 7 AM in Tokyo (10 PM previous day UTC)
    $utcTime = Carbon::create(2025, 1, 15, 22, 0, 0, 'UTC');
    
    expect($tokyoSuburb->isColorAssignmentTime($utcTime))->toBeTrue()
        ->and($nySuburb->isColorAssignmentTime($utcTime))->toBeFalse();
});

test('timezone validation works in suburb creation', function () {
    $validTimezones = [
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney'
    ];
    
    foreach ($validTimezones as $timezone) {
        $suburb = Suburb::create([
            'hash' => Suburb::generateHash(),
            'timezone' => $timezone
        ]);
        
        expect($suburb->timezone)->toBe($timezone);
    }
});

test('suburb defaults to UTC when no timezone specified', function () {
    // Create suburb through database without validation 
    $suburb = new Suburb();
    $suburb->hash = Suburb::generateHash();
    $suburb->save();
    
    $suburb->refresh(); // Get default value from database
    
    expect($suburb->timezone)->toBe('UTC');
});

test('is color assignment time works for various times', function () {
    $suburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'timezone' => 'UTC'
    ]);
    
    // Test various UTC times
    $testCases = [
        ['hour' => 7, 'minute' => 0, 'expected' => true],   // 7:00 AM - should be true
        ['hour' => 7, 'minute' => 15, 'expected' => true],  // 7:15 AM - should be true  
        ['hour' => 7, 'minute' => 29, 'expected' => true],  // 7:29 AM - should be true
        ['hour' => 7, 'minute' => 30, 'expected' => false], // 7:30 AM - should be false
        ['hour' => 6, 'minute' => 59, 'expected' => false], // 6:59 AM - should be false
        ['hour' => 8, 'minute' => 0, 'expected' => false],  // 8:00 AM - should be false
    ];
    
    foreach ($testCases as $case) {
        $testTime = Carbon::create(2025, 1, 15, $case['hour'], $case['minute'], 0, 'UTC');
        $result = $suburb->isColorAssignmentTime($testTime);
        
        expect($result)->toBe($case['expected'], 
            "Failed for {$case['hour']}:{$case['minute']} - expected {$case['expected']}, got " . ($result ? 'true' : 'false')
        );
    }
});