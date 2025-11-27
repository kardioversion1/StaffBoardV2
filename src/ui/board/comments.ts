import type { ActiveBoard } from '@/state';

/** Create the Comments panel. */
export function createCommentsPanel(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'panel';
  section.innerHTML = `
    <h3>Comments</h3>
    <textarea id="comments" class="input" placeholder="Current Status..." data-gramm="false"></textarea>
  `;
  return section;
}

/** Wire up the comments textarea to the active board. */
export function wireComments(
  active: ActiveBoard,
  save: () => void,
  beforeChange: () => void = () => {}
): void {
  const el = document.getElementById('comments') as HTMLTextAreaElement | null;
  if (!el) return;

  el.value = active.comments || '';
  el.addEventListener('change', () => {
    beforeChange();
    active.comments = el.value.trim();
    save();
  });
}
