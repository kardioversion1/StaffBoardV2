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

/** Extract YYYY-MM-DD from DTSTART variants (DATE, DATE-TIME, TZID, etc.) */
function extractDateISO(dtstart: string): string | null {
  // Strip parameters before colon (e.g., "DTSTART;TZID=America/New_York:20250829T070000")
  const val = dtstart.includes(':') ? dtstart.split(':', 2)[1] : dtstart;
  const digits = (val || '').replace(/[^0-9]/g, '');
  if (digits.length >= 8) {
    const y = digits.slice(0, 4);
    const m = digits.slice(4, 6);
    const d = digits.slice(6, 8);
    return `${y}-${m}-${d}`;
  }
  return null;
}

function parseICS(text: string): Event[] {
  const lines = unfoldICSLines(text);
  const events: Event[] = [];
  let current: Record<string, string> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.DTSTART && current.SUMMARY) {
        const dateISO = extractDateISO(current.DTSTART);
        if (dateISO) {
          events.push({
            date: dateISO,
            summary: icsUnescape(current.SUMMARY).trim(),
            location: icsUnescape(current.LOCATION || '').trim(),
          });
        }
      }
      current = null;
      continue;
    }
    if (current) {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const keyRaw = line.slice(0, idx);           // e.g., "DTSTART;TZID=America/New_York"
        const key = keyRaw.split(';')[0];            // -> "DTSTART"
        const value = line.slice(idx + 1);
        current[key] = value;
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

  // Try direct ICS fetch first (ByteBloc or user-provided). If it fails (CORS, network),
  // fall back to server-side proxy: /api.php?action=physicians (should return ICS).
  try {
    const res = await fetch(url, { credentials: 'omit', mode: 'cors' });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    return await res.text();
  } catch {
    // Same-origin PHP proxy (implement to read remote ICS server-side to bypass CORS).
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

    // Filter by date + location heuristics; dedupe physician names.
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

// Exported for testing
export const __test = { parseICS, extractDateISO, icsUnescape, unfoldICSLines };
