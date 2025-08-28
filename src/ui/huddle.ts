import { saveHuddle, getHuddle, type HuddleRecord } from '@/state/history';
import { DEFAULT_HUDDLE_ITEMS } from '@/config/huddle';

let record: HuddleRecord;

async function save() {
  record.recordedAtISO = new Date().toISOString();
  await saveHuddle(record);
}

export async function openHuddle(dateISO: string, shift: 'day' | 'night'): Promise<void> {
  record =
    (await getHuddle(dateISO, shift)) || {
      dateISO,
      shift,
      recordedAtISO: new Date().toISOString(),
      recordedBy: 'unknown',
      checklist: DEFAULT_HUDDLE_ITEMS.map((i) => ({ ...i, state: 'ok' })),
      notes: '',
    };
  renderOverlay();
  renderChecklist();
  wireNotes();
  wireTimer();
  document.getElementById('huddle-save')!.addEventListener('click', async () => {
    await save();
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
      <section class="panel" style="height:100%;overflow:auto;display:flex;flex-direction:column;gap:8px;">
        <h2 id="huddle-title">Shift Huddle</h2>
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
        <div class="btn-row" style="margin-top:auto;">
          <button id="huddle-save" class="btn">Save</button>
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
