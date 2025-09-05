import { getConfig } from '@/state';

type Event = {
  date: string;     // YYYY-MM-DD
  summary: string;
  location: string;
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

/** Extract YYYY-MM-DD from DTSTART variants (DATE, DATE-TIME, TZID, etc.).
 *  Handles UTC timestamps (ending with `Z`) by converting them to the
 *  client's local date so events that begin late in the evening in UTC don't
 *  appear on the following day.
 */
function extractDateISO(dtstart: string): string | null {
  const val = dtstart.includes(':') ? dtstart.split(':', 2)[1] : dtstart;
  const m = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})?(Z)?)?/i.exec(
    val.trim()
  );
  if (!m) return null;
  const [, y, mo, da, , hh = '00', mm = '00', ss = '00', z] = m;
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +da, +hh, +mm, +ss))
    : new Date(+y, +mo - 1, +da, +hh, +mm, +ss);
  const yyyy = String(date.getFullYear()).padStart(4, '0');
  const mon = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mon}-${day}`;
}

function parseICS(text: string): Event[] {
  const lines = unfoldICSLines(text);
  const events: Event[] = [];
  let current: Record<string, unknown> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = { attendees: [] as string[] };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.DTSTART) {
        const dateISO = extractDateISO(String(current.DTSTART));
        if (dateISO) {
          const location = icsUnescape(String(current.LOCATION || '')).trim();
          const attendees = current.attendees as string[];
          if (attendees.length) {
            for (const name of attendees) {
              events.push({ date: dateISO, summary: name, location });
            }
          } else if (current.DESCRIPTION) {
            const desc = icsUnescape(String(current.DESCRIPTION));
            const names = desc
              .split(/\r?\n|,|;/)
              .map((s) => s.trim())
              .filter((s) => s && !/er\s*main\s*schedule/i.test(s));
            for (const name of names) {
              events.push({ date: dateISO, summary: name, location });
            }
          } else if (current.SUMMARY) {
            const sum = icsUnescape(String(current.SUMMARY)).trim();
            if (!/er\s*main\s*schedule/i.test(sum)) {
              events.push({ date: dateISO, summary: sum, location });
            }
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
        const key = keyRaw.split(';')[0]; // -> "DTSTART"
        const value = line.slice(idx + 1);

        if (key === 'ATTENDEE') {
          const cnMatch = /CN=([^;:]+)/i.exec(keyRaw);
          const name = cnMatch ? icsUnescape(cnMatch[1]).replace(/^"|"$/g, '').trim() : '';
          if (name) (current.attendees as string[]).push(name);
        } else {
          current[key] = value;
        }
      }
    }
  }
  return events;
}

/** Heuristics to match JH Downtown; add aliases as needed. */
const JEWISH_DOWNTOWN_PATTERNS = [
  /jewish\s*downtown/i,
  /jewish\s*hospital/i,
  /\bJH\b/i,
  /\bUofL\b.*(JH|Jewish)/i,
];

/** Fetches ICS text from configured URL, with a safe fallback to your PHP proxy. */
async function fetchPhysicianICS(): Promise<string> {
  const cfg = getConfig?.();
  const cfgUrl: unknown = cfg?.physicians?.calendarUrl;
  const url = (typeof cfgUrl === 'string' && cfgUrl.trim()) ? cfgUrl.trim() : DEFAULT_CAL_URL;

  try {
    const res = await fetch(url, { credentials: 'omit', mode: 'cors' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    return await res.text();
  } catch {
    const proxied = await fetch('/api.php?action=physicians', { credentials: 'same-origin' });
    if (!proxied.ok) throw new Error('proxy fetch failed');
    return await proxied.text();
  }
}

/** Fetch and render physicians for the given day. */
export async function renderPhysicians(el: HTMLElement, dateISO: string): Promise<void> {
  try {
    const ics = await fetchPhysicianICS();
    const events = parseICS(ics);

    const isJewishDowntown = (loc: string) =>
      JEWISH_DOWNTOWN_PATTERNS.some((re) => re.test(loc));

    const docsSet = new Set(
      events
        .filter((e) => e.date === dateISO && (e.location ? isJewishDowntown(e.location) : true))
        .map((e) => e.summary)
        .filter(Boolean)
    );
    const docs = Array.from(docsSet);

    if (docs.length === 0) {
      el.textContent = 'No physicians scheduled';
      return;
    }
    el.innerHTML = `<ul>${docs.map((d) => `<li>${d}</li>`).join('')}</ul>`;
  } catch {
    el.textContent = 'Physician schedule unavailable';
  }
}

/** Fetch physician schedules within a date range. */
export async function getUpcomingDoctors(
  startDateISO: string,
  days: number
): Promise<Record<string, string[]>> {
  const ics = await fetchPhysicianICS();
  const events = parseICS(ics);

  const start = new Date(startDateISO + 'T00:00:00').getTime();
  const end = start + days * 86400000;

  const isJewishDowntown = (loc: string) =>
    JEWISH_DOWNTOWN_PATTERNS.some((re) => re.test(loc));

  const map: Record<string, string[]> = {};
  for (const e of events) {
    const t = new Date(e.date + 'T00:00:00').getTime();
    if (t >= start && t < end && (e.location ? isJewishDowntown(e.location) : true)) {
      (map[e.date] ||= []).push(e.summary.trim());
    }
  }
  // De-dupe per date
  for (const d of Object.keys(map)) {
    map[d] = Array.from(new Set(map[d]));
  }
  return map;
}

/** Render a popup showing upcoming physicians. */
export async function renderPhysicianPopup(
  startDateISO: string,
  days: number
): Promise<void> {
  try {
    const data = await getUpcomingDoctors(startDateISO, days);
    const dates = Object.keys(data).sort();

    const overlay = document.createElement('div');
    overlay.className = 'phys-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const content =
      dates.length === 0
        ? '<p>No physicians scheduled</p>'
        : dates
            .map(
              (d) =>
                `<div class="phys-day">
                  <strong class="phys-date">${d}</strong>
                  <ul class="phys-list">${data[d].map((n) => `<li>${n}</li>`).join('')}</ul>
                </div>`
            )
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
  button.addEventListener('click', () => { void renderPhysicianPopup(startDateISO, days); });
}

// Exported for testing
export const __test = { parseICS, extractDateISO, icsUnescape, unfoldICSLines };
