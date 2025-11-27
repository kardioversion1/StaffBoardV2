  root.querySelectorAll('.zone-drop').forEach((el) => {
    const target = el as HTMLElement;

    target.addEventListener('dragover', (e: DragEvent) => e.preventDefault());

    target.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer?.getData('text/plain');
      if (!id || !draft) return;

      pushUndo();

      const s = staff.find((st) => st.id === id);
      target.textContent = s?.name || id;
      target.dataset.nurseId = id;
      target.classList.remove('empty');

      const zoneKey = target.dataset.zone || '';
      if (!draft.zones[zoneKey]) {
        draft.zones[zoneKey] = [];
      }
      draft.zones[zoneKey] = [{ nurseId: id }];

      updateUndo();
    });
  });
