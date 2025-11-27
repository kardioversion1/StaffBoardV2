function manageSlot(
  slot: Slot,
  st: Staff,
  staffList: Staff[],
  save: () => void,
  rerender: () => void,
  zone: string,
  index: number,
  board: ActiveBoard,
  cfg: Config,
  beforeChange: () => void = () => {}
): void {
  const startValue = slot.startHHMM || State.STATE.clockHHMM;
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const duration = cfg.shiftDurations?.[State.STATE.shift] ?? 12;
  let endValue = slot.endTimeOverrideHHMM && /^\d{4}$/.test(slot.endTimeOverrideHHMM)
    ? slot.endTimeOverrideHHMM.replace(/(\d{2})(\d{2})/, '$1:$2')
    : slot.endTimeOverrideHHMM || '';
  if (!endValue && startValue) {
    const [sh, sm] = startValue.split(':').map(Number);
    const end = new Date();
    end.setHours(sh + duration, sm);
    endValue = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'manage-overlay';
  overlay.innerHTML = `
    <div class="manage-dialog">
      <div class="manage-header">
        <div class="role-chip">${st.role === 'nurse' ? 'RN' : 'TECH'}</div>
        <h3>${st.name || labelFromId(st.id)}</h3>
        <div class="staff-type">${st.type}</div>
      </div>
      <div class="manage-grid">
        <div class="manage-col">
          <label>Start <input id="mg-start" type="time" value="${startValue}" disabled></label>
          <label>End <input id="mg-end" type="time" required value="${endValue}"></label>
          <label>RF <input id="mg-rf" type="number" value="${st.rf ?? ''}"></label>
        </div>
        <div class="manage-col">
          <label class="mod"><span class="icon">🎓</span><input id="mg-student" placeholder="Student" value="${typeof slot.student === 'string' ? slot.student : ''}"></label>
          <label class="mod"><span class="icon">☕</span><input type="checkbox" id="mg-break" ${slot.break?.active ? 'checked' : ''}/> Break</label>
          <label class="mod"><span class="icon">🔥</span><input type="checkbox" id="mg-high" ${slot.highAcuityUntil && slot.highAcuityUntil > Date.now() ? 'checked' : ''}/> High acuity</label>
          <label class="mod">Zone <select id="mg-zone">
            ${(cfg.zones || [])
              .map((z: any) => `<option value="${z.name}"${z.name === zone ? ' selected' : ''}>${z.name}</option>`)
              .join('')}
          </select></label>
        </div>
      </div>
      <div class="dialog-actions">
        <button id="mg-save" class="btn">Save</button>
        <button id="mg-cancel" class="btn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#mg-cancel')!.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#mg-save')!.addEventListener('click', async () => {
    beforeChange();

    // RF value: store number if present, otherwise remove rf
    const rfVal = (overlay.querySelector('#mg-rf') as HTMLInputElement).value.trim();
    if (rfVal) {
      st.rf = Number(rfVal);
    } else {
      delete st.rf;
    }

    const studVal = (overlay.querySelector('#mg-student') as HTMLInputElement).value.trim();
    slot.student = studVal ? studVal : undefined;

    const breakChecked = (overlay.querySelector('#mg-break') as HTMLInputElement).checked;
    if (breakChecked && !slot.break?.active) startBreak(slot, {});
    if (!breakChecked && slot.break?.active) endBreak(slot);

    const highChecked = (overlay.querySelector('#mg-high') as HTMLInputElement).checked;
    slot.highAcuityUntil = highChecked ? Date.now() + 2 * 60 * 60 * 1000 : undefined;

    const endVal = (overlay.querySelector('#mg-end') as HTMLInputElement).value;
    slot.endTimeOverrideHHMM = endVal;

    const zoneSel = overlay.querySelector('#mg-zone') as HTMLSelectElement;
    if (zoneSel.value !== zone) {
      const moved = moveSlot(board, { zone, index }, { zone: zoneSel.value });
      if (moved) showBanner('Previous assignment cleared');
    }

    if (typeof rosterStore.save === 'function') {
      await rosterStore.save(staffList);
    }

    save();
    overlay.remove();
    rerender();
  });
}
