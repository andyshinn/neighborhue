@extends('layout.app')

@section('title', 'Access Forbidden - Neighborhue')

@section('content')
    <div style="text-align: center; padding: 2rem 0;">
        <h1 style="font-size: 6rem; color: #ef4444; margin: 0;">403</h1>
        <h2 style="color: #374151; margin: 1rem 0;">Access Forbidden</h2>
        <p style="color: #6b7280; margin-bottom: 2rem;">
            You don't have permission to access this resource.
        </p>

        <div style="margin: 2rem 0;">
            <a href="{{ route('home') }}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 0.375rem; margin: 0.5rem;">
                🏠 Go Home
            </a>
            <a href="javascript:history.back()" style="display: inline-block; background-color: #6b7280; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 0.375rem; margin: 0.5rem;">
                ← Go Back
            </a>
        </div>
    </div>
@endsection