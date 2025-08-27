import { STATE } from '@/state';

/** Render the builder tab placeholder. */
export function renderBuilder(root: HTMLElement): void {
  root.innerHTML = '<p>Builder coming soon.</p>';
  if (STATE.locked) {
    root.innerHTML += '<p>Board is locked.</p>';
  }
}
