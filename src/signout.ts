/** Clear session caches on sign-out. */
export function signOut(): void {
  try {
    sessionStorage.clear();
  } catch {}
}

