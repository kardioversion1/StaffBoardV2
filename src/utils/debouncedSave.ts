let saveTimer: number | undefined;

/** Debounce a save function to reduce rapid writes. */
export function debouncedSave<T>(fn: () => T, commit: (v: T) => void, ms = 500): void {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => commit(fn()), ms);
}
