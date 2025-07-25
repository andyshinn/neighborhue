@extends('layout.app')

@section('title', 'Service Unavailable - Neighborhue')

@section('content')
    <div style="text-align: center; padding: 2rem 0;">
        <h1 style="font-size: 6rem; color: #f59e0b; margin: 0;">503</h1>
        <h2 style="color: #374151; margin: 1rem 0;">Service Unavailable</h2>
        <p style="color: #6b7280; margin-bottom: 2rem;">
            Neighborhue is temporarily down for maintenance.
        </p>

        <div style="margin: 2rem 0;">
            <button onclick="location.reload()" style="display: inline-block; background-color: #3b82f6; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 0.375rem; margin: 0.5rem; cursor: pointer;">
                🔄 Try Again
            </button>
        </div>

        <div style="margin-top: 3rem; padding: 1.5rem; background-color: #fef3c7; border-radius: 0.375rem;">
            <h3 style="color: #92400e; margin-bottom: 1rem;">Maintenance Mode</h3>
            <p style="color: #92400e;">
                We're performing scheduled maintenance to improve your experience. Please check back soon!
            </p>
        </div>
    </div>
@endsection