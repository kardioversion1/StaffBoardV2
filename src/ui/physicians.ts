import { getConfig } from '@/state';

type Event = {
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
  end?: string;   // HH:MM
  summary: string;
  location: string;
};

const DEFAULT_CAL_URL = 'https://www.bytebloc.com/sk/?76b6a156';

/** Extract a physician's last name and format as "Dr. <Last>". */
function extractDoctor(summary: string): string | null {
  if (/Jewish\s+Hospital/i.test(summary)) return null;
  const parts = summary.split('|').map((s) => s.trim()).filter(Boolean);
  const namePart = parts.length > 1 ? parts[1] : parts[0];
  if (!namePart || /^-+$/.test(namePart)) return null;
  const clean = namePart.replace(/^Dr\.?\s+/i, '').trim();
  const last = clean.split(/\s+/).pop();
  return last ? `Dr. ${last}` : null;
}

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
  attendees: string[];
  [k: string]: unknown;
};

function parseICS(text: string): Event[] {
  const lines = unfoldICSLines(text);
  const events: Event[] = [];
  let current: IcsBag | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = { attendees: [] };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.DTSTART) {
        const dt = extractDateTime(String(current.DTSTART));
        if (dt) {
          const { date, time } = dt;
          const endDt = current.DTEND ? extractDateTime(String(current.DTEND)) : null;
          const location = icsUnescape(String(current.LOCATION || '')).trim();
          const attendees = current.attendees as string[];

          const push = (summary: string) => {
            const evt: Event = { date, time, summary, location };
            if (endDt) evt.end = endDt.time;
            events.push(evt);
          };

          if (attendees.length) {
            for (const name of attendees) push(name);
          } else if (current.DESCRIPTION) {
            const desc = icsUnescape(String(current.DESCRIPTION));
            const names = desc
              .split(/\r?\n|,|;/)
              .map((s) => s.trim())
              .filter((s) => s && !/er\s*main\s*schedule/i.test(s));
            for (const name of names) push(name);
          } else if (current.SUMMARY) {
            const sum = icsUnescape(String(current.SUMMARY)).trim();
            if (!/er\s*main\s*schedule/i.test(sum)) push(sum);
          }
        }
      }
      current = null;
      continue;
    }
    if (current) {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const keyRaw = line.slice(0, idx); // e.g., "DTSTART;TZID=America/New_York"
        const key = keyRaw.split(';')[0];  // -> "DTSTART"
        const value = line.slice(idx + 1);

        if (key === 'ATTENDEE') {
          const cnMatch = /CN=([^;:]+)/i.exec(keyRaw);
          const name = cnMatch ? icsUnescape(cnMatch[1]).replace(/^"|"$/g, '').trim() : '';
          if (name) current.attendees.push(name);
        } else {
          (current as Record<string, unknown>)[key] = value;
        }
      }
    }
  }
  return events;
}

/** Time formatting helpers (single definitions). */
const formatTime = (hhmm: string): string => {
  const [hh] = hhmm.split(':').map(Number);
  const hour = ((hh + 11) % 12) + 1;
  const suffix = hh < 12 ? 'am' : 'pm';
  return `${hour}${suffix}`;
};

const formatTimeFull = (hhmm: string): string => {
  const [hh, mm] = hhmm.split(':').map(Number);
  const hour = ((hh + 11) % 12) + 1;
  const suffix = hh < 12 ? 'AM' : 'PM';
  return `${String(hour).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${suffix}`;
};

const formatRange = (start: string, end?: string): string =>
  end ? `${formatTimeFull(start)} - ${formatTimeFull(end)}` : formatTimeFull(start);

/** Heuristics to match JH Downtown; add aliases as needed. */
const JEWISH_DOWNTOWN_PATTERNS = [
  /jewish\s*downtown/i,
  /jewish\s*hospital/i,
  /\bJH\b/i,
  /\bUofL\b.*(JH|Jewish)/i,
];

/** Heuristics to match JH South; add aliases as needed. */
const JEWISH_SOUTH_PATTERNS = [
  /jewish\s*south/i,
  /south\s*hospital/i,
  /\bJH\b.*south/i,
];

