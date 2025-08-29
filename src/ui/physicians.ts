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
        const keyRaw = line.slice(0, idx);
        const key = keyRaw.split(';')[0];
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
    const res = await fetch('/api.php?action=physicians');
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

// Exported for testing if needed
export const __test = { parseICS };
