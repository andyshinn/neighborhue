# Neighborhue API

A stateless Cloudflare Worker that returns a deterministic **shared daily color**
for a neighborhood. Devices poll one endpoint and all show the same color, which
rotates once a day at a locally chosen hour. Colors are computed from
`(neighborhood_id, day_index)` — never stored, no cron.

## Develop

```bash
pnpm install
pnpm test          # vitest (Workers pool)
pnpm dev           # wrangler dev
pnpm format        # biome format --write
pnpm check         # biome lint + format (read-only)
```

## Provision (one-time)

```bash
pnpm exec wrangler d1 create neighborhue   # copy database_id into wrangler.toml
pnpm db:generate                           # generate migrations from schema
pnpm db:migrate:local                      # apply locally
pnpm seed:local                            # seed the 7 palettes locally
```

## Deploy

```bash
pnpm db:migrate:remote
pnpm seed:remote
pnpm deploy
```

## Endpoints (`/v1`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/neighborhoods/:id` | — | Today's color (`?format=hex|rgb` for text/plain) |
| POST | `/v1/neighborhoods` | — | Create; returns `id` + `admin_secret` + `manage_url` |
| GET | `/v1/neighborhoods/:id/manage` | Bearer | Editable config |
| PATCH | `/v1/neighborhoods/:id` | Bearer | Update |
| DELETE | `/v1/neighborhoods/:id` | Bearer | Delete |
| GET | `/v1/palettes` | — | List curated palettes |

Management auth: `Authorization: Bearer <admin_secret>`. Errors: `{ "error", "message" }`.

> **Rate limiting:** apply Cloudflare dashboard rate-limiting rules to the write
> endpoints (`POST`/`PATCH`/`DELETE`). The Worker itself stays stateless.

## Home Assistant

```yaml
sensor:
  - platform: rest
    name: neighborhue
    resource: https://api.neighborhue.app/v1/neighborhoods/<your-id>
    value_template: "{{ value_json.color.hex }}"
    json_attributes_path: "$.color"
    json_attributes: [hex, rgb, hsl]
    scan_interval: 900

automation:
  - alias: "Neighborhue — apply daily color"
    trigger:
      - platform: state
        entity_id: sensor.neighborhue
    action:
      - service: light.turn_on
        target: { entity_id: light.porch }
        data:
          rgb_color: "{{ state_attr('sensor.neighborhue','rgb') }}"
```

The `color.rgb` array is a drop-in for `rgb_color:` — no parsing needed.
