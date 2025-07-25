# Neighborhue

A Laravel application for neighborhood LED color coordination. Households create private groups (suburbs) and get synchronized daily colors for home automation systems.

## Claude

I've written this web application mostly using Claude. While I know a little bit about Laravel I have mostly relied on high level concepts. There may be mistakes and errors and that is OK!

## Development Setup

### Requirements

- PHP 8.2+
- Composer
- SQLite (default) or MySQL/PostgreSQL
- Redis (recommended for caching)

### Installation

```bash
git clone <repository-url>
cd neighborhue
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

## Development Commands

### Testing

```bash
php artisan test                    # Run all tests
php artisan test --filter=Api      # Run API tests only
php artisan test --filter=Caching  # Run caching tests only
```

### Suburb Management

```bash
php artisan suburb:create                           # Create suburb interactively
php artisan suburb:create --name="Oak Street"       # Create named suburb
php artisan suburb:create --timezone="Asia/Tokyo"   # Create with timezone
php artisan suburb:list                             # List all suburbs
php artisan suburb:remove                           # Remove suburb interactively
```

### Color Assignment

```bash
php artisan colors:assign-daily                     # Assign colors for today
php artisan colors:assign-daily --date=2025-01-15   # Assign for specific date
php artisan colors:assign-by-timezone               # Timezone-aware assignment
php artisan colors:rotate                           # Manually rotate colors
php artisan colors:rotate --all                     # Rotate all suburbs
```

### Cache Management

```bash
php artisan cache:clear             # Clear application cache
php artisan config:cache            # Cache configuration
php artisan route:cache             # Cache routes
```

### Scheduling

The application assigns colors daily at 7:00 AM per suburb's local timezone:

```bash
php artisan schedule:work           # Run scheduler (development)
php artisan schedule:run            # Run scheduled tasks once
```

For production, add to crontab:
```
* * * * * cd /path/to/neighborhue && php artisan schedule:run >> /dev/null 2>&1
```

## API Usage

### Get Current Color

```bash
curl http://localhost:8000/api/suburb/{hash}/color
```

Response format:
```json
{
  "suburb": {
    "hash": "51fbbdef-62a7-4d19-b1b2-c91e1d721d20",
    "name": "Oak Street",
    "timezone": "America/New_York",
    "local_time": "2025-07-25T14:30:00-04:00"
  },
  "color": {
    "date": "2025-07-25",
    "local_date": "2025-07-25",
    "hex": "#FF6B6B",
    "name": "Soft Red",
    "assigned_at_local": "07:00:00",
    "rgb": {"r": 255, "g": 107, "b": 107},
    "hsl": {"h": 0, "s": 100, "l": 71}
  }
}
```

## Configuration

### Environment Variables

```env
APP_NAME=Neighborhue
DB_CONNECTION=sqlite
CACHE_STORE=redis
REDIS_HOST=127.0.0.1
```

### Database

Default: SQLite (`database/database.sqlite`)
Production: MySQL/PostgreSQL supported

### Caching

Recommended: Redis for production
Fallback: File cache for development

## Project Structure

- `app/Models/` - Eloquent models (Suburb, SuburbColor, ColorPalette)
- `app/Console/Commands/` - CLI management commands
- `database/migrations/` - Database schema
- `tests/` - PHPUnit/Pest test suite
- `resources/views/` - Blade templates
- `routes/api.php` - API endpoints
- `routes/web.php` - Web routes

## Development Notes

- Colors assigned once daily per suburb at 7:00 AM local time
- Redis caching with automatic invalidation
- UUID4 suburb identification for privacy
- Comprehensive test coverage (70+ tests)
- Timezone-aware scheduling every 15 minutes
