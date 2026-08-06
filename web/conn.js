// conn.js — shared, top-level connection error bar for every dashboard page.
//
// The dashboard is a plain local node process. It can be stopped, crash, or be killed by a stray
// `pkill` at any moment, and when that happens every page silently degrades: writes fail, queues
// stop refreshing, and the UI carries on looking healthy. That silence is the actual hazard — you
// only find out when work is already lost.
//
// This wraps fetch, so ANY page that talks to the API gets a loud, page-level error the moment the
// server stops answering, plus automatic recovery when it comes back. Pages with unsaved local
// state (the send plan) add their own detail line via BYOJBConn.setDetail().

(() => {
  if (window.BYOJBConn) return;

  const BAR_ID = 'byojb-conn-bar';
  let down = false;
  let detail = '';
  let probing = null;
  const listeners = [];

  const CSS = `
    #${BAR_ID}{position:fixed;top:0;left:0;right:0;z-index:2147483000;display:none;
      background:#e0556e;color:#fff;font:13px/1.45 -apple-system,system-ui,Segoe UI,sans-serif;
      padding:.55rem .9rem;box-shadow:0 2px 10px rgba(0,0,0,.4);}
    #${BAR_ID}.show{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;}
    #${BAR_ID} b{font-weight:700;}
    #${BAR_ID} code{background:rgba(0,0,0,.28);padding:.05rem .35rem;border-radius:4px;}
    #${BAR_ID} button{background:#fff;color:#8d1730;border:none;border-radius:7px;
      padding:.25rem .7rem;font:inherit;font-weight:700;cursor:pointer;}
    #${BAR_ID} .spacer{flex:1;}
    body.byojb-conn-down{padding-top:2.6rem;}
  `;

  function bar() {
    let el = document.getElementById(BAR_ID);
    if (el) return el;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    el = document.createElement('div');
    el.id = BAR_ID;
    document.body.appendChild(el);
    return el;
  }

  function render() {
    const el = bar();
    if (!down) {
      el.className = '';
      document.body.classList.remove('byojb-conn-down');
      return;
    }
    el.className = 'show';
    document.body.classList.add('byojb-conn-down');
    el.innerHTML = `<b>⚠ Dashboard unreachable.</b>
      <span>Changes cannot be saved to disk right now.${detail ? ' ' + detail : ''}</span>
      <span>Restart it with <code>npm run dashboard</code>.</span>
      <span class="spacer"></span>
      <button type="button">Retry</button>`;
    el.querySelector('button').onclick = () => probe(true);
  }

  // A cheap same-origin GET. /api/vocab is tiny and read-only, so probing costs nothing.
  async function probe(loud) {
    if (probing) return probing;
    probing = (async () => {
      try {
        const r = await fetch('/api/vocab', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        setDown(false);
        if (loud) location.reload();
        return true;
      } catch {
        setDown(true);
        return false;
      } finally {
        probing = null;
      }
    })();
    return probing;
  }

  function setDown(v) {
    if (down === v) return;
    down = v;
    render();
    listeners.forEach(fn => { try { fn(down); } catch { /* listener's problem */ } });
    // While down, keep checking so the bar clears itself once the server is back.
    if (down) schedule();
  }

  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { if (down) probe(false).then(() => { if (down) schedule(); }); }, 4000);
  }

  // Wrap fetch so no page has to remember to report failures. Only same-origin API calls count —
  // a failed request to some third party says nothing about our own server.
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const ours = url.startsWith('/') || url.startsWith(location.origin);
    try {
      const res = await origFetch(input, init);
      if (ours) setDown(false);
      return res;
    } catch (e) {
      // A genuine network failure — the server is gone, not just returning an error code.
      if (ours) setDown(true);
      throw e;
    }
  };

  window.BYOJBConn = {
    isDown: () => down,
    setDown,
    // Extra context shown inside the bar, e.g. "3 edits are saved in this browser."
    setDetail(text) { detail = String(text || ''); if (down) render(); },
    onChange(fn) { listeners.push(fn); },
    probe,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
})();
