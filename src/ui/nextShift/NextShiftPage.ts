import './nextShift.css';
import { getConfig } from '@/state/config';
import {
  buildEmptyDraft,
  loadNextDraft,
  saveNextDraft,
  publishNextDraft,
  type DraftShift,
} from '@/state/nextShift';
import { loadStaff, type Staff } from '@/state/staff';
import { type Slot } from '@/slots';
import { toDateISO } from '@/utils/time';

function staffOptions(staff: Staff[], selected?: string): string {
  return (
    '<option value=""></option>' +
    staff
      .map(
        (s) =>
          `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${
            s.name || s.id
          }</option>`
      )
      .join('')
  );
}

function buildSelect(id: string, staff: Staff[], selected?: string): string {
  return `<select id="${id}">${staffOptions(staff, selected)}</select>`;
}

function readSlot(id: string): Slot | undefined {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  return el && el.value ? { nurseId: el.value } : undefined;
}

/** Render a simple Next Shift planning page with save and publish controls. */
export async function renderNextShiftPage(root: HTMLElement): Promise<void> {
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
      return `<tr><td>${z.name}</td><td>${buildSelect(
        `zone-${z.id}`,
        staff,
        slot?.nurseId
      )}</td></tr>`;
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
          <div class="fields">
            <label>Date <input type="date" id="next-date" value="${
              draft.dateISO
            }"></label>
            <label>Shift <select id="next-shift-select">
              <option value="day" ${draft.shift === 'day' ? 'selected' : ''}>Day</option>
              <option value="night" ${draft.shift === 'night' ? 'selected' : ''}>Night</option>
            </select></label>
          </div>
          <table class="assignments">
            <thead><tr><th>Role/Zone</th><th>Nurse</th></tr></thead>
            <tbody>
              <tr><td>Charge</td><td>${buildSelect(
                'charge',
                staff,
                draft.charge?.nurseId
              )}</td></tr>
              <tr><td>Triage</td><td>${buildSelect(
                'triage',
                staff,
                draft.triage?.nurseId
              )}</td></tr>
              <tr><td>Secretary</td><td>${buildSelect(
                'admin',
                staff,
                draft.admin?.nurseId
              )}</td></tr>
              ${zoneRows}
            </tbody>
          </table>
          <div class="actions">
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

  let activeSelect: HTMLSelectElement | null = null;

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
        (s) => `<div class="assign-item" data-id="${s.id}">${s.name || s.id}</div>`
      )
      .join('');
    techCol.innerHTML = techs
      .map(
        (s) => `<div class="assign-item" data-id="${s.id}">${s.name || s.id}</div>`
      )
      .join('');
    document.querySelectorAll('.assign-item').forEach((el) => {
      const id = (el as HTMLElement).dataset.id!;
      el.addEventListener('click', () => {
        if (activeSelect) {
          activeSelect.value = id;
        }
      });
    });
  }

  renderStaff();
  searchInput.addEventListener('input', () => renderStaff(searchInput.value));

  root.querySelectorAll('select').forEach((sel) => {
    sel.addEventListener('focus', () => {
      activeSelect = sel as HTMLSelectElement;
    });
  });

  function gatherDraft(): DraftShift {
    const dateISO = (document.getElementById('next-date') as HTMLInputElement)
      .value;
    const shift = (document.getElementById(
      'next-shift-select'
    ) as HTMLSelectElement).value as 'day' | 'night';
    const zones: Record<string, Slot[]> = {};
    for (const z of cfg.zones || []) {
      const slot = readSlot(`zone-${z.id}`);
      zones[z.name] = slot ? [slot] : [];
    }
    return {
      ...draft!,
      dateISO,
      shift,
      charge: readSlot('charge'),
      triage: readSlot('triage'),
      admin: readSlot('admin'),
      zones,
    };
  }

  document.getElementById('next-save')?.addEventListener('click', async () => {
    draft = gatherDraft();
    await saveNextDraft(draft);
  });

  document
    .getElementById('next-publish')
    ?.addEventListener('click', async () => {
      draft = gatherDraft();
      await saveNextDraft(draft);
      try {
        await publishNextDraft();
      } catch (err) {
        console.error(err);
      }
    });
}
