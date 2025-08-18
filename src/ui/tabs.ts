import { renderMainTab } from "./mainTab";
import { renderPendingTab } from "./pendingTab";
import { renderSettingsTab } from "./settingsTab";
import { renderHistoryTab } from "./historyTab";

let active: string = "main";

export function renderTabs() {
  const app = document.getElementById("app")!;
  let nav = document.getElementById("tabs");
  if (!nav) {
    nav = document.createElement("nav");
    nav.id = "tabs";
    app.appendChild(nav);
  }
  nav.innerHTML = `
    <button data-tab="main">Main</button>
    <button data-tab="pending">Pending</button>
    <button data-tab="settings">Settings</button>
    <button data-tab="history">History</button>
  `;
  nav.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      active = btn.getAttribute("data-tab") || "main";
      renderActiveTab();
    });
  });
  renderActiveTab();
}

export function renderActiveTab() {
  const app = document.getElementById("app")!;
  let root = document.getElementById("tab-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "tab-root";
    app.appendChild(root);
  }
  root.innerHTML = "";
  switch (active) {
    case "main":
      renderMainTab(root);
      break;
    case "pending":
      renderPendingTab(root);
      break;
    case "settings":
      renderSettingsTab(root);
      break;
    case "history":
      renderHistoryTab(root);
      break;
  }
}
