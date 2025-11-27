import { getConfig } from '@/state';

type IcsEvent = {
  date: string; // YYYY-MM-DD
  description: string;
};

type Assignment = {
  date: string; // start date
  endDate: string; // start date or +1 when crossing midnight
  location: string;
  shift: string;
  name: string;
  start: string; // HH:MM
  end: string; // HH:MM
  crossesMidnight: boolean;
};

const DEFAULT_CAL_URL = 'https://www.bytebloc.com/sk/?76b6a156';

/** Unescape ICS text per RFC 5545 (\, \; \, \n, \N) */
function icsUnescape(text: string): string {
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Normalize ICS folded lines into single logical lines. */
function unfoldICSLines(text: string): string[] {
  const raw = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Extract YYYY-MM-DD from DTSTART variants, converting UTC to local date. */
function extractDateISO(dtstart: string): string | null {
  const res = extractDateTime(dtstart);
  return res?.date ?? null;
}

function extractDateTime(dtstart: string): { date: string; time: string } | null {
  const val = dtstart.includes(':') ? dtstart.split(':', 2)[1] : dtstart;
  const m = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})?(Z)?)?/i.exec(val.trim());
  if (!m) return null;
  const [, y, mo, da, , hh = '00', mm = '00', ss = '00', z] = m;
  const dateObj = z
    ? new Date(Date.UTC(+y, +mo - 1, +da, +hh, +mm, +ss))
    : new Date(+y, +mo - 1, +da, +hh, +mm, +ss);
  const yyyy = String(dateObj.getFullYear()).padStart(4, '0');
  const mon = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hour = String(dateObj.getHours()).padStart(2, '0');
  const minute = String(dateObj.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mon}-${day}`, time: `${hour}:${minute}` };
}

/** Internal bag for ICS VEVENT fields. */
type IcsBag = {
  [k: string]: unknown;
};

function parseICS(text: string): IcsEvent[] {
  const lines = unfoldICSLines(text);
  const events: IcsEvent[] = [];
  let current: IcsBag | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.DTSTART) {
        const dt = extractDateTime(String(current.DTSTART));
        if (dt) {
          const description = current.DESCRIPTION ? icsUnescape(String(current.DESCRIPTION)) : '';
          events.push({ date: dt.date, description });
        }
      }
      current = null;
      continue;
    }
    if (current) {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const keyRaw = line.slice(0, idx);
        const key = keyRaw.split(';')[0];
        const value = line.slice(idx + 1);
        (current as Record<string, unknown>)[key] = value;
      }
    }
  }
  return events;
}

const normalizeTime = (raw: string): string | null => {
  const token = raw.trim().toLowerCase();
  if (!token) return null;
  if (token === 'noon') return '12:00';
  if (token === 'midnight') return '00:00';
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*(a|p|am|pm)?$/.exec(token);
  if (!m) return null;
  const [, hRaw, mmRaw = '00', suffixRaw] = m;
  let hour = Number(hRaw);
  const mins = Number(mmRaw);
  const suffix = suffixRaw?.[0];
  if (suffix === 'p' && hour < 12) hour += 12;
  if (suffix === 'a' && hour === 12) hour = 0;
  if (!suffix && hour === 24) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const formatDateLabel = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatRange24 = (start: string, end: string, crosses: boolean): string =>
  `${start}–${end}${crosses ? ' (+1d)' : ''}`;

const normalizeSectionName = (name: string): string | null => {
  if (/jewish\s*hospital/i.test(name)) return 'Jewish Hospital';
  if (/med\s*south/i.test(name)) return 'Med South';
  return null;
};

const splitSections = (description: string): { title: string; body: string }[] => {
  const sections: { title: string; body: string }[] = [];
  const matches = [...description.matchAll(/---\s*([^\n-]+?)\s*---/g)];
  if (!matches.length) return sections;

  for (let i = 0; i < matches.length; i += 1) {
    const title = matches[i][1].trim();
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? description.length : description.length;
    const body = description.slice(start, end).trim();
    sections.push({ title, body });
  }
  return sections;
};

const parseAssignmentsFromSection = (body: string, date: string, location: string): Assignment[] => {
  let normalized = body.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/^\([^)]*\)\s*/, '');
  if (!normalized) return [];
  const parts = normalized.split(/\s*,\s*/);
  const results: Assignment[] = [];

  for (const part of parts) {
    const cleaned = part.replace(/^(Downtown:|South:)/i, '').replace(/\.+$/, '').trim();
    if (!cleaned.includes('|')) continue;
    const [shiftRaw, nameRaw, rangeRaw] = cleaned.split('|').map((s) => s.trim());
    if (!shiftRaw || !nameRaw || !rangeRaw) continue;
    const [startRaw, endRaw] = rangeRaw.split(/[–—-]/).map((s) => s.trim());
    const start = normalizeTime(startRaw);
    const end = normalizeTime(endRaw);
    if (!start || !end) continue;

    const startDate = new Date(`${date}T${start}:00`);
    const endDate = new Date(`${date}T${end}:00`);
    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);

    results.push({
      date,
      endDate: endDate.toISOString().slice(0, 10),
      location,
      shift: shiftRaw,
      name: nameRaw,
      start,
      end,
      crossesMidnight: endDate.toISOString().slice(0, 10) !== date,
    });
  }
  return results;
};

function extractAssignments(events: IcsEvent[]): Assignment[] {
  const assignments: Assignment[] = [];
  for (const evt of events) {
    const sections = splitSections(evt.description);
    for (const section of sections) {
      const location = normalizeSectionName(section.title);
      if (!location) continue;
      assignments.push(...parseAssignmentsFromSection(section.body, evt.date, location));
    }
  }
  return assignments;
}

/** Fetch physician calendar text (uses proxy to bypass CORS unless same-origin). */
async function fetchPhysicianICS(): Promise<string> {
  const cfg = getConfig?.();
  const cfgUrl: unknown = cfg?.physicians?.calendarUrl;
  const rawUrl = typeof cfgUrl === 'string' && cfgUrl.trim() ? cfgUrl.trim() : DEFAULT_CAL_URL;

  try {
    const target = new URL(rawUrl, globalThis.location?.href ?? 'http://localhost');
    if (globalThis.location && target.origin === globalThis.location.origin) {
      const res = await fetch(target.toString(), { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      return await res.text();
    }
  } catch {
    /* fall through to proxy */
  }

  const proxied = await fetch('/api.php?action=physicians', { credentials: 'same-origin' });
  if (!proxied.ok) throw new Error('proxy fetch failed');
  return await proxied.text();
}

const dateToMs = (iso: string): number => new Date(`${iso}T00:00:00`).getTime();

async function loadAssignments(startDateISO: string, days: number): Promise<Assignment[]> {
  const ics = await fetchPhysicianICS();
  const events = parseICS(ics);
  const assignments = extractAssignments(events);

  const start = dateToMs(startDateISO);
  const end = start + days * 86400000;

  return assignments
    .filter((a) => {
      const t = dateToMs(a.date);
      return t >= start && t < end;
    })
    .sort(
      (a, b) => new Date(`${a.date}T${a.start}:00`).getTime() - new Date(`${b.date}T${b.start}:00`).getTime()
    );
}

/** Fetch and render physicians for the next week starting from the given date. */
export async function renderPhysicians(el: HTMLElement, dateISO: string): Promise<void> {
  const previous = el.innerHTML;
  try {
    const assignments = await loadAssignments(dateISO, 7);

    if (assignments.length === 0) {
      el.textContent = 'No physician assignments for the next 7 days.';
      return;
    }

    const items = assignments
      .map(
        (a) =>
          `<li><strong>${formatDateLabel(a.date)}</strong> – ${a.location} – ${formatRange24(
            a.start,
            a.end,
            a.crossesMidnight
          )} – ${a.name} (${a.shift})</li>`
      )
      .join('');

    el.innerHTML = `<ul class="phys-list phys-schedule">${items}</ul>`;
  } catch {
    if (previous) {
      el.innerHTML = previous;
      const warn = document.createElement('div');
      warn.className = 'phys-error';
      warn.textContent = 'Unable to load physician schedule';
      el.appendChild(warn);
    } else {
      el.textContent = 'Physician schedule unavailable';
    }
  }
}

/** Fetch physician schedules within a date range, grouped by date + location. */
export async function getUpcomingDoctors(
  startDateISO: string,
  days: number
): Promise<Record<string, Record<string, Assignment[]>>> {
  const assignments = await loadAssignments(startDateISO, days);
  const map: Record<string, Record<string, Assignment[]>> = {};

  for (const a of assignments) {
    (map[a.date] ||= {});
    const arr = (map[a.date][a.location] ||= []);
    arr.push(a);
  }

  for (const date of Object.keys(map)) {
    for (const loc of Object.keys(map[date])) {
      map[date][loc].sort((a, b) => a.start.localeCompare(b.start));
    }
  }

  return map;
}

/** Render a popup showing upcoming physicians across locations. */
export async function renderPhysicianPopup(
  startDateISO: string,
  days: number
): Promise<void> {
  try {
    const grouped = await getUpcomingDoctors(startDateISO, days);
    const dates = Object.keys(grouped).sort();

    const overlay = document.createElement('div');
    overlay.className = 'phys-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const content =
      dates.length === 0
        ? '<p>No physicians scheduled</p>'
        : dates
            .map((d) => {
              const groups = grouped[d];
              const locs = Object.keys(groups)
                .map((loc) => {
                  const rows = groups[loc]
                    .map(
                      (r) =>
                        `<tr><td>${r.shift}</td><td>${formatRange24(r.start, r.end, r.crossesMidnight)}</td><td>${r.name}</td></tr>`
                    )
                    .join('');
                  return `<div class="phys-loc">
                    <strong class="phys-loc-name">${loc}</strong>
                    <table class="phys-table">
                      <thead><tr><th>Shift</th><th>Time</th><th>Provider</th></tr></thead>
                      <tbody>${rows}</tbody>
                    </table>
                  </div>`;
                })
                .join('');
              return `<div class="phys-day">
                <strong class="phys-date">${formatDateLabel(d)}</strong>
                ${locs}
              </div>`;
            })
            .join('');

    overlay.innerHTML = `
      <div class="phys-modal">
        <div class="phys-modal-header">
          <h3 class="phys-title">Upcoming Physicians</h3>
          <button id="phys-close" class="btn btn-ghost" aria-label="Close">✕</button>
        </div>
        <div class="phys-modal-body">${content}</div>
      </div>
    `;

    const close = (): void => overlay.remove();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') close();
    });

    document.body.appendChild(overlay);
    (overlay.querySelector('#phys-close') as HTMLButtonElement)?.addEventListener('click', close);
    (overlay.querySelector('#phys-close') as HTMLButtonElement)?.focus();
  } catch {
    // no-op on failure
  }
}

/** Optional: helper to wire a button that opens the popup. */
export function attachPhysiciansButton(
  button: HTMLElement,
  startDateISO: string,
  days: number
): void {
  button.addEventListener('click', () => {
    void renderPhysicianPopup(startDateISO, days);
  });
}

// Exported for testing
export const __test = {
  parseICS,
  extractDateISO,
  icsUnescape,
  unfoldICSLines,
  normalizeTime,
  splitSections,
  parseAssignmentsFromSection,
  extractAssignments,
};
