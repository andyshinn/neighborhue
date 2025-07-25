<?php

test('404 error page renders correctly', function () {
    // Test invalid suburb hash
    $response = $this->get('/suburb/invalid-hash');
    
    $response->assertStatus(404)
        ->assertSee('404')
        ->assertSee('Page Not Found')
        ->assertSee('Go Home')
        ->assertSee('Looking for a suburb?');
});

test('404 api error returns json', function () {
    $response = $this->getJson('/api/suburb/invalid-hash/color');
    
    $response->assertStatus(404)
        ->assertJsonStructure(['error']);
});

test('invalid route returns 404 page', function () {
    $response = $this->get('/this-route-does-not-exist');
    
    $response->assertStatus(404)
        ->assertSee('404')
        ->assertSee('Page Not Found');
});