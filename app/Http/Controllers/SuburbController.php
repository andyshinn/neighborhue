<?php

namespace App\Http\Controllers;

use App\Models\Suburb;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Http\RedirectResponse;

class SuburbController extends Controller
{
    public function index(): View
    {
        return view('welcome');
    }

    public function create(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => 'nullable|string|max:255',
            'timezone' => 'required|string|timezone',
        ]);

        $suburb = Suburb::create([
            'hash' => Suburb::generateHash(),
            'name' => $request->input('name'),
            'timezone' => $request->input('timezone'),
        ]);

        // Assign today's color immediately when creating the suburb
        try {
            $suburb->assignColorForDate(now());
        } catch (\Exception $e) {
            // If color assignment fails, still redirect but show a warning
            return redirect()->route('suburb.show', ['hash' => $suburb->hash])
                ->with('warning', 'Suburb created successfully, but could not assign today\'s color. Please ensure the color palette is seeded.');
        }

        return redirect()->route('suburb.show', ['hash' => $suburb->hash])
            ->with('success', 'Suburb created successfully with today\'s color assigned!');
    }

    public function show(string $hash): View
    {
        $suburb = Suburb::findByHashCached($hash);
        if (!$suburb) {
            abort(404);
        }
        
        $todaysColor = $suburb->getTodaysColor();

        return view('suburb.show', compact('suburb', 'todaysColor'));
    }

}