/** Normalize a raw location into a display label (e.g. "Downtown"). */
function normalizeLocation(loc: string): string | null {
  const s = loc.trim();
  if (JEWISH_DOWNTOWN_PATTERNS.some((re) => re.test(s))) return 'Downtown';
  if (JEWISH_SOUTH_PATTERNS.some((re) => re.test(s))) return 'South Hospital';
  return null;
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

/** Fetch and render physicians for the given day (Downtown only). */
export async function renderPhysicians(el: HTMLElement, dateISO: string): Promise<void> {
  try {
    const ics = await fetchPhysicianICS();
    const events = parseICS(ics);

    const docsMap = new Map<string, { name: string; time: string }>();
    for (const e of events) {
      if (e.date !== dateISO) continue;
      const loc = e.location ? normalizeLocation(e.location) : null;
      if (loc !== 'Downtown') continue;

      const parts = e.summary.split('|').map((s) => s.trim());
      const name = extractDoctor(parts[1] || parts[0]);
      if (!name) continue;

      docsMap.set(`${name}|${e.time}`, { name, time: e.time });
    }

    const docs = Array.from(docsMap.values()).sort((a, b) => a.time.localeCompare(b.time));

    if (docs.length === 0) {
      el.textContent = 'No physicians scheduled';
      return;
    }

    // If every item starts at midnight, render names without times.
    const allMidnight = docs.every((d) => d.time === '00:00');
    const items = allMidnight
      ? docs.map((d) => `<li>${d.name}</li>`).join('')
      : docs.map((d) => `<li>${formatTime(d.time)} ${d.name}</li>`).join('');

    el.innerHTML = `<ul class="phys-list">${items}</ul>`;
  } catch {
    el.textContent = 'Physician schedule unavailable';
  }
}

/** Fetch physician schedules within a date range, grouped by date + location. */
export async function getUpcomingDoctors(
  startDateISO: string,
  days: number
): Promise<Record<string, Record<string, { time: string; name: string }[]>>> {
  const ics = await fetchPhysicianICS();
  const events = parseICS(ics);

  const start = new Date(startDateISO + 'T00:00:00').getTime();
  const end = start + days * 86400000;

  const map: Record<string, Record<string, { time: string; name: string }[]>> = {};
  for (const e of events) {
    const t = new Date(e.date + 'T00:00:00').getTime();
    const locName = e.location ? normalizeLocation(e.location) : null;
    if (t >= start && t < end && locName) {
      const name = extractDoctor(e.summary.trim());
      if (name) {
        (map[e.date] ||= {});
        const arr = (map[e.date][locName] ||= []);
        if (!arr.some((r) => r.name === name && r.time === e.time)) {
          arr.push({ time: e.time, name });
        }
      }
    }
  }

  for (const d of Object.keys(map)) {
    for (const loc of Object.keys(map[d])) {
      map[d][loc].sort((a, b) => a.time.localeCompare(b.time));
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
    const ics = await fetchPhysicianICS();
    const events = parseICS(ics);

    const start = new Date(startDateISO + 'T00:00:00').getTime();
    const end = start + days * 86400000;

    const map: Record<
      string,
      Record<string, { shift: string; start: string; end: string; name: string }[]>
    > = {};

    for (const e of events) {
      const t = new Date(e.date + 'T00:00:00').getTime();
      if (t < start || t >= end) continue;

      const loc = e.location ? normalizeLocation(e.location) : null;
      if (!loc) continue;

      const parts = e.summary.split('|').map((s) => s.trim());
      const name = extractDoctor(parts[1] || parts[0]);
      if (!name) continue;

      const shift = parts.length > 1 ? parts[0] : '';
      (map[e.date] ||= {});
      (map[e.date][loc] ||= []).push({
        shift,
        start: e.time,
        end: e.end || '',
        name,
      });
    }

    const dates = Object.keys(map).sort();

    const overlay = document.createElement('div');
    overlay.className = 'phys-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const content =
      dates.length === 0
        ? '<p>No physicians scheduled</p>'
        : dates
            .map((d) => {
              const groups = map[d];
              const locs = Object.keys(groups)
                .map((loc) => {
                  const rows = groups[loc]
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map(
                      (r) =>
                        `<tr><td>${r.shift}</td><td>${formatRange(r.start, r.end)}</td><td>${r.name}</td></tr>`
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
                <strong class="phys-date">${d}</strong>
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
export const __test = { parseICS, extractDateISO, icsUnescape, unfoldICSLines };
