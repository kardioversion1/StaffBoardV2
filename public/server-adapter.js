(function () {
  const cacheKey = (key, params) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return `staffboard:${key}${qs ? ':' + qs : ''}`;
  };

  const cache = (() => {
    try {
      const s = window.sessionStorage;
      return {
        get: (k) => s.getItem(k),
        set: (k, v) => s.setItem(k, v),
      };
    } catch {
      const m = {};
      return {
        get: (k) => (k in m ? m[k] : null),
        set: (k, v) => {
          m[k] = v;
        },
      };
    }
  })();

  async function load(key, params = {}) {
    const keyName = cacheKey(key, params);
    const qs = new URLSearchParams({ action: 'load', key, ...params });
    try {
      const res = await fetch(`/api.php?${qs.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Network');
      const data = await res.json();
      cache.set(keyName, JSON.stringify(data));
      return data;
    } catch (err) {
      const cached = cache.get(keyName);
      if (cached) return JSON.parse(cached);
      throw err;
    }
  }

  async function save(key, payload) {
    const keyName = cacheKey(key, {});
    const qs = new URLSearchParams({ action: 'save', key });
    const res = await fetch(`/api.php?${qs.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Network');
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'save failed');
    cache.set(keyName, JSON.stringify(payload));
    return j;
  }

  async function softDeleteStaff(id) {
    const qs = new URLSearchParams({ action: 'softDeleteStaff', id });
    const res = await fetch(`/api.php?${qs.toString()}`);
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || 'delete failed');
    return j;
  }

  function exportHistoryCSV(filters = {}) {
    const qs = new URLSearchParams({ action: 'exportHistoryCSV', ...filters });
    const url = `/api.php?${qs.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'history.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  var Server = { load, save, softDeleteStaff, exportHistoryCSV };
  window.Server = Server;
})();

