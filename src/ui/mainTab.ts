function renderZones(active: any, cfg: any, staff: Staff[], save: () => void) {
  const cont = document.getElementById('zones')!;
  cont.innerHTML = '';

  const zones: string[] = cfg.zones || [];
  zones.forEach((z: string, i: number) => {
    // Zone shell
    const section = document.createElement('section');
    section.className = 'zone-card';
    section.setAttribute('data-testid', 'zone-card');

    // Palette: prefer explicit config color; otherwise fall back to themed CSS vars
    const explicit = cfg.zoneColors?.[z];
    if (explicit) {
      section.style.background = explicit;
    } else {
      const zi = (i % 7) + 1;
      const ni = ((i + 1) % 7) + 1;
      section.style.setProperty('--zone-bg', `var(--zone-bg-${zi})`);
      section.style.setProperty('--nurse-bg', `var(--nurse-bg-${ni})`);
    }

    // Zone header
    const title = document.createElement('h2');
    title.className = 'zone-card__title';
    title.textContent = z;
    section.appendChild(title);

    // Zone body (stacked nurse tiles)
    const body = document.createElement('div');
    body.className = 'zone-card__body';

    (active.zones[z] || []).forEach((s: Slot, idx: number) => {
      const st = staff.find((n) => n.id === s.nurseId);
      if (!st) {
        console.warn('Unknown staffId', s.nurseId);
        return;
      }

      const row = document.createElement('div');
      row.className = 'nurse-row';

      const tileWrapper = document.createElement('div');
      tileWrapper.innerHTML = nurseTile(s, {
        id: st.id,
        name: st.name,
        role: st.role || 'nurse',
        type: st.type || 'other',
      } as Staff);
      row.appendChild(tileWrapper.firstElementChild!);

      const btn = document.createElement('button');
      btn.textContent = 'Manage';
      btn.className = 'btn';
      btn.addEventListener('click', () =>
        manageSlot(
          s,
          st,
          staff,
          save,
          () => renderZones(active, cfg, staff, save),
          z,
          idx,
          active,
          cfg
        )
      );
      row.appendChild(btn);

      body.appendChild(row);
    });

    section.appendChild(body);
    cont.appendChild(section);
  });
}
