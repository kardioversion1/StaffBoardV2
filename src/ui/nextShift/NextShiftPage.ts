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
import { rosterStore, type Staff } from '@/state/staff';
import type { Slot } from '@/slots';
import { deriveShift } from '@/utils/time';
import { showToast } from '@/ui/banner';

const pad = (n: number): string => n.toString().padStart(2, '0');

const fmtLocal = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;

function nextShiftStartISO(now = new Date()): string {
  const schedule = [7, 11, 15, 19];
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const h of schedule) {
    if (minutes < h * 60) {
      const d = new Date(now);
      d.setHours(h, 0, 0, 0);
      return fmtLocal(d);
    }
  }
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(7, 0, 0, 0);
  return fmtLocal(d);
}

/** Render a simple Next Shift planning page with save and publish controls. */
export async function renderNextShiftPage(root: HTMLElement): Promise<void> {
  await loadConfig();
  await seedZonesIfNeeded();
  const cfg = getConfig();
  await rosterStore.load();
  const staff: Staff[] = rosterStore.active();
  let draft: DraftShift | null = await loadNextDraft();
  let undoStack: DraftShift[] = [];

  if (!draft) {
    const startISO = nextShiftStartISO();
    const dateISO = startISO.slice(0, 10);
    const hhmm = startISO.slice(11, 16);
    draft = buildEmptyDraft(dateISO, deriveShift(hhmm), cfg.zones || []);
    draft.publishAtISO = startISO;
    const end = new Date(startISO);
    end.setHours(end.getHours() + 12);
    draft.endAtISO = fmtLocal(end);
  } else {
    if (!draft.publishAtISO) {
      const startISO = nextShiftStartISO();
      draft.publishAtISO = startISO;
      draft.dateISO = startISO.slice(0, 10);
      draft.shift = deriveShift(startISO.slice(11, 16));
    }
    if (!draft.endAtISO) {
      const startISO = draft.publishAtISO || nextShiftStartISO();
      const end = new Date(startISO);
      end.setHours(end.getHours() + 12);
      draft.endAtISO = fmtLocal(end);
    }
  }

  const zoneRows = (cfg.zones || [])
    .map((z) => {
      const slot = draft?.zones?.[z.name]?.[0];
      const name = slot
        ? staff.find((s) => s.id === slot.nurseId)?.name || slot.nurseId
        : '';
      return `<tr><td>${z.name}</td><td class="zone-cell"><div id="zone-${z.id}" class="zone-drop" data-zone="${z.name}" ${
        slot ? `data-nurse-id="${slot.nurseId}"` : ''
      }>${name}</div><button class="btn zone-clear" data-zone-id="${z.id}">Clear</button></td></tr>`;
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
            <label>End Time <input type="datetime-local" id="next-end" value="${
              draft.endAtISO || ''
            }"></label>
            <button id="next-undo" class="btn" disabled>Undo last change</button>
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
  const endInput = document.getElementById('next-end') as HTMLInputElement;
  const undoBtn = document.getElementById('next-undo') as HTMLButtonElement;

  let selected: string | null = null;
  let publishTimer: number | undefined;

  const updateUndo = () => {
    undoBtn.disabled = undoStack.length === 0;
  };

  const pushUndo = () => {
    if (!draft) return;
    undoStack.push(structuredClone(draft));
    updateUndo();
  };

  const applyDraftToUI = (next: DraftShift): void => {
    draft = structuredClone(next);
    goLiveInput.value = draft.publishAtISO || '';
    endInput.value = draft.endAtISO || '';
    for (const z of cfg.zones || []) {
      const el = document.getElementById(`zone-${z.id}`) as HTMLElement | null;
      const slot = draft.zones?.[z.name]?.[0];
      if (!el) continue;
      const name = slot
        ? staff.find((s) => s.id === slot.nurseId)?.name || slot.nurseId
        : '';
      el.textContent = name;
      if (slot?.nurseId) {
        el.dataset.nurseId = slot.nurseId;
      } else {
        delete el.dataset.nurseId;
      }
      el.classList.toggle('empty', !slot);
    }
    updateUndo();
  };

  applyDraftToUI(draft);

  undoBtn.addEventListener('click', () => {
    const previous = undoStack.pop();
    updateUndo();
    if (!previous) return;
    applyDraftToUI(previous);
    showToast('Reverted last draft change');
  });

  function renderStaff(filter = ''): void {
    const norm = filter.toLowerCase();
    const nurses = staff.filter(
      (s) =>
        s.role === 'nurse' &&
        (!filter || (s.name || s.id).toLowerCase().includes(norm)),
    );
    const techs = staff.filter(
      (s) =>
        s.role === 'tech' &&
        (!filter || (s.name || s.id).toLowerCase().includes(norm)),
    );
    nurseCol.innerHTML = nurses
      .map(
        (s) =>
          `<div class="assign-item${selected === s.id ? ' selected' : ''}" draggable="true" data-id="${s.id}">${
            s.name || s.id
          }</div>`,
      )
      .join('');
    techCol.innerHTML = techs
      .map(
        (s) =>
          `<div class="assign-item${selected === s.id ? ' selected' : ''}" draggable="true" data-id="${s.id}">${
            s.name || s.id
          }</div>`,
      )
      .join('');
    root.querySelectorAll('.assign-item').forEach((el) => {
      const id = (el as HTMLElement).dataset.id!;
      el.addEventListener('click', () => {
        selected = id;
        root.querySelectorAll('.assign-item').forEach((item) => {
          item.classList.toggle(
            'selected',
            (item as HTMLElement).dataset.id === id,
          );
        });
      });
      (el as HTMLElement).addEventListener('dragstart', (ev: DragEvent) => {
        ev.dataTransfer?.setData('text/plain', id);
      });
    });
  }

  renderStaff();
  searchInput.addEventListener('input', () => renderStaff(searchInput.value));

  // Zone drag/drop
  root.querySelectorAll('.zone-drop').forEach((el) => {
    const target = el as HTMLElement;

    target.addEventListener('dragover', (e: DragEvent) => e.preventDefault());

    target.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer?.getData('text/plain');
      if (!id || !draft) return;

      pushUndo();

      const s = staff.find((st) => st.id === id);
      target.textContent = s?.name || id;
      target.dataset.nurseId = id;
      target.classList.remove('empty');

      const zoneKey = target.dataset.zone || '';
      if (!draft.zones[zoneKey]) {
        draft.zones[zoneKey] = [];
      }
      draft.zones[zoneKey] = [{ nurseId: id }];

      updateUndo();
    });
  });

  // Clear buttons
  root.querySelectorAll('.zone-clear').forEach((btn) => {
    btn.addEventListener('click', () => {
      pushUndo();
      const id = (btn as HTMLElement).dataset.zoneId;
      const zone = document.getElementById(`zone-${id}`) as HTMLElement | null;
      if (zone) {
        zone.textContent = '';
        delete zone.dataset.nurseId;
        zone.classList.add('empty');
      }
      const zoneDef = (cfg.zones || []).find((z) => String(z.id) === id);
      if (zoneDef && draft?.zones) {
        draft.zones[zoneDef.name] = [];
      }
      updateUndo();
    });
  });

  function gatherDraft(): DraftShift {
    const publishAt = goLiveInput.value || '';
    let endAt = endInput.value || '';
    if (!endAt && publishAt) {
      const d = new Date(publishAt);
      d.setHours(d.getHours() + 12);
      endAt = fmtLocal(d);
    }
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
      endAtISO: endAt || undefined,
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
    pushUndo();
    draft = gatherDraft();
    await saveNextDraft(draft);
    applyDraftToUI(draft);
    schedulePublish();
    if (draft.publishAtISO) {
      const start = draft.publishAtISO.slice(11, 16);
      const when = new Date(draft.publishAtISO).toLocaleString();
      showToast(`Shift saved; will publish at ${when} (start ${start})`);
    } else {
      showToast('Shift saved');
    }
  });

  document.getElementById('next-publish')?.addEventListener('click', async () => {
    pushUndo();
    draft = gatherDraft();
    await saveNextDraft(draft);
    applyDraftToUI(draft);
    if (publishTimer) clearTimeout(publishTimer);
    try {
      await publishNextDraft();
    } catch (err) {
      console.error(err);
    }
  });

  schedulePublish();
}
