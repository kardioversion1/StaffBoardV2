/* Minimal adapter to talk to the PHP API.
   Include this BEFORE your app's main script:
   <script src="server-adapter.js"></script>
*/
(function () {
  const API_BASE = (window.location.origin + '/api.php');
  const API_KEY = localStorage.getItem('HEYBRE_API_KEY') || ''; // set via DevTools once if you need writes

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

    getActive: (dateISO, shift) => api('active', { date: dateISO, shift }),
    saveActive: (stateObj) => api('active', {}, 'POST', stateObj),

    getConfig: () => api('config'),
    saveConfig: (cfg) => api('config', {}, 'POST', cfg),

    getHistory: (dateISO) => api('history', { date: dateISO }),
    saveHistory: (snapshot) => api('history', {}, 'POST', snapshot),

    getHuddles: (dateISO) => api('huddles', { date: dateISO }),
    saveHuddles: (h) => api('huddles', {}, 'POST', h),
  };

  window.STAFF_API = STAFF_API;

  // Optional: override existing globals if present
  if (typeof window.loadStaff === 'function') {
    window.loadStaff = async () => STAFF_API.getStaff();
  }
  if (typeof window.saveStaff === 'function') {
    window.saveStaff = async (s) => STAFF_API.saveStaff(s);
  }
  if (typeof window.getConfig === 'function') {
    window.getConfig = async () => STAFF_API.getConfig();
  }
  if (typeof window.saveConfig === 'function') {
    window.saveConfig = async (c) => STAFF_API.saveConfig(c);
  }

  console.log('[heybre] server adapter ready');
})();
