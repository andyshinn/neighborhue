<?php

use App\Models\Suburb;
use App\Models\ColorPalette;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;

beforeEach(function () {
    // Seed test color palette
    ColorPalette::create(['name' => 'Test Red', 'hex_value' => '#FF0000', 'is_active' => true]);
    ColorPalette::create(['name' => 'Test Blue', 'hex_value' => '#0000FF', 'is_active' => true]);
    ColorPalette::create(['name' => 'Test Green', 'hex_value' => '#00FF00', 'is_active' => true]);
});

test('timezone assignment command works when its 7 AM in target timezone', function () {
    // Create a suburb in UTC timezone for simpler testing
    $utcSuburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'UTC Suburb',
        'timezone' => 'UTC'
    ]);
    
    // Mock current time to be 7:15 AM UTC
    Carbon::setTestNow(Carbon::create(2025, 1, 15, 7, 15, 0, 'UTC'));
    
    // Run the command
    Artisan::call('colors:assign-by-timezone');
    $output = Artisan::output();
    
    // Check that the UTC suburb got a color assigned
    $todaysColor = $utcSuburb->getTodaysColor();
    expect($todaysColor)->not->toBeNull();
    
    // Output should mention processing the suburb
    expect($output)->toContain('UTC');
});

test('timezone assignment command skips timezones not at 7 AM', function () {
    // Create suburbs in different timezones
    $nySuburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'NY Suburb',
        'timezone' => 'America/New_York'
    ]);
    
    $londonSuburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'London Suburb', 
        'timezone' => 'Europe/London'
    ]);
    
    // Set current time to when it's NOT 7 AM in any timezone (e.g., 3 AM UTC)
    Carbon::setTestNow(Carbon::create(2025, 1, 15, 3, 0, 0, 'UTC'));
    
    Artisan::call('colors:assign-by-timezone');
    $output = Artisan::output();
    
    // Should report no suburbs processed
    expect($output)->toContain('No suburbs are currently at their 7 AM assignment time');
    
    // Suburbs should not have colors assigned
    expect($nySuburb->getTodaysColor())->toBeNull();
    expect($londonSuburb->getTodaysColor())->toBeNull();
});

test('timezone assignment command handles empty suburbs gracefully', function () {
    // No suburbs created
    
    Artisan::call('colors:assign-by-timezone');
    $output = Artisan::output();
    
    expect($output)->toContain('No suburbs found.');
});

test('timezone assignment command handles invalid timezone gracefully', function () {
    // Create suburb with invalid timezone directly in database to bypass validation
    $suburb = new Suburb();
    $suburb->hash = Suburb::generateHash();
    $suburb->name = 'Invalid Timezone Suburb';
    $suburb->timezone = 'Invalid/Timezone';
    $suburb->save();
    
    // Should not crash when processing invalid timezone
    Artisan::call('colors:assign-by-timezone');
    $output = Artisan::output();
    
    // Should contain error message about the invalid timezone
    expect($output)->toContain('Error processing timezone Invalid/Timezone');
});

test('timezone assignment command processes multiple timezones correctly', function () {
    // Create suburbs in different timezones
    $utcSuburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'UTC Suburb',
        'timezone' => 'UTC'
    ]);
    
    $tokyoSuburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'Tokyo Suburb',
        'timezone' => 'Asia/Tokyo'
    ]);
    
    // Mock time to be 7:15 AM UTC (so UTC suburb should get color, Tokyo should not)
    Carbon::setTestNow(Carbon::create(2025, 1, 15, 7, 15, 0, 'UTC'));
    
    Artisan::call('colors:assign-by-timezone');
    $output = Artisan::output();
    
    // UTC suburb should get color
    expect($utcSuburb->fresh()->getTodaysColor())->not->toBeNull();
    
    // Tokyo suburb should not (it would be 4:15 PM in Tokyo)
    expect($tokyoSuburb->fresh()->getTodaysColor())->toBeNull();
    
    // Output should show processing UTC timezone
    expect($output)->toContain('UTC');
});

test('timezone assignment command only processes 7:00-7:29 window', function () {
    // Test various times with fresh suburbs each time
    $testTimes = [
        ['hour' => 6, 'minute' => 59, 'should_process' => false],
        ['hour' => 7, 'minute' => 0, 'should_process' => true],
        ['hour' => 7, 'minute' => 15, 'should_process' => true],
        ['hour' => 7, 'minute' => 29, 'should_process' => true],
        ['hour' => 7, 'minute' => 30, 'should_process' => false],
        ['hour' => 8, 'minute' => 0, 'should_process' => false],
    ];
    
    foreach ($testTimes as $index => $testTime) {
        // Create a new suburb for each test to avoid color conflicts
        $utcSuburb = Suburb::create([
            'hash' => Suburb::generateHash(),
            'name' => "UTC Suburb {$index}",
            'timezone' => 'UTC'
        ]);
        
        // Set test time
        Carbon::setTestNow(Carbon::create(2025, 1, 15, $testTime['hour'], $testTime['minute'], 0, 'UTC'));
        
        Artisan::call('colors:assign-by-timezone');
        
        $hasColor = $utcSuburb->fresh()->getTodaysColor() !== null;
        
        expect($hasColor)->toBe($testTime['should_process'], 
            "Failed for {$testTime['hour']}:{$testTime['minute']} - expected " . 
            ($testTime['should_process'] ? 'color assigned' : 'no color') . 
            ", got " . ($hasColor ? 'color assigned' : 'no color')
        );
    }
});

test('timezone assignment command doesnt overwrite existing colors', function () {
    $utcSuburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'UTC Suburb',
        'timezone' => 'UTC'
    ]);
    
    // Set time to 7:15 AM UTC first
    Carbon::setTestNow(Carbon::create(2025, 1, 15, 7, 15, 0, 'UTC'));
    
    // Manually assign a color for the test date
    $testDate = Carbon::create(2025, 1, 15, 0, 0, 0, 'UTC')->startOfDay();
    $originalColor = $utcSuburb->assignColorForDate($testDate);
    
    // Run command
    Artisan::call('colors:assign-by-timezone');
    
    // Should keep the original color
    $currentColor = $utcSuburb->fresh()->getTodaysColor();
    expect($currentColor->id)->toBe($originalColor->id)
        ->and($currentColor->color_hex)->toBe($originalColor->color_hex);
});

afterEach(function () {
    // Reset Carbon test time
    Carbon::setTestNow();
});