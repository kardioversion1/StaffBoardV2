# Security Policy

## Client-side storage

- The application caches data in `sessionStorage` for the active browser session.
- Cached data is cleared when a user signs out or uses the reset page.
- No persistent `localStorage` is used; data does not survive browser restarts.

These practices limit residual client storage and support HIPAA compliance.

