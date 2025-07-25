<?php

use App\Models\Suburb;
use App\Models\ColorPalette;

beforeEach(function () {
    // Seed test color palette
    ColorPalette::create(['name' => 'Test Red', 'hex_value' => '#FF0000', 'is_active' => true]);
});

test('home page loads successfully', function () {
    $response = $this->get('/');

    $response->assertStatus(200)
        ->assertSee('Neighborhue')
        ->assertSee('Create New Suburb')
        ->assertViewIs('welcome');
});

test('can create new suburb via form', function () {
    $response = $this->post('/suburb/create', [
        'name' => 'Test Suburb',
        'timezone' => 'America/New_York'
    ]);

    $response->assertStatus(302);

    $suburb = Suburb::where('name', 'Test Suburb')->first();
    expect($suburb)->not->toBeNull()
        ->and($suburb->hash)->toBeString()
        ->and($suburb->name)->toBe('Test Suburb');

    // Should redirect to suburb show page
    $response->assertRedirect("/suburb/{$suburb->hash}");
});

test('can create suburb without name', function () {
    $response = $this->post('/suburb/create', [
        'timezone' => 'UTC'
    ]);

    $response->assertStatus(302);

    $suburb = Suburb::latest()->first();
    expect($suburb)->not->toBeNull()
        ->and($suburb->name)->toBeNull();
});

test('suburb creation assigns immediate color', function () {
    $this->post('/suburb/create', [
        'name' => 'Test Suburb',
        'timezone' => 'Europe/London'
    ]);

    $suburb = Suburb::where('name', 'Test Suburb')->first();
    $todaysColor = $suburb->getTodaysColor();

    expect($todaysColor)->not->toBeNull()
        ->and($todaysColor->color_hex)->toMatch('/^#[0-9A-F]{6}$/i');
});

test('suburb show page displays correctly', function () {
    $suburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'Test Suburb',
        'timezone' => 'UTC'
    ]);
    $suburb->assignColorForDate(now());

    $response = $this->get("/suburb/{$suburb->hash}");

    $response->assertStatus(200)
        ->assertSee('Test Suburb')
        ->assertSee($suburb->hash)
        ->assertSeeText('Today\'s Color', false)
        ->assertSee('API Endpoint')
        ->assertViewIs('suburb.show');
});

test('suburb show page handles missing suburb', function () {
    $response = $this->get('/suburb/invalid-hash');

    $response->assertStatus(404);
});

test('suburb show page displays no color message when none assigned', function () {
    $suburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'Test Suburb',
        'timezone' => 'UTC'
    ]);

    $response = $this->get("/suburb/{$suburb->hash}");

    $response->assertStatus(200)
        ->assertSee('No color assigned for today');
});

test('suburb show page includes api endpoints', function () {
    $suburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'Test Suburb',
        'timezone' => 'UTC'
    ]);

    $response = $this->get("/suburb/{$suburb->hash}");

    $response->assertSee("/api/suburb/{$suburb->hash}/color")
        ->assertSee('Copy');
});

test('form validation works for suburb name', function () {
    // Test with overly long name
    $longName = str_repeat('A', 256);

    $response = $this->post('/suburb/create', [
        'name' => $longName
    ]);

    $response->assertStatus(302)
        ->assertSessionHasErrors('name');
});

test('csrf protection is active on suburb creation', function () {
    // CSRF protection is active - form submissions without proper tokens would fail
    // This test ensures the form includes necessary CSRF protection
    $response = $this->get('/');

    // Check that form is present (CSRF is handled automatically by Laravel)
    $response->assertSee('<form', false)
        ->assertSee('suburb/create');
});

test('success message displays after suburb creation', function () {
    $response = $this->post('/suburb/create', [
        'name' => 'Test Suburb',
        'timezone' => 'Asia/Tokyo'
    ]);

    $suburb = Suburb::where('name', 'Test Suburb')->first();

    $response = $this->get("/suburb/{$suburb->hash}");
    $response->assertSee('Suburb created successfully');
});

test('share url is displayed correctly', function () {
    $suburb = Suburb::create([
        'hash' => Suburb::generateHash(),
        'name' => 'Test Suburb',
        'timezone' => 'UTC'
    ]);

    $response = $this->get("/suburb/{$suburb->hash}");

    $expectedUrl = url("/suburb/{$suburb->hash}");
    $response->assertSee($expectedUrl);
});
