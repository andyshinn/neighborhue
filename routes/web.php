<?php

use App\Http\Controllers\SuburbController;
use Illuminate\Support\Facades\Route;

Route::get('/', [SuburbController::class, 'index'])->name('home');
Route::post('/suburb/create', [SuburbController::class, 'create'])->name('suburb.create');
Route::get('/suburb/{hash}', [SuburbController::class, 'show'])->name('suburb.show');
