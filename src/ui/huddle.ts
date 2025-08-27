import { DB } from '@/state';

interface HuddleItem {
  text: string;
  done: boolean;
}
interface HuddleData {
  checklist: HuddleItem[];
  notes?: { text: string; ts: number };
  attendance: Record<string, boolean>;
}

const DEFAULT_ITEMS = [
  'Staffing',
  'Surge plan',
  'Code carts',
  'Stroke/Cath readiness',
  'Throughput goals',
  'Safety alerts',
];

const KEY = 'HUDDLE';
let data: HuddleData = {
  checklist: DEFAULT_ITEMS.map((t) => ({ text: t, done: false })),
  notes: { text: '', ts: 0 },
  attendance: {},
};

async function load(): Promise<void> {
  const existing = await DB.get<HuddleData>(KEY);
  if (existing) {
    data = {
      checklist:
        existing.checklist?.length
          ? existing.checklist
          : DEFAULT_ITEMS.map((t) => ({ text: t, done: false })),
      notes: existing.notes || { text: '', ts: 0 },
      attendance: existing.attendance || {},
    };
  }
}

async function save() {
  await DB.set(KEY, data);
}

export async function openHuddle(): Promise<void> {
  await load();
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
        <div id="huddle-attendance"></div>
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
  renderChecklist();
  wireNotes();
  renderAttendance();
  wireTimer();
  document.getElementById('huddle-save')!.addEventListener('click', async () => {
    await save();
    close();
  });
  document.getElementById('huddle-close')!.addEventListener('click', close);
}

function renderChecklist() {
  const cont = document.getElementById('huddle-checklist')!;
  cont.innerHTML = data.checklist
    .map(
      (item, i) => `
      <div class="form-row">
        <label for="hc-${i}">
          <input type="checkbox" id="hc-${i}"${item.done ? ' checked' : ''}>
          <input id="ht-${i}" class="input" value="${item.text}">
        </label>
      </div>`
    )
    .join('');
  data.checklist.forEach((_, i) => {
    const chk = document.getElementById(`hc-${i}`) as HTMLInputElement;
    const txt = document.getElementById(`ht-${i}`) as HTMLInputElement;
    chk.addEventListener('change', async () => {
      data.checklist[i].done = chk.checked;
      await save();
    });
    txt.addEventListener('blur', async () => {
      data.checklist[i].text = txt.value;
      await save();
    });
  });
}

function wireNotes() {
  const ta = document.getElementById('huddle-notes') as HTMLTextAreaElement;
  const tsEl = document.getElementById('huddle-note-ts')!;
  ta.value = data.notes?.text || '';
  tsEl.textContent = data.notes?.ts
    ? `Last edit: ${new Date(data.notes.ts).toLocaleString()}`
    : '';
  ta.addEventListener('blur', async () => {
    data.notes = { text: ta.value, ts: Date.now() };
    tsEl.textContent = `Last edit: ${new Date(data.notes.ts).toLocaleString()}`;
    await save();
  });
}

function renderAttendance() {
  const roles = ['Charge Nurse', 'Triage Nurse', 'Nurses', 'Techs'];
  const cont = document.getElementById('huddle-attendance')!;
  cont.innerHTML = roles
    .map(
      (r) => `
      <label><input type="checkbox" id="att-${r.replace(/\s+/g, '')}"${
        data.attendance[r] ? ' checked' : ''
      }> ${r}</label>`
    )
    .join(' ');
  roles.forEach((r) => {
    const id = `att-${r.replace(/\s+/g, '')}`;
    const cb = document.getElementById(id) as HTMLInputElement;
    cb.addEventListener('change', async () => {
      data.attendance[r] = cb.checked;
      await save();
    });
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
