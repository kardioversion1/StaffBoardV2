import './nextShift.css';
import { getConfig } from '@/state/config';
import { buildEmptyDraft, loadNextDraft, saveNextDraft, publishNextDraft, type DraftShift } from '@/state/nextShift';
import { toDateISO } from '@/utils/time';

/** Render a simple Next Shift planning page with save and publish controls. */
export async function renderNextShiftPage(root: HTMLElement): Promise<void> {
  const cfg = getConfig();
  let draft: DraftShift | null = await loadNextDraft();
  if (!draft) {
    const tomorrow = toDateISO(new Date(Date.now() + 24 * 60 * 60 * 1000));
    draft = buildEmptyDraft(tomorrow, 'day', cfg.zones || []);
  }

  root.innerHTML = `
    <section class="panel next-shift" data-testid="next-shift">
      <h3>Next Shift</h3>
      <div class="actions">
        <button id="next-save" class="btn">Save Draft</button>
        <button id="next-publish" class="btn">Publish</button>
      </div>
    </section>
  `;

  document.getElementById('next-save')?.addEventListener('click', async () => {
    if (draft) await saveNextDraft(draft);
  });
  document.getElementById('next-publish')?.addEventListener('click', async () => {
    if (draft) await saveNextDraft(draft);
    try {
      await publishNextDraft({ appendHistory: true });
    } catch (err) {
      console.error(err);
    }
  });
}
