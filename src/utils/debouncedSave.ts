// utils/debounce.ts

let saveTimer: number | undefined;

/**
 * Debounce a save operation with a shared (module-level) timer.
 * Useful when multiple callers should coalesce into a single commit.
 *
 * @param fn - Producer to run when the debounce period elapses.
 * @param commit - Callback that receives the produced value.
 * @param ms - Delay before committing (default 500ms).
 */
export function debouncedSave<T>(
  fn: () => T,
  commit: (v: T) => void,
  ms = 500
): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => commit(fn()), ms) as unknown as number;
}

/**
 * Create a debounced function with its own private timer.
 * Useful when you want independent debouncers per feature/instance.
 *
 * @param fn - Producer to run when the debounce period elapses.
 * @param commit - Callback that receives the produced value.
 * @param ms - Delay before committing (default 500ms).
 * @returns A no-arg function; call it to schedule the debounced commit.
 */
export function createDebouncer<T>(
  fn: () => T,
  commit: (v: T) => void,
  ms = 500
): () => void {
  let timer: number | undefined;
  return () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => commit(fn()), ms) as unknown as number;
  };
}
