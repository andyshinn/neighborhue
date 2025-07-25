@extends('layout.app')

@section('title', 'Neighborhue - Synchronized LED Colors')

@section('content')
        <h1>🏠 Neighborhue</h1>
        <p>Create synchronized LED colors for your neighborhood. Perfect for Home Assistant and other home automation systems.</p>
        
        @if(session('success'))
            <div style="background-color: #d1fae5; color: #065f46; padding: 1rem; border-radius: 0.375rem; margin-bottom: 1rem;">
                {{ session('success') }}
            </div>
        @endif

        <form action="{{ route('suburb.create') }}" method="POST">
            @csrf
            <div class="form-group">
                <label for="name">Suburb Name (Optional)</label>
                <input type="text" id="name" name="name" placeholder="e.g., Maple Street, Downtown Block, etc." value="{{ old('name') }}">
                @error('name')
                    <div style="color: #dc2626; font-size: 0.875rem; margin-top: 0.25rem;">{{ $message }}</div>
                @enderror
            </div>

            <div class="form-group">
                <label for="timezone">Timezone</label>
                <select id="timezone" name="timezone" required>
                    <option value="">Select your timezone...</option>
                    <optgroup label="North America">
                        <option value="America/New_York">Eastern Time (New York)</option>
                        <option value="America/Chicago">Central Time (Chicago)</option>
                        <option value="America/Denver">Mountain Time (Denver)</option>
                        <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
                        <option value="America/Toronto">Eastern Time (Toronto)</option>
                        <option value="America/Vancouver">Pacific Time (Vancouver)</option>
                    </optgroup>
                    <optgroup label="Europe">
                        <option value="Europe/London">London (GMT/BST)</option>
                        <option value="Europe/Paris">Paris (CET/CEST)</option>
                        <option value="Europe/Berlin">Berlin (CET/CEST)</option>
                        <option value="Europe/Rome">Rome (CET/CEST)</option>
                        <option value="Europe/Amsterdam">Amsterdam (CET/CEST)</option>
                    </optgroup>
                    <optgroup label="Asia">
                        <option value="Asia/Tokyo">Tokyo (JST)</option>
                        <option value="Asia/Shanghai">Shanghai (CST)</option>
                        <option value="Asia/Seoul">Seoul (KST)</option>
                        <option value="Asia/Singapore">Singapore (SGT)</option>
                        <option value="Asia/Dubai">Dubai (GST)</option>
                    </optgroup>
                    <optgroup label="Australia & New Zealand">
                        <option value="Australia/Sydney">Sydney (AEST/AEDT)</option>
                        <option value="Australia/Melbourne">Melbourne (AEST/AEDT)</option>
                        <option value="Australia/Perth">Perth (AWST)</option>
                        <option value="Pacific/Auckland">Auckland (NZST/NZDT)</option>
                    </optgroup>
                    <optgroup label="Other">
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                    </optgroup>
                </select>
                @error('timezone')
                    <div style="color: #dc2626; font-size: 0.875rem; margin-top: 0.25rem;">{{ $message }}</div>
                @enderror
            </div>
            
            <button type="submit">Create New Suburb</button>
        </form>

        <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e5e7eb;">
            <h3>How it works:</h3>
            <ol style="padding-left: 1.5rem; color: #6b7280;">
                <li>Create a new suburb to get your unique API endpoints</li>
                <li>Share the suburb URL with your neighbors</li>
                <li>Use the API in Home Assistant or other automation systems</li>
                <li>Everyone gets the same daily color automatically</li>
            </ol>
        </div>
@endsection

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', function() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const select = document.getElementById('timezone');
    
    if (select && timezone) {
        // Try to find and select the detected timezone
        const option = select.querySelector(`option[value="${timezone}"]`);
        if (option) {
            option.selected = true;
        }
    }
});
</script>
@endpush