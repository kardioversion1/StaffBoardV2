# AGENTS

This repository is a TypeScript project built with Vite and tested with Vitest.
The guidelines below help contributors and tools such as CODEX work within the
codebase.

## Code style
- Use **TypeScript** with ES2020 modules.
- Indent with **2 spaces** and terminate statements with **semicolons**.
- Prefer `const`/`let` over `var` and use arrow functions when reasonable.
- Import project files via the `@/` alias (configured to `src/`).
- Document exported functions or types with brief JSDoc comments.

## Testing and build
- Run `npm test` after making changes to ensure unit tests pass.
- For changes that affect build output, run `npm run build` to verify the
  project compiles.

## Miscellaneous
- Keep modules small and focused; avoid introducing breaking API changes
  without discussion.
- Use descriptive commit messages.
