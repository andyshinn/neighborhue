@extends('layout.app')

@section('title', 'Page Not Found - Neighborhue')

@section('content')
    <div style="text-align: center; padding: 2rem 0;">
        <h1 style="font-size: 6rem; color: #ef4444; margin: 0;">404</h1>
        <h2 style="color: #374151; margin: 1rem 0;">Page Not Found</h2>
        <p style="color: #6b7280; margin-bottom: 2rem;">
            The page you're looking for doesn't exist or has been moved.
        </p>

        <div style="margin: 2rem 0;">
            <a href="{{ route('home') }}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 0.375rem; margin: 0.5rem;">
                🏠 Go Home
            </a>
            <a href="javascript:history.back()" style="display: inline-block; background-color: #6b7280; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 0.375rem; margin: 0.5rem;">
                ← Go Back
            </a>
        </div>

        <div style="margin-top: 3rem; padding: 1.5rem; background-color: #f3f4f6; border-radius: 0.375rem;">
            <h3 style="color: #374151; margin-bottom: 1rem;">Looking for a suburb?</h3>
            <p style="color: #6b7280; margin-bottom: 1rem;">
                If you're trying to access a suburb page, make sure you have the correct URL with the full suburb hash.
            </p>
            <p style="color: #6b7280;">
                Suburb URLs look like: <code>/suburb/51fbbdef-62a7-4d19-b1b2-c91e1d721d20</code>
            </p>
        </div>
    </div>
@endsection