@extends('layout.app')

@section('title', ($suburb->name ?: 'Suburb') . ' - Neighborhue')

@section('content')
        <h1>🏠 {{ $suburb->name ?: 'Your Suburb' }}</h1>
        <p>Suburb ID: <code style="word-break: break-all; font-size: 0.875rem;">{{ $suburb->hash }}</code>
            <button class="copy-btn" onclick="copyToClipboard('{{ $suburb->hash }}')">Copy</button></p>
        <p><strong>Timezone:</strong> {{ $suburb->timezone }} 
            <small>(Local time: {{ $suburb->getLocalTime()->format('g:i A') }})</small></p>

        @if(session('success'))
            <div style="background-color: #d1fae5; color: #065f46; padding: 1rem; border-radius: 0.375rem; margin-bottom: 1rem;">
                {{ session('success') }}
            </div>
        @endif

        @if(session('warning'))
            <div style="background-color: #fef3c7; color: #92400e; padding: 1rem; border-radius: 0.375rem; margin-bottom: 1rem;">
                {{ session('warning') }}
            </div>
        @endif

        <div class="section">
            <h2>Today's Color</h2>
            @if($todaysColor)
                <div class="color-display" style="background-color: {{ $todaysColor->color_hex }};">
                    {{ $todaysColor->color_hex }}
                </div>
                <div style="text-align: center;">
                    <strong>{{ $todaysColor->color_name }}</strong><br>
                    <small>{{ $todaysColor->date->format('F j, Y') }}</small>
                </div>
            @else
                <div class="no-color">
                    No color assigned for today. Run the daily color assignment command.
                </div>
            @endif
        </div>

        <div class="section">
            <h2>Share This Suburb</h2>
            <div class="share-url">
                <strong>Share this URL with your neighbors:</strong><br>
                <code>{{ url()->current() }}</code>
                <button class="copy-btn" onclick="copyToClipboard('{{ url()->current() }}')">Copy</button>
            </div>
        </div>

        <div class="section">
            <h2>API Endpoint</h2>
            <p>Use this endpoint in Home Assistant or other automation systems:</p>

            <div class="endpoint">
                <div class="endpoint-label">Get Current Color</div>
                <code>GET {{ url('/api/suburb/' . $suburb->hash . '/color') }}</code>
                <button class="copy-btn" onclick="copyToClipboard('{{ url('/api/suburb/' . $suburb->hash . '/color') }}')">Copy</button>
            </div>
        </div>

        <div class="section">
            <h2>Example Response</h2>
            <pre style="background-color: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; font-size: 0.875rem;">
{
  "suburb": {
    "hash": "{{ $suburb->hash }}",
    "name": "{{ $suburb->name }}",
    "timezone": "{{ $suburb->timezone }}",
    "local_time": "{{ $suburb->getLocalTime()->format('Y-m-d\TH:i:sP') }}"
  },
  "color": {
    "date": "2025-07-24",
    "local_date": "{{ $suburb->getLocalToday()->format('Y-m-d') }}",
    "hex": "#F0F8FF",
    "name": "Cool White",
    "assigned_at_local": "07:00:00",
    "rgb": {"r": 240, "g": 248, "b": 255},
    "hsl": {"h": 208, "s": 100, "l": 97}
  }
}</pre>
        </div>

        <div style="text-align: center; margin-top: 2rem;">
            <a href="{{ route('home') }}" style="color: #3b82f6; text-decoration: none;">← Create Another Suburb</a>
        </div>
@endsection

@push('scripts')
<script>
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(function() {
            // Could add a toast notification here
            console.log('Copied to clipboard: ' + text);
        });
    }
</script>
@endpush
