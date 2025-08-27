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
- Reset local data: visit `/reset.html`
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
