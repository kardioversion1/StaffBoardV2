export function renderPendingTab(root: HTMLElement) {
  root.innerHTML = `
    <div class="pending-layout">
      <aside class="panel" id="pending-roster">
        <input id="roster-search" type="search" placeholder="Search nurses" />
        <ul id="roster-list"></ul>
      </aside>
      <section class="panel" id="pending-board">
        <p class="muted">Drag nurses here to assign zones.</p>
      </section>
      <aside class="panel" id="pending-inspector">
        <p class="muted">Select a nurse to see details.</p>
      </aside>
    </div>
  `;
}
