import { STATE } from "../state";
import { deriveShift, fmtLong } from "../utils/time";

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
    <div class="title">ED Staffing Board</div>
    <div class="subtitle">${fmtLong(STATE.dateISO)} • Active: ${shiftLabel}</div>
  `;
}
