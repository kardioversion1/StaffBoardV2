import './nextShift.css';
import { getConfig, loadConfig } from '@/state/config';
import { seedZonesIfNeeded } from '@/seed';
import {
  buildEmptyDraft,
  loadNextDraft,
  saveNextDraft,
  publishNextDraft,
  type DraftShift,
} from '@/state/nextShift';
import { loadStaff, type Staff } from '@/state/staff';
import { type Slot } from '@/slots';
import { toDateISO, deriveShift } from '@/utils/time';
import { showToast } from '@/ui/banner';

/** Render a simple Next Shift planning page with save and publish controls. */
export async function renderNextShiftPage(root: HTMLElement): Promise<void> {
  await loadConfig();
  await seedZonesIfNeeded();
  const cfg = getConfig();
  const staff = await loadStaff();
  let draft: DraftShift | null = await loadNextDraft();
  if (!draft) {
    const tomorrow = toDateISO(new Date(Date.now() + 24 * 60 * 60 * 1000));
    draft = buildEmptyDraft(tomorrow, 'day', cfg.zones || []);
  }

  const zoneRows = (cfg.zones || [])
    .map((z) => {
      const slot = draft?.zones?.[z.name]?.[0];
      const name = slot
        ? staff.find((s) => s.id === slot.nurseId)?.name || slot.nurseId
        : '';
      return `<tr><td>${z.name}</td><td><div id="zone-${z.id}" class="zone-drop" data-zone="${z.name}" ${
        slot ? `data-nurse-id="${slot.nurseId}"` : ''
      }>${name}</div></td></tr>`;
    })
    .join('');

  root.innerHTML = `
    <section class="panel next-shift" data-testid="next-shift">
      <h3>Next Shift</h3>
      <div class="next-shift-body">
        <div class="staff-panel">
          <input id="next-search" class="input" placeholder="Search staff">
          <div class="assign-cols">
            <div id="next-nurses" class="assign-col"></div>
            <div id="next-techs" class="assign-col"></div>
          </div>
        </div>
        <div class="assign-panel">
          <table class="assignments">
            <thead><tr><th>Zone</th><th>Nurse</th></tr></thead>
            <tbody>
              ${zoneRows}
            </tbody>
          </table>
          <div class="actions">
            <label>Go Live <input type="datetime-local" id="next-go-live" value="${
              draft.publishAtISO || ''
            }"></label>
            <button id="next-save" class="btn">Save Draft</button>
            <button id="next-publish" class="btn">Publish</button>
          </div>
        </div>
      </div>
    </section>
  `;

  const nurseCol = document.getElementById('next-nurses') as HTMLElement;
  const techCol = document.getElementById('next-techs') as HTMLElement;
  const searchInput = document.getElementById('next-search') as HTMLInputElement;
  const goLiveInput = document.getElementById('next-go-live') as HTMLInputElement;

  let selected: string | null = null;
  let publishTimer: number | undefined;

  function renderStaff(filter = ''): void {
    const norm = filter.toLowerCase();
    const nurses = staff.filter(
      (s) =>
        s.role === 'nurse' &&
        (!filter || (s.name || s.id).toLowerCase().includes(norm))
    );
    const techs = staff.filter(
      (s) =>
        s.role === 'tech' &&
        (!filter || (s.name || s.id).toLowerCase().includes(norm))
    );
    nurseCol.innerHTML = nurses
      .map(
        (s) =>
          `<div class="assign-item${selected === s.id ? ' selected' : ''}" draggable="true" data-id="${s.id}">${
            s.name || s.id
          }</div>`
      )
      .join('');
    techCol.innerHTML = techs
      .map(
        (s) =>
          `<div class="assign-item${selected === s.id ? ' selected' : ''}" draggable="true" data-id="${s.id}">${
            s.name || s.id
          }</div>`
      )
      .join('');
    root.querySelectorAll('.assign-item').forEach((el) => {
      const id = (el as HTMLElement).dataset.id!;
      el.addEventListener('click', () => {
        selected = id;
        root.querySelectorAll('.assign-item').forEach((item) => {
          item.classList.toggle('selected', (item as HTMLElement).dataset.id === id);
        });
      });
      el.addEventListener('dragstart', (ev) => {
        ev.dataTransfer?.setData('text/plain', id);
      });
    });
  }

  renderStaff();
  searchInput.addEventListener('input', () => renderStaff(searchInput.value));

  root.querySelectorAll('.zone-drop').forEach((el) => {
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer?.getData('text/plain');
      if (id) {
        const s = staff.find((st) => st.id === id);
        (el as HTMLElement).textContent = s?.name || id;
        (el as HTMLElement).dataset.nurseId = id;
      }
    });
  });

  function gatherDraft(): DraftShift {
    const publishAt = goLiveInput.value || '';
    const dateISO = publishAt ? publishAt.slice(0, 10) : draft!.dateISO;
    const hhmm = publishAt ? publishAt.slice(11, 16) : '07:00';
    const shift = publishAt ? deriveShift(hhmm) : draft!.shift;
    const zones: Record<string, Slot[]> = {};
    for (const z of cfg.zones || []) {
      const el = document.getElementById(`zone-${z.id}`) as HTMLElement | null;
      const id = el?.dataset.nurseId;
      zones[z.name] = id ? [{ nurseId: id }] : [];
    }
    return {
      ...draft!,
      dateISO,
      shift,
      charge: undefined,
      triage: undefined,
      admin: undefined,
      zones,
      publishAtISO: publishAt || undefined,
    };
  }

  function schedulePublish(): void {
    if (publishTimer) clearTimeout(publishTimer);
    if (!draft?.publishAtISO) return;
    const delay = new Date(draft.publishAtISO).getTime() - Date.now();
    if (delay <= 0) {
      void publishNextDraft();
    } else {
      publishTimer = window.setTimeout(() => {
        void publishNextDraft();
      }, delay);
    }
  }

  document.getElementById('next-save')?.addEventListener('click', async () => {
    draft = gatherDraft();
    await saveNextDraft(draft);
    schedulePublish();
    if (draft.publishAtISO) {
      const start = draft.publishAtISO.slice(11, 16);
      const when = new Date(draft.publishAtISO).toLocaleString();
      showToast(`Shift saved; will publish at ${when} (start ${start})`);
    } else {
      showToast('Shift saved');
    }
  });

  document
    .getElementById('next-publish')
    ?.addEventListener('click', async () => {
      draft = gatherDraft();
      await saveNextDraft(draft);
      if (publishTimer) clearTimeout(publishTimer);
      try {
        await publishNextDraft();
      } catch (err) {
        console.error(err);
      }
    });

  schedulePublish();
}
