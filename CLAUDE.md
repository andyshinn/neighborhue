# Neighborhue - Claude Development Context

## Project Overview

**Neighborhue** is a Laravel-based web application that enables neighborhood coordination through daily shared colors. Households can create "Suburbs" (private neighborhood groups) and query an API to get synchronized daily colors for home automation systems like Home Assistant.

## Core Concept

- **Suburbs**: Private groups identified by UUID4 hashes in URLs (e.g., `/suburb/abc123-def456-...`)
- **Per-Suburb Daily Colors**: Each suburb gets its own unique random color daily at 7:00 AM
- **API Integration**: RESTful endpoints for home automation systems
- **Coordination**: Multiple households within each suburb synchronize LED colors daily

## Technical Stack

- **Framework**: Laravel 12.x (PHP 8.2+)
- **Database**: SQLite (production ready, upgradeable to PostgreSQL/MySQL)
- **Frontend**: Blade templates with shared layout (no Vue/React)
- **Caching**: Redis with comprehensive cache invalidation
- **Testing**: Pest PHP with 62 comprehensive tests
- **Color Library**: ozdemirburak/iris for RGB/HSL conversions
- **Deployment**: Laravel Forge ready

## Architecture

### Database Schema
- **suburbs**: Main suburb entities with UUID4 hashes and optional names
- **suburb_colors**: Per-suburb daily color assignments (unique per suburb+date)
- **color_palette**: LED-optimized color palette (10 predefined colors)

### Key Models
- `Suburb`: Hash generation, color assignment, cached lookups
- `SuburbColor`: Color storage with RGB/HSL conversion methods
- `ColorPalette`: Active color management with cached random selection

### API Endpoints
```
GET /api/suburb/{hash}/color               # Current color
```

### Web Routes  
```
GET /                                      # Landing page
POST /suburb/create                        # Create new suburb
GET /suburb/{hash}                         # Suburb info with API endpoints
```

## Development Status

### ✅ Completed Features
1. **Core Infrastructure**
   - Per-suburb database schema with proper relationships
   - Eloquent models with color conversion methods
   - LED-optimized color palette seeded

2. **Web Interface**  
   - Simple landing page for suburb creation
   - Suburb information page showing API endpoints
   - DRY Blade templates with shared layout structure
   - Extracted CSS to separate file for maintainability

3. **API Development**
   - RESTful API endpoints returning JSON with hex, RGB, HSL formats
   - Proper error handling for invalid suburbs/dates/missing colors
   - Home Assistant ready integration

4. **CLI Management**
   - Complete suburb management (create, list, remove)
   - Color assignment and rotation commands  
   - Interactive and batch operation modes

5. **Scheduled Tasks**
   - Daily color assignment to all suburbs at 7:00 AM
   - Configured for Laravel Forge deployment
   - Task scheduling with proper cache invalidation

6. **Caching Layer** 
   - Redis caching for improved API performance
   - Smart cache invalidation on color assignments
   - Cached suburb lookups, color data, and palette queries

7. **Testing Infrastructure**
   - Unit tests for models and utilities (19 tests)
   - Feature tests for API endpoints and web routes (25 tests)  
   - Integration tests for scheduled tasks (8 tests)
   - Caching layer tests for performance validation (9 tests)
   - **Total: 53 tests with 163 assertions - all passing**

### 🚧 Remaining Production Tasks
1. **Create custom 404/500 error pages** (medium priority)
2. **Write comprehensive README for deployment and usage** (medium priority)  
3. **Create production .env example file** (medium priority)

## Key Implementation Details

### Caching Strategy
- **Cache Keys**: `suburb:hash:{hash}`, `suburb:{hash}:color:today`
- **TTL Strategy**: 24h for suburbs, 12h for today's colors
- **Invalidation**: Automatic on color assignments, manual on palette updates
- **Pattern**: Uses Laravel's `Cache::remember()` for retrieve-or-store operations

