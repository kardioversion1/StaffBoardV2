/** Display a modal with an overview of the application and usage tips. */
export function openWelcomeModal(): void {
  if (document.getElementById('welcome-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'welcome-overlay';
  overlay.className = 'manage-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="manage-dialog" style="max-width:400px;">
      <h3>Welcome to StaffBoard</h3>
      <p>StaffBoard helps track nurse assignments and shift details.</p>
      <p>Use the tabs to navigate:</p>
      <ul>
        <li><strong>Board</strong> – monitor the live staffing board.</li>
        <li><strong>Builder</strong> – prepare upcoming shifts.</li>
        <li><strong>Settings</strong> – manage roster and customize display.</li>
        <li><strong>History</strong> – review past shifts and huddles.</li>
      </ul>
      <div class="dialog-actions">
        <button id="welcome-close" class="btn">Close</button>
      </div>
    </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  (overlay.querySelector('#welcome-close') as HTMLButtonElement)?.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
  (overlay.querySelector('#welcome-close') as HTMLButtonElement)?.focus();
}
