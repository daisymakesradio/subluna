// ══════════════════════════════════════════════════════════════
    //  STAR CHART BACKGROUND
    // ══════════════════════════════════════════════════════════════
    (function () {
  const PROXY = 'https://signal-hazel-mu.vercel.app';
    const CACHE_PREFIX = 'subluna:star-chart|';
    const DAY_KEY = new Date().toISOString().slice(0, 10);

    // ── Persist opacity across sessions ──────────────────────────
    const OPACITY_KEY = 'subluna:star-chart-opacity';
    const savedOpacity = parseFloat(localStorage.getItem(OPACITY_KEY) || '1');
    window._starChartOpacity = savedOpacity;

    function applyOpacity(val) {
      document.documentElement.style.setProperty('--star-chart-opacity', val);
    const slider = document.getElementById('starChart-opacity-slider');
    if (slider) slider.value = val;
  }

    window.starChartSetOpacity = function (val) {
    const v = parseFloat(val);
    window._starChartOpacity = v;
    localStorage.setItem(OPACITY_KEY, v);
    applyOpacity(v);
  };

    applyOpacity(savedOpacity);

    // ── Purge star chart entries from previous days ───────────────
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_PREFIX) && !k.includes(DAY_KEY))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }

    // ── Long-press topbar to reveal slider ───────────────────────
    let _holdTimer = null;
    document.addEventListener('DOMContentLoaded', function () {
    const topbar = document.getElementById('subluna-topbar');
    const ctrl   = document.getElementById('starChart-opacity-ctrl');
    if (!topbar || !ctrl) return;

    function startHold() {_holdTimer = setTimeout(() => ctrl.classList.add('visible'), 600); }
    function endHold()   {clearTimeout(_holdTimer); }
    topbar.addEventListener('mousedown',  startHold);
    topbar.addEventListener('touchstart', startHold, {passive: true });
    topbar.addEventListener('mouseup',    endHold);
    topbar.addEventListener('touchend',   endHold);
    document.addEventListener('pointerdown', function (e) {
      if (!ctrl.contains(e.target) && !topbar.contains(e.target)) {
      ctrl.classList.remove('visible');
      }
    });
  });

    // ── Fetch star chart image ────────────────────────────────────
    function normalizeStarChartDate(value) {
    if (!value) return new Date().toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value.includes('/')) {
      const [mo, day, y] = value.split('/');
    if (mo && day && y) return `${y}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return new Date().toISOString().slice(0, 10);
  }

      async function loadStarChart(opts = {}) {
        const el = document.getElementById('starChart-bg');
        if (!el) return;

        function applyChartImage(url) {
          el.style.backgroundImage = `url('${url}')`;
          const bbEl = document.getElementById('bb-bg-chart');
          if (bbEl) bbEl.style.backgroundImage = `url('${url}')`;
        }

        try {
          // Only fall back to signal_recent_chart if no opts were passed directly
          const stored = (opts.rising || opts.lat || opts.lng || opts.date)
            ? null
            : JSON.parse(localStorage.getItem('signal_recent_chart') || 'null');
          const rising = opts.rising || window.STATE?.rising || stored?.rising || '';
          const lat = opts.lat || stored?.lat || '0';
          const lng = opts.lng || stored?.lng || '0';
          const date = opts.date || normalizeStarChartDate(stored?.date);

          // No chart data available yet — leave default moon background
          if (!rising) {
            console.log('[star-chart] no rising sign yet, skipping');
            return;
          }

          const cacheKey = [DAY_KEY, rising, lat, lng, date].join('|');
          const storageKey = CACHE_PREFIX + cacheKey;

          console.log('[star-chart] loading — rising:', rising, 'lat:', lat, 'lng:', lng, 'force:', !!opts.force);

          if (!opts.force) {
            try {
              const cached = JSON.parse(localStorage.getItem(storageKey) || 'null');
              if (cached?.imageUrl) {
                console.log('[star-chart] serving from cache, constellation:', cached.name);
                applyChartImage(cached.imageUrl);
                return;
              }
            } catch (e) { /* ignore bad cache */ }
          }

          const params = new URLSearchParams({ target: 'star-chart', rising, lat, lng, date });
          console.log('[star-chart] fetching:', params.toString());
          const r = await fetch(`${PROXY}/api/chat?${params}`);
          if (!r.ok) { console.warn('[star-chart] proxy error', r.status); return; }
          const data = await r.json();
          console.log('[star-chart] response:', data);
          if (!data.imageUrl) { console.warn('[star-chart] no imageUrl in response', data); return; }
          applyChartImage(data.imageUrl); el.style.opacity = '1';
          localStorage.setItem(storageKey, JSON.stringify({ imageUrl: data.imageUrl, name: data.name, rising, lat, lng, date }));
          console.log('[star-chart] done — constellation:', data.name);
        } catch (e) {
          console.warn('[star-chart] fetch failed:', e.message);
        }
      }

    window.loadStarChart = loadStarChart;

    // ── Daily default sky chart (no user data) ────────────────────
    const DAILY_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                         'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    const DAILY_LATS  = ['51.5','40.7','35.6','48.8','-33.8','19.4','55.7','1.3','23.1','-23.5'];
    const DAILY_LNGS  = ['-0.1','-74.0','139.6','2.3','151.2','-99.1','12.5','103.8','72.8','-46.6'];

    function loadDailyStarChart() {
      const dayNum = Math.floor(Date.now() / 86400000);
      const rising = DAILY_SIGNS[dayNum % 12];
      const lat    = DAILY_LATS[dayNum % DAILY_LATS.length];
      const lng    = DAILY_LNGS[dayNum % DAILY_LNGS.length];
      console.log('[daily-chart] loading — rising:', rising, 'lat:', lat, 'lng:', lng);
      loadStarChart({ rising, lat, lng, date: DAY_KEY, force: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadDailyStarChart);
    } else {
      loadDailyStarChart();
    }

})();
