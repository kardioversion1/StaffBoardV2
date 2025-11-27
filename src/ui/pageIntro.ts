const INTRO_COPY: Record<string, { title: string; body: string; tips: string[] }> = {
  Board: {
    title: "Today's staffing board",
    body: 'Assign staff to rooms for the active shift and keep everyone aligned.',
    tips: ['Use “Add staff” on each zone to pick team members.', 'Undo reverses your last change.'],
  },
  NextShift: {
    title: 'Prepare the next shift',
    body: 'Stage assignments ahead of time so the next team can go live smoothly.',
    tips: ['Drag a name onto a zone, then save or publish when ready.', 'Undo reverts the last draft change.'],
  },
  History: {
    title: 'History and audits',
    body: 'Review past assignments or export records for reporting.',
    tips: ['Choose a date to load snapshots.', 'Use Export CSV to share data.'],
  },
  Settings: {
    title: 'Configure the board',
    body: 'Adjust zones, roles, and appearance to match your unit.',
    tips: ['Add or reorder zones to fit your layout.', 'Update colors so roles are easy to spot.'],
  },
};

/** Render a short intro panel with per-tab help. */
export function renderPageIntro(tabId: string): void {
  const copy = INTRO_COPY[tabId] ?? {
    title: 'Welcome',
    body: 'Assign staff to rooms for today and prepare the next shift.',
    tips: [],
  };

  let intro = document.getElementById('page-intro');
  if (!intro) {
    intro = document.createElement('section');
    intro.id = 'page-intro';
    intro.className = 'panel page-intro';
    const tabs = document.getElementById('tabs');
    if (tabs) {
      tabs.insertAdjacentElement('afterend', intro);
    } else {
      document.body.prepend(intro);
    }
  }

  const tips = copy.tips
    .map((tip) => `<li class="muted">${tip}</li>`)
    .join('');

  intro.innerHTML = `
    <div class="intro-header">
      <div>
        <div class="intro-title">${copy.title}</div>
        <p class="muted">${copy.body}</p>
      </div>
      <a class="intro-help" href="/help.html" target="_blank" rel="noreferrer">Help & tips ↗</a>
    </div>
    ${tips ? `<ul class="intro-list">${tips}</ul>` : ''}
  `;
}
