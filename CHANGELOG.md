# Changelog

- fix: prevent full app re-render on clock tick to stop input focus loss; throttle weather updates.
- feat: seed defaults via `staff_and_zones.json` and `seedDefaults()`; enforce canonical zones.
- feat: normalize staff roles to `nurse` or `tech` with prefixed IDs (`00-`), update UI and imports.
- feat: add DTO action sending staff to offgoing for 60 min and logging in history.
- chore: add pastel zone colors and ensure canonical zones can't be removed.
