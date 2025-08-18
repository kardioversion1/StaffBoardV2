# ED Staffing Board (Vite + TypeScript)

This is a minimal rebuild of the ED Staffing Board using a modern toolchain.
It uses Vite for development, TypeScript for type safety and vanilla DOM APIs
for the UI.

## Scripts

- `npm run dev` – start the dev server
- `npm run build` – build for production
- `npm test` – run unit tests

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
      offgoing: [],
      support: { techs: [], vols: [], sitters: [] }
    }
  ])
);
```

The example above seeds a past day shift where a "robot" nurse was assigned to
zone Alpha.

## Language & Terminology

- Nurse types: home, travel, flex, charge, triage, other
- Special/pinned roles: Charge, Triage (always shown), Admin on (shown only if occupied)
- Zone types: room, hallway (HW), waiting (WR), quick (T1/T2/2), special (Unassigned, Offgoing, Admin on)
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
