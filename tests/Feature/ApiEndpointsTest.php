<?php

use App\Models\Suburb;
use App\Models\SuburbColor;
use App\Models\ColorPalette;
use Carbon\Carbon;

beforeEach(function () {
    // Seed test color palette
    ColorPalette::create(['name' => 'Test Red', 'hex_value' => '#FF0000', 'is_active' => true]);
    ColorPalette::create(['name' => 'Test Blue', 'hex_value' => '#0000FF', 'is_active' => true]);
});

test('can get todays color for valid suburb', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    $color = $suburb->assignColorForDate(Carbon::today());
    
    $response = $this->getJson("/api/suburb/{$suburb->hash}/color");
    
    $response->assertStatus(200)
        ->assertJson([
            'suburb' => [
                'hash' => $suburb->hash,
                'name' => $suburb->name,
                'timezone' => $suburb->timezone
            ],
            'color' => [
                'date' => Carbon::today()->format('Y-m-d'),
                'local_date' => $suburb->getLocalToday()->format('Y-m-d'),
                'hex' => $color->color_hex,
                'name' => $color->color_name,
                'assigned_at_local' => '07:00:00'
            ]
        ])
        ->assertJsonStructure([
            'suburb' => ['hash', 'name', 'timezone', 'local_time'],
            'color' => ['date', 'local_date', 'hex', 'name', 'assigned_at_local', 'rgb', 'hsl']
        ]);
});

test('returns 404 for invalid suburb hash', function () {
    $response = $this->getJson('/api/suburb/invalid-hash/color');
    
    $response->assertStatus(404);
});

test('returns 404 when no color assigned for today', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    
    $response = $this->getJson("/api/suburb/{$suburb->hash}/color");
    
    $response->assertStatus(404)
        ->assertJson(['error' => 'No color assigned for today']);
});


test('api responses include rgb and hsl color formats', function () {
    $suburb = Suburb::create(['hash' => Suburb::generateHash(), 'timezone' => 'UTC']);
    $color = $suburb->assignColorForDate(Carbon::today());
    
    $response = $this->getJson("/api/suburb/{$suburb->hash}/color");
    
    $colorData = $response->json('color');
    
    expect($colorData['rgb'])->toHaveKeys(['r', 'g', 'b'])
        ->and($colorData['hsl'])->toHaveKeys(['h', 's', 'l'])
        ->and($colorData['rgb']['r'])->toBeNumeric()
        ->and($colorData['rgb']['g'])->toBeNumeric()
        ->and($colorData['rgb']['b'])->toBeNumeric();
});

test('api endpoints handle malformed suburb hash gracefully', function () {
    $malformedHashes = ['', 'short', '!@#$%^&*()', 'way-too-long-to-be-a-valid-uuid-hash'];
    
    foreach ($malformedHashes as $hash) {
        $response = $this->getJson("/api/suburb/{$hash}/color");
        $response->assertStatus(404);
    }
});

test('api response includes timezone information correctly', function () {
    $suburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'timezone' => 'Asia/Tokyo'
    ]);
    $color = $suburb->assignColorForDate(Carbon::today());
    
    $response = $this->getJson("/api/suburb/{$suburb->hash}/color");
    
    $data = $response->json();
    
    expect($data['suburb']['timezone'])->toBe('Asia/Tokyo')
        ->and($data['suburb']['local_time'])->toBeString()
        ->and($data['color']['local_date'])->toBeString()
        ->and($data['color']['assigned_at_local'])->toBe('07:00:00');
    
    // Verify local_time format (ISO 8601 with timezone)
    expect($data['suburb']['local_time'])->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/');
});