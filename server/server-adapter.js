/* Include this BEFORE your app bundle: <script src="/server-adapter.js"></script> */
(function () {
  const API_BASE = window.location.origin + '/api.php';
  const API_KEY = localStorage.getItem('HEYBRE_API_KEY') || '';

  async function api(res, params = {}, method = 'GET', bodyObj = null) {
    const qs = new URLSearchParams(params).toString();
    const url = API_BASE + '?res=' + encodeURIComponent(res) + (qs ? '&' + qs : '');
    const init = { method, headers: {} };
    if (bodyObj) {
      init.headers['Content-Type'] = 'application/json';
      if (API_KEY) init.headers['X-API-Key'] = API_KEY;
      init.body = JSON.stringify(bodyObj);
    }
    const r = await fetch(url, init);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'API error');
    return j.data;
  }

  const STAFF_API = {
    getStaff: () => api('staff'),
    saveStaff: (staffObj) => api('staff', {}, 'POST', staffObj),
    deleteStaffById: (id) => api('staff', { id }, 'DELETE'),

    getConfig: () => api('config'),
    saveConfig: (cfg) => api('config', {}, 'POST', cfg),

    getActive: (dateISO, shift) => api('active', { date: dateISO, shift }),
    saveActive: (stateObj) => api('active', {}, 'POST', stateObj),

    getHistory: (dateISO) => api('history', { date: dateISO }),
    saveHistory: (snapshot) => api('history', {}, 'POST', snapshot),
    listHistoryDates: () => api('history_list'),
    historyExportUrlForDate: (date) =>
      `${window.location.origin}/api.php?res=history_export&date=${encodeURIComponent(date)}`,
    historyExportUrlForRange: (start, end) =>
      `${window.location.origin}/api.php?res=history_export&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
  };

  window.STAFF_API = STAFF_API;

  // Optional: override existing globals if present
  if (typeof window.loadStaff === 'function') window.loadStaff = async () => STAFF_API.getStaff();
  if (typeof window.saveStaff === 'function') window.saveStaff = async (s) => STAFF_API.saveStaff(s);
  if (typeof window.getConfig === 'function') window.getConfig = async () => STAFF_API.getConfig();
  if (typeof window.saveConfig === 'function') window.saveConfig = async (c) => STAFF_API.saveConfig(c);

  console.log('[heybre] server adapter ready');
})();
