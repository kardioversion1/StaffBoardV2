const CAL_URL = 'https://www.bytebloc.com/sk/?76b6a156';

type Event = {
  date: string;
  summary: string;
  location: string;
};

function parseICS(text: string): Event[] {
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  const events: Event[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
    } else if (line === 'END:VEVENT') {
      if (current?.DTSTART && current.SUMMARY) {
        const d = current.DTSTART.replace(/[^0-9]/g, '').slice(0, 8);
        const dateISO = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
        events.push({
          date: dateISO,
          summary: current.SUMMARY,
          location: current.LOCATION || '',
        });
      }
      current = null;
    } else if (current) {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const key = line.slice(0, idx);
        const value = line.slice(idx + 1);
        current[key] = value;
      }
    }
  }
  return events;
}

/** Fetch and render physicians for the given day. */
export async function renderPhysicians(el: HTMLElement, dateISO: string): Promise<void> {
  try {
    const res = await fetch(CAL_URL);
    if (!res.ok) throw new Error('failed');
    const ics = await res.text();
    const events = parseICS(ics);
    const docs = events
      .filter((e) => e.date === dateISO && /jewish downtown/i.test(e.location))
      .map((e) => e.summary.trim());
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
  const res = await fetch(CAL_URL);
  if (!res.ok) throw new Error('failed');
  const ics = await res.text();
  const events = parseICS(ics);
  const start = new Date(startDateISO).getTime();
  const end = start + days * 86400000;
  const map: Record<string, string[]> = {};
  for (const e of events) {
    const t = new Date(e.date).getTime();
    if (t >= start && t < end && /jewish downtown/i.test(e.location)) {
      map[e.date] ||= [];
      map[e.date].push(e.summary.trim());
    }
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
    const overlay = document.createElement('div');
    overlay.className = 'phys-overlay';
    const dates = Object.keys(data).sort();
    const content =
      dates.length === 0
        ? '<p>No physicians scheduled</p>'
        : dates
            .map(
              (d) =>
                `<div><strong>${d}</strong><ul>${data[d]
                  .map((n) => `<li>${n}</li>`)
                  .join('')}</ul></div>`
            )
            .join('');
    overlay.innerHTML = `
      <div class="phys-modal">
        <button id="phys-close" class="btn">Close</button>
        ${content}
      </div>
    `;
    document.body.appendChild(overlay);
    const close = (): void => overlay.remove();
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('#phys-close')!.addEventListener('click', close);
  } catch {
    // no-op on failure
  }
}

// Exported for testing if needed
export const __test = { parseICS };
