import { STATE, getConfig, saveConfig, applyThemeAndScale } from '@/state';
import { deriveShift, fmtLong } from '@/utils/time';
import { manualHandoff } from '@/main';

export function renderHeader() {
  const app = document.getElementById("app")!;
  let header = document.getElementById("header");
  if (!header) {
    header = document.createElement("header");
    header.id = "header";
    app.appendChild(header);
  }
  const shift = deriveShift(STATE.clockHHMM);
  const shiftLabel = shift === "day" ? "Day (07–19)" : "Night (19–07)";
  header.innerHTML = `
    <div class="title-block">
      <div class="title">ED Staffing Board</div>
      <div class="subtitle">Active: ${shiftLabel}</div>
    </div>
    <div class="time-block">
      <div class="clock-big">${STATE.clockHHMM}</div>
      <div class="date-small">${fmtLong(STATE.dateISO)}</div>
    </div>
    <div class="actions">
      <button id="theme-toggle" class="btn">🌓</button>
      <button id="handoff" class="btn">Sign-out</button>
    </div>
  `;
  document.getElementById('handoff')!.addEventListener('click', manualHandoff);
  document.getElementById('theme-toggle')!.addEventListener('click', async () => {
    const cfg = getConfig();
    const next = cfg.theme === 'light' ? 'dark' : 'light';
    await saveConfig({ theme: next });
    applyThemeAndScale({ ...cfg, theme: next });
  });
}
