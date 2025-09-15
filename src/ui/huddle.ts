import {
  saveHuddle,
  getHuddle,
  submitHuddle,
  type HuddleRecord,
} from '@/history';
import { DEFAULT_HUDDLE_ITEMS } from '@/config/huddle';
import { loadStaff, type Staff } from '@/state/staff';

let record: HuddleRecord;

async function save() {
  record.recordedAtISO = new Date().toISOString();
  await saveHuddle(record);
}

export async function openHuddle(
  dateISO: string,
  shift: 'day' | 'night'
): Promise<void> {
  const staff = await loadStaff();
  record =
    (await getHuddle(dateISO, shift)) || {
      dateISO,
      shift,
      recordedAtISO: new Date().toISOString(),
      recordedBy: 'unknown',
      nedocs: 0,
      checklist: DEFAULT_HUDDLE_ITEMS.map((i) => ({ ...i, state: 'ok' })),
      notes: '',
    };
  if (record.nedocs === undefined) record.nedocs = 0;
  renderOverlay();
  wireRecorder(staff);
  wireNedocs();
  renderChecklist();
  wireNotes();
  wireTimer();
  document.getElementById('huddle-submit')!.addEventListener('click', async () => {
    await save();
    await submitHuddle(record);
    close();
  });
  document.getElementById('huddle-close')!.addEventListener('click', close);
}

function renderOverlay() {
  let wrap = document.getElementById('huddle-overlay');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'huddle-overlay';
    wrap.className = 'overlay open';
    wrap.innerHTML = `<div class="offcanvas open" role="dialog" aria-labelledby="huddle-title">
      <section class="panel h-full overflow-auto flex-col gap-8">
        <h2 id="huddle-title">Shift Huddle</h2>
        <div class="form-row">
          <label for="huddle-recorder">Completed By</label>
          <input id="huddle-recorder" class="input" list="huddle-recorder-list">
          <datalist id="huddle-recorder-list"></datalist>
        </div>
        <div class="form-row">
          <label for="huddle-nedocs">NEDOCS Score <a href="https://www.mdcalc.com/calc/3143/nedocs-score-emergency-department-overcrowding" target="_blank" rel="noopener">calc</a></label>
          <input id="huddle-nedocs" class="input" type="number" min="0" max="200" value="${record.nedocs}">
        </div>
        <div id="huddle-checklist"></div>
        <div>
          <label for="huddle-notes">Quick Notes</label>
          <textarea id="huddle-notes" class="input"></textarea>
          <div id="huddle-note-ts" class="muted"></div>
        </div>
        <div class="form-row">
          <label for="huddle-timer-min">Standup Timer</label>
          <input id="huddle-timer-min" type="number" min="2" max="5" value="2" aria-label="Timer minutes">
          <button id="huddle-timer-btn" class="btn">Start</button>
          <span id="huddle-timer-display" aria-live="polite"></span>
        </div>
        <div class="btn-row mt-auto">
          <button id="huddle-submit" class="btn">Submit</button>
          <button id="huddle-close" class="btn">Close</button>
        </div>
      </section>
    </div>`;
    document.body.appendChild(wrap);
  }
}

function renderChecklist() {
  const cont = document.getElementById('huddle-checklist')!;
  const groups: Record<string, typeof record.checklist> = {};
  record.checklist.forEach((i) => {
    (groups[i.section] = groups[i.section] || []).push(i);
  });
  cont.innerHTML = Object.entries(groups)
    .map(
      ([section, items]) => `
      <div class="huddle-section">
        <h4>${section}</h4>
        ${items
          .map(
            (item) => `
        <div class="form-row huddle-item" data-id="${item.id}">
          <label>${item.label}</label>
          <select id="hs-${item.id}">
            <option value="ok"${item.state === 'ok' ? ' selected' : ''}>OK</option>
            <option value="issue"${item.state === 'issue' ? ' selected' : ''}>Issue</option>
            <option value="na"${item.state === 'na' ? ' selected' : ''}>N/A</option>
          </select>
          <input id="hn-${item.id}" class="input" placeholder="note" value="${item.note || ''}" style="display:${
              item.state === 'issue' ? '' : 'none'
            };max-width:120px;">
        </div>`
          )
          .join('')}
      </div>`
    )
    .join('');
  record.checklist.forEach((item) => {
    const sel = document.getElementById(`hs-${item.id}`) as HTMLSelectElement;
    const note = document.getElementById(`hn-${item.id}`) as HTMLInputElement;
    sel.addEventListener('change', async () => {
      item.state = sel.value as any;
      note.style.display = item.state === 'issue' ? '' : 'none';
      await save();
    });
    note.addEventListener('blur', async () => {
      item.note = note.value;
      await save();
    });
  });
}

function wireRecorder(staff: Staff[]) {
  const input = document.getElementById('huddle-recorder') as HTMLInputElement;
  const list = document.getElementById(
    'huddle-recorder-list'
  ) as HTMLDataListElement;
  const names = staff
    .filter((s) => s.role === 'nurse')
    .map((s) => s.name || `${s.first ?? ''} ${s.last ?? ''}`.trim())
    .filter((n) => n);
  list.innerHTML = names.map((n) => `<option value="${n}"></option>`).join('');
  input.value = record.recordedBy === 'unknown' ? '' : record.recordedBy;
  input.addEventListener('blur', async () => {
    record.recordedBy = input.value || 'unknown';
    await save();
  });
}

function wireNedocs() {
  const input = document.getElementById('huddle-nedocs') as HTMLInputElement;
  input.value = String(record.nedocs);
  input.addEventListener('blur', async () => {
    const val = parseInt(input.value, 10);
    record.nedocs = isNaN(val) ? 0 : val;
    await save();
  });
}

function wireNotes() {
  const ta = document.getElementById('huddle-notes') as HTMLTextAreaElement;
  const tsEl = document.getElementById('huddle-note-ts')!;
  ta.value = record.notes || '';
  tsEl.textContent = record.recordedAtISO
    ? `Last edit: ${new Date(record.recordedAtISO).toLocaleString()}`
    : '';
  ta.addEventListener('blur', async () => {
    record.notes = ta.value;
    await save();
    tsEl.textContent = `Last edit: ${new Date(record.recordedAtISO).toLocaleString()}`;
  });
}

function wireTimer() {
  let timer: any;
  const minInput = document.getElementById('huddle-timer-min') as HTMLInputElement;
  const btn = document.getElementById('huddle-timer-btn') as HTMLButtonElement;
  const display = document.getElementById('huddle-timer-display') as HTMLElement;
  btn.addEventListener('click', () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      btn.textContent = 'Start';
      display.textContent = '';
      return;
    }
    let remaining = Math.max(2, Math.min(5, parseInt(minInput.value) || 2)) * 60;
    btn.textContent = 'Stop';
    display.textContent = fmt(remaining);
    timer = setInterval(() => {
      remaining--;
      display.textContent = fmt(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        timer = null;
        btn.textContent = 'Start';
      }
    }, 1000);
  });
  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  }
}

function close() {
  document.getElementById('huddle-overlay')?.remove();
}
