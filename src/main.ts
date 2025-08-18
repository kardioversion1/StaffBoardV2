import { STATE, initState } from "./state";
import { hhmmNowLocal } from "./utils/time";
import { renderHeader } from "./ui/header";
import { renderTabs } from "./ui/tabs";

export function renderAll() {
  renderHeader();
  renderTabs();
}

initState();
renderAll();
setInterval(() => {
  STATE.clockHHMM = hhmmNowLocal();
  renderAll();
}, 1000);
