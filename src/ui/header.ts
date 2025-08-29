import { STATE, getConfig } from '@/state';
import { getThemeConfig, saveThemeConfig, applyTheme } from '@/state/theme';
import { deriveShift, fmtLong } from '@/utils/time';
import { manualHandoff } from '@/main';
import { openHuddle } from '@/ui/huddle';

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
  const mode = getConfig().ui?.signoutMode || 'shiftHuddle';
  const actionBtn =
    mode === 'shiftHuddle'
      ? '<button id="huddle-btn" class="btn">Shift Huddle</button>'
      : mode === 'legacySignout'
        ? '<button id="handoff" class="btn">Sign-out</button>'
        : '';
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
      ${actionBtn}
    </div>
  `;
  if (mode === 'shiftHuddle')
    document.getElementById('huddle-btn')?.addEventListener('click', () =>
      openHuddle(STATE.dateISO, shift)
    );
  else if (mode === 'legacySignout')
    document.getElementById('handoff')?.addEventListener('click', manualHandoff);
  document.getElementById('theme-toggle')!.addEventListener('click', async () => {
    const t = getThemeConfig();
    const next = t.mode === 'dark' ? 'light' : 'dark';
    await saveThemeConfig({ mode: next });
    applyTheme();
  });
}
