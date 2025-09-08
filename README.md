# ED Staffing Board (Vite + TypeScript)

This is a minimal rebuild of the ED Staffing Board using a modern toolchain.
It uses Vite for development, TypeScript for type safety and vanilla DOM APIs
for the UI.

## Scripts

- `npm run dev` – start the dev server
- `npm run build` – build for production (outputs to `dist/`)
- `npm run preview` – preview the production build
- `npm run precheck` – type check with `tsc --noEmit`

## Utilities

- Install dependencies: `npm ci`
- Diagnostics: visit `/diag.html`

## Roster management

The Settings tab includes an editable staff roster with JSON import/export for nurses, techs, sitters, ancillary staff, and administrators.

## Importing historical shifts

Historical board data can be preloaded by importing a JSON string.  The helper
`importHistoryFromJSON` parses the JSON and stores the result under the
`HISTORY` key in the app's IndexedDB store.

```ts
import { importHistoryFromJSON } from '@/state';

await importHistoryFromJSON(
  JSON.stringify([
    {
      dateISO: '2024-01-01',
      shift: 'day',
      zones: { Alpha: [{ nurseId: 'robot-01' }] },
      incoming: [],
      offgoing: []
    }
  ])
);
```

The example above seeds a past day shift where a "robot" nurse was assigned to
zone Alpha.

-## Language & Terminology

- Nurse types: home, travel, flex, charge, triage, other
- Special/pinned roles: Charge Nurse, Triage Nurse (always shown), Unit Secretary (shown only if occupied)
- Zone types: room, hallway (HW), waiting (WR), quick (T1/T2/2), special (Unassigned, Offgoing, Unit Secretary)
- Shift statuses: draft → onbat → live → overlap → archived
- DTO = Discretionary Time Off (displayed as “DTO” in UI)
- Privacy: main board shows First LastInitial
- Region/time: US date (MM/DD/YYYY), 24-hour clock, America/Kentucky/Louisville timezone
- US spelling throughout (color, organize, canceled)

### Banned / Auto-corrected
- “float” → flex
- “pending” → draft
- “traveler/contract” → travel
- UK spellings (colour/favour/organise/cancelled) → US spelling

## PHP API deployment

- Requires **PHP ≥ 8.0**.
- Set environment variables in cPanel or `.htaccess`:

```apache
SetEnv HEYBRE_API_KEY "REPLACE_WITH_RANDOM_LONG_STRING"
# Recommended: store JSON outside webroot
SetEnv HEYBRE_DATA_DIR "/home/<cpanel-user>/heybre-board-data"
```

- Clients must send an `X-API-Key` header matching `HEYBRE_API_KEY`.
- Make sure the data path is writable by PHP.
- Validate with:
  - `GET https://board.heybre.com/api.php?res=staff`
  - Save something from the UI and confirm `active-YYYY-MM-DD-<shift>.json` appears in the data dir.

### Local testing and troubleshooting

- Start a local API server with `php -S localhost:8000 -t server`.
- Include the required `X-API-Key` header in requests.
- Check the PHP console output for details on any `500` errors. These are often
  caused by a missing SQLite extension, an unwritable data directory, or
  invalid JSON in the request body.

## Terminology Glossary

| Canonical Term | Accepted Aliases | Disallowed Variants | Notes |
| --- | --- | --- | --- |
| staffId | nurseId | id (for staff) | Use across all payloads and DB entries |
| nurseType | type | – | Applies only when `role: 'nurse'` |
| zones | zoneList | pct flag (`pct`) | `zones` object keyed by name with `pct: boolean` |
| incoming | arrivals | arrivedFlag (`arrived`), `eta` | Use `etaISO` for timestamps |
| offgoing | departed | – | Array of `{staffId, ts}` |
| comments | huddle | handoff | `comments` = status note; `huddle` = shift note |

### Rename Map

- `nurseId` → `staffId`
- `type` → `nurseType`
- `eta` → `etaISO`

## Grep/RG Commands

```sh
rg -n "^(<<<<<<<|=======|>>>>>>>)"
rg -n "(nurseId|staffId|\"id\"\s*:)"
rg -n "\b(type|nurseType)\b"
rg -n "\b(zone|zones|pct)\b"
rg -n "\b(incoming|offgoing|arrived|eta)\b"
rg -n "\b(handoff|huddle|comments?)\b"
rg -n "\bcharge\b|\btriage\b|\badmin\b"
rg -n "\b(action|key)\b" src server
rg -n "Server\.save\(\s*'active'" src
rg -n "\bappendHistory\b"
```

## Standards & Best Practices

### TypeScript
- Enable `exactOptionalPropertyTypes` in `tsconfig.json`.
- Replace remaining `any` uses with discriminated unions.
- Centralize shared API types in `src/types`.
- Use a single debounced persistence utility (see server adapter).

### PHP
- Follow PSR-12 formatting and short array syntax.
- Return `405` on non-POST `save` requests.
- Distinguish 4xx vs 5xx responses with meaningful messages.
- Assert data and DB paths are writable before serving requests.

### Security & Ops
- Keep `Content-Security-Policy: frame-ancestors 'none'`.
- Validate `X-API-Key` exactly; no fallback.
- Log request ID and timestamp for saves.
- Document `action=ping` health check.

## Verification Plan

```sh
# Successful save
curl -i -X POST -H "Content-Type: application/json" \
  -H "X-API-Key: $API" \
  -d '{"dateISO":"2024-01-01","shift":"day","zones":{}}' \
  http://localhost/api.php?action=save&key=active

# Invalid JSON
curl -i -X POST -H "Content-Type: application/json" \
  -H "X-API-Key: $API" \
  -d '{bad json}' \
  http://localhost/api.php?action=save&key=active

# Missing date/shift
curl -i -X POST -H "Content-Type: application/json" \
  -H "X-API-Key: $API" \
  -d '{"zones":{}}' \
  http://localhost/api.php?action=save&key=active

# Data dir unwritable
chmod -w server/data
curl -i -X POST -H "Content-Type: application/json" \
  -H "X-API-Key: $API" \
  -d '{"dateISO":"2024-01-01","shift":"day","zones":{}}' \
  http://localhost/api.php?action=save&key=active
```
