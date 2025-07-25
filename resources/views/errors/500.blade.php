@extends('layout.app')

@section('title', 'Server Error - Neighborhue')

@section('content')
    <div style="text-align: center; padding: 2rem 0;">
        <h1 style="font-size: 6rem; color: #ef4444; margin: 0;">500</h1>
        <h2 style="color: #374151; margin: 1rem 0;">Internal Server Error</h2>
        <p style="color: #6b7280; margin-bottom: 2rem;">
            Something went wrong on our end. We're working to fix it.
        </p>

        <div style="margin: 2rem 0;">
            <a href="{{ route('home') }}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 0.375rem; margin: 0.5rem;">
                🏠 Go Home
            </a>
            <button onclick="location.reload()" style="display: inline-block; background-color: #6b7280; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 0.375rem; margin: 0.5rem; cursor: pointer;">
                🔄 Try Again
            </button>
        </div>

        <div style="margin-top: 3rem; padding: 1.5rem; background-color: #f3f4f6; border-radius: 0.375rem;">
            <h3 style="color: #374151; margin-bottom: 1rem;">If this problem persists</h3>
            <p style="color: #6b7280; margin-bottom: 1rem;">
                This might be a temporary issue with our color assignment system or database.
            </p>
            <p style="color: #6b7280;">
                Please try again in a few minutes, or check if the daily color assignment task is running properly.
            </p>
        </div>
    </div>
@endsection