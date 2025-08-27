# Changelog

- fix: normalize zone definitions and guard against invalid data
- fix: prevent full app re-render on clock tick to stop input focus loss; throttle weather updates.
- feat: seed defaults via `staff_and_zones.json` and `seedDefaults()`; enforce canonical zones.
- feat: normalize staff roles to `nurse` or `tech` with prefixed IDs (`00-`), update UI and imports.
- feat: add DTO action sending staff to offgoing for 60 min and logging in history.
- chore: add pastel zone colors and ensure canonical zones can't be removed.
- fix: ensure assigned nurses render in zone cards with graceful missing-id handling.
- feat: settings two-panel layout with scrollable roster and nurse editor.
- feat: zone color palette, DTO minutes, pinned roles toggle, privacy toggle, RSS field.
- feat: Shift Huddle mode replaces/controls Signout button (configurable).
- feat: Right sidebar width is now adjustable in Settings.
- chore: removed redundant small clock from right column.
