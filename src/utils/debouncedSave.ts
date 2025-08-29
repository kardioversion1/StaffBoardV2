/** Create a debounced function with its own timer. */
export function createDebouncer<T>(
  fn: () => T,
  commit: (v: T) => void,
  ms = 500
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => commit(fn()), ms);
  };
}