### Color Assignment Logic
- **Timing**: Daily at 7:00 AM via Laravel scheduler
- **Selection**: Random from active color palette per suburb
- **Uniqueness**: Each suburb gets its own color (not shared globally)
- **Persistence**: Colors assigned once per day, consistent for 24 hours

### UUID Strategy
- **Format**: UUID4 with dashes for readability (36 characters)
- **Usage**: Public URLs like `/suburb/{uuid}` for easy sharing
- **Security**: 2^122 possible values provide reasonable privacy

## Development Commands

### Testing
```bash
php artisan test                    # Run full test suite (62 tests)
php artisan test --filter=Caching  # Run just caching tests
```

### Testing Commands
- Run tests using `php artisan test`

### CLI Management
```bash
php artisan suburb:create --name="Maple Street"    # Create suburb
php artisan suburb:list                            # List all suburbs  
php artisan colors:assign-daily                    # Assign today's colors
php artisan colors:assign-daily --date=2025-01-15  # Assign for specific date
```

### Development Server
```bash
php artisan serve                   # Local development server
```

## API Response Format

```json
{
  "suburb": {
    "hash": "abc123-def456-...",
    "name": "Maple Street"
  },
  "color": {
    "date": "2025-07-24",
    "hex": "#FF6B6B", 
    "name": "Soft Red",
    "rgb": {"r": 255, "g": 107, "b": 107},
    "hsl": {"h": 0, "s": 100, "l": 71}
  }
}
```

## File Structure

### Key Directories
- `/app/Models/` - Eloquent models with caching methods
- `/app/Http/Controllers/` - Web and API controllers
- `/app/Console/Commands/` - CLI management commands
- `/resources/views/` - Blade templates with shared layout
- `/tests/` - Comprehensive test suite (Unit + Feature)
- `/database/migrations/` - Database schema with proper indexes
- `/database/seeders/` - LED-optimized color palette seeder

### Important Files
- `PLAN.md` - Comprehensive project documentation and roadmap
- `CLAUDE.md` - This file - development context for Claude
- `/public/css/neighborhue.css` - Shared styles extracted from templates
- `/routes/console.php` - Task scheduling configuration (7:00 AM daily)

## Configuration

### Environment Variables
```env
APP_NAME=Neighborhue
DB_CONNECTION=sqlite
CACHE_STORE=redis  # Recommended for production
REDIS_HOST=127.0.0.1
```

### Dependencies
```bash
composer require ozdemirburak/iris  # Color conversion library
```

## Deployment Notes

- **Laravel Forge Ready**: Configured for easy deployment
- **Database**: SQLite for simplicity, easily upgradeable to PostgreSQL/MySQL  
- **Caching**: Redis recommended for production (falls back to file cache in development)
- **Scheduling**: Requires cron job for daily color assignment (`* * * * * cd /path && php artisan schedule:run`)

## Testing Strategy

- **Unit Tests**: Model methods, color conversions, cache behavior
- **Feature Tests**: API endpoints, web routes, CLI commands
- **Integration Tests**: Full workflows including caching and scheduling
- **All tests use SQLite in-memory database for speed and isolation**

## Recent Development Notes

- Successfully implemented comprehensive Redis caching with proper invalidation
- Simplified API to single endpoint `/api/suburb/{hash}/color` for current color only
- Removed color history and date-specific endpoints to reduce complexity
- All 53 tests passing including streamlined caching layer validation
- Using Laravel's recommended `Cache::remember()` pattern throughout
- Cache invalidation properly handled for periodic tasks and palette updates
- Ready for custom error pages, README documentation, and production deployment

## Code Quality

- **PSR Standards**: Following Laravel/PHP best practices
- **DRY Principle**: Shared layout templates, extracted CSS, reusable methods
- **Testing**: High test coverage with meaningful assertions
- **Documentation**: Comprehensive inline documentation and this context file
- **Security**: CSRF protection, input validation, UUID privacy, no exposed secrets