// 図の表示（座標系のプログラムで共通に使う部品）
//   座標は X＝北、Y＝東のまま渡す。画面では北が上
//   表示のしかた mode：
//     'real'   実縮尺（全部の点が入るように縮める）
//     'deform' デフォルメ（基準点 origin から見た方向はそのまま、距離だけ縮める）
//     'local'  測点まわり（origin と測点だけを実縮尺で大きく。外の点は画面の端に矢印で出す）
//   使い方：
//     const v = FxPlot.create(要素, { mode: 'deform', origin: 'st' });
//     v.set({ points: [{ id, name, x, y, role: 'known'|'station'|'target'|'other' }],
//             lines:  [{ from, to, style: 'dash'|'solid', label }] });
//     v.focus(id) ／ v.focus(null) ／ v.fit() ／ v.setMode('real') ／ v.destroy()
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const PAD = 36;                 // 縁の余白（px）

  // ---- 計算だけ（試験しやすいように画面と分ける） ----
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  function median(a) { if (!a.length) return 0; const s = a.slice().sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  // 点を「図の座標」（u＝右、v＝上。単位は m か、デフォルメのときは仮の単位）に置く
  function place(points, mode, originId, focusId) {
    const o = points.find(p => p.id === originId);
    if (mode === 'deform' && o) {
      const others = points.filter(p => p !== o);
      const ds = others.map(p => dist(o, p));
      const tds = others.filter(p => p.role === 'target').map(p => dist(o, p)).filter(d => d > 0);
      const r0 = Math.max(median(tds.length ? tds : ds.filter(d => d > 0)) / 2, 1e-3);   // 測点までの距離の中央値の半分
      const rmax = Math.max(...ds, r0);
      const k = 1 / Math.log(1 + rmax / r0);
      return points.map(p => {
        if (p === o) return { p, u: 0, v: 0 };
        const d = dist(o, p);
        if (d === 0) return { p, u: 0, v: 0 };
        const r = Math.log(1 + d / r0) * k;            // 0〜1
        return { p, u: (p.y - o.y) / d * r, v: (p.x - o.x) / d * r };
      });
    }
    return points.map(p => ({ p, u: p.y, v: p.x }));
  }
  // 画面に収める倍率と位置（box：収めたい点、w・h：画面の大きさ）
  function fitTo(placed, w, h) {
    if (!placed.length) return { s: 1, cu: 0, cv: 0 };
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of placed) { u0 = Math.min(u0, q.u); u1 = Math.max(u1, q.u); v0 = Math.min(v0, q.v); v1 = Math.max(v1, q.v); }
    const du = Math.max(u1 - u0, 1e-6), dv = Math.max(v1 - v0, 1e-6);
    let s = Math.min((w - PAD * 2) / du, (h - PAD * 2) / dv);
    if (!Number.isFinite(s) || s <= 0) s = 1;
    if (du < 1e-5 && dv < 1e-5) s = 1;                 // 点が 1 つだけ
    return { s, cu: (u0 + u1) / 2, cv: (v0 + v1) / 2 };
  }
  // 縮尺の目盛り：画面で 60〜140 px になるきりのよい長さ（m）
  function niceBar(s) {
    const want = 100 / s, p = Math.pow(10, Math.floor(Math.log10(want)));
    for (const m of [1, 2, 5, 10]) if (m * p * s >= 60) return m * p;
    return 10 * p;
  }

  // ---- 画面 ----
  let styleDone = false;
  function addStyle() {
    if (styleDone) return; styleDone = true;
    const st = document.createElement('style');
    st.textContent = `
.fxp { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none;
  --fxp-bg: var(--panel, #fff); --fxp-fg: var(--fg, #1b1c1f); --fxp-sub: var(--sub, #5f6368); --fxp-line: var(--line, #dadce0);
  --fxp-known: #1a73e8; --fxp-station: #d93025; --fxp-target: #188038; --fxp-other: #80868b; background: var(--fxp-bg); color: var(--fxp-fg); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .fxp { --fxp-known: #8ab4f8; --fxp-station: #f28b82; --fxp-target: #81c995; } }
:root[data-theme="dark"] .fxp { --fxp-known: #8ab4f8; --fxp-station: #f28b82; --fxp-target: #81c995; }
.fxp svg { display: block; width: 100%; height: 100%; cursor: grab; }
.fxp svg.grab { cursor: grabbing; }
.fxp text { font: 12px system-ui, sans-serif; fill: var(--fxp-fg); paint-order: stroke; stroke: var(--fxp-bg); stroke-width: 3px; stroke-linejoin: round; }
.fxp .lbl-b { font-weight: bold; font-size: 13px; }
.fxp .ln { stroke-width: 1.5; fill: none; }
.fxp .ln.dash { stroke-dasharray: 6 4; }
.fxp .ln-lbl { font-size: 11px; fill: var(--fxp-sub); }
.fxp .known { fill: var(--fxp-known); stroke: var(--fxp-known); }
.fxp .station { fill: var(--fxp-station); stroke: var(--fxp-station); }
.fxp .target { fill: var(--fxp-target); stroke: var(--fxp-target); }
.fxp .other { fill: var(--fxp-other); stroke: var(--fxp-other); }
.fxp .faded { opacity: .28; }
.fxp .hole { fill: var(--fxp-bg); }
.fxp .north, .fxp .bar { stroke: var(--fxp-fg); fill: var(--fxp-fg); }
.fxp .note { font-size: 11px; fill: var(--fxp-sub); }
.fxp .edge { stroke-width: 0; }`;
    document.head.append(st);
  }
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.append(e); return e; }
  // 文字の幅のおおよそ（全角は 1、半角は 0.6 文字ぶん）
  function textW(s, size) { let w = 0; for (const ch of String(s)) w += ch.charCodeAt(0) > 0xff ? 1 : 0.6; return w * size; }

  function create(host, opt) {
    opt = opt || {};
    addStyle();
    const box = document.createElement('div'); box.className = 'fxp';
    const svg = el('svg', { role: 'img', 'aria-label': opt.label || '点の図' });
    box.append(svg); host.append(box);
    let data = { points: [], lines: [] }, mode = opt.mode || 'deform', origin = opt.origin || null, focusId = null;
    let view = null;           // { s, cu, cv }（null のときは自動で全体）
    let W = 300, H = 200;

    function placed() {
      let pts = data.points;
      const m = (mode === 'deform' || mode === 'local') && !pts.some(p => p.id === origin) ? 'real' : mode;
      return { m, list: place(pts, m === 'local' ? 'real' : m, origin, focusId) };
    }
    function autoView(m, list) {
      if (m === 'local') {
        // 器械点と測点（1 点ずつのときはその点）だけで収める
        const keep = list.filter(q => q.p.id === origin || (q.p.role === 'target' && (!focusId || q.p.id === focusId)));
        return fitTo(keep.length > 1 ? keep : list, W, H);
      }
      return fitTo(list, W, H);
    }
    function draw() {
      W = box.clientWidth || 300; H = box.clientHeight || 200;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.textContent = '';
      const { m, list } = placed();
      const v = view || autoView(m, list);
      const scr = q => ({ x: W / 2 + (q.u - v.cu) * v.s, y: H / 2 - (q.v - v.cv) * v.s });
      const pos = new Map(list.map(q => [q.p.id, Object.assign(scr(q), { p: q.p })]));
      const inView = a => a.x >= 4 && a.x <= W - 4 && a.y >= 4 && a.y <= H - 4;
      const faded = id => focusId && id !== focusId && id !== origin && (pos.get(id) || {}).p && pos.get(id).p.role === 'target';
      const taken = [];
      const free = (x, y, w, h) => !taken.some(r => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
      const gLines = el('g', {}, svg), gPts = el('g', {}, svg), gTxt = el('g', {}, svg);
      // 線（実線の字は、選んだ点か、実線が 3 本以下のときだけ書く）
      const solidCount = data.lines.filter(l => l.style !== 'dash').length;
      for (const ln of data.lines) {
        const a = pos.get(ln.from), b = pos.get(ln.to); if (!a || !b) continue;
        const cls = 'ln ' + (ln.style === 'dash' ? 'dash ' : '') + (b.p.role || 'other') + (faded(ln.to) || faded(ln.from) ? ' faded' : '');
        el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: cls, fill: 'none' }, gLines);
        if (ln.label && !(faded(ln.to) || faded(ln.from)) && (ln.style === 'dash' || (focusId ? (ln.to === focusId || ln.from === focusId) : solidCount <= 3))) {
          let mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          if (!inView({ x: mx, y: my })) continue;
          let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
          if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
          const t = el('text', { x: mx, y: my - 4, class: 'ln-lbl', 'text-anchor': 'middle', transform: 'rotate(' + ang.toFixed(1) + ' ' + mx + ' ' + my + ')' }, gTxt);
          t.textContent = ln.label;
        }
      }
      // 点（器械点・選んだ点を最後に描いて上に出す）
      const order = [...pos.values()].sort((a, b) => rank(a) - rank(b));
      function rank(a) { return a.p.id === focusId ? 3 : a.p.role === 'station' ? 2 : a.p.role === 'target' ? 1 : 0; }
      for (const a of order) {
        const role = a.p.role || 'other', f = faded(a.p.id) ? ' faded' : '', big = a.p.id === focusId;
        if (!inView(a)) {
          // 画面の外：端に矢印
          const cx = W / 2, cy = H / 2, dx = a.x - cx, dy = a.y - cy;
          const k = Math.min((W / 2 - 14) / Math.abs(dx || 1e-9), (H / 2 - 14) / Math.abs(dy || 1e-9));
          const ex = cx + dx * k, ey = cy + dy * k, an = Math.atan2(dy, dx) * 180 / Math.PI;
          el('path', { d: 'M8,0 L-6,-6 L-6,6 Z', class: role + ' edge' + f, transform: 'translate(' + ex + ',' + ey + ') rotate(' + an + ')' }, gPts);
          const t = el('text', { x: ex - Math.cos(an * Math.PI / 180) * 12, y: ey - Math.sin(an * Math.PI / 180) * 12 + 4, 'text-anchor': ex > W / 2 ? 'end' : 'start', class: f.trim() }, gTxt);
          t.textContent = a.p.name + ' →';
          continue;
        }
        if (role === 'known') el('path', { d: 'M' + a.x + ',' + (a.y - 8) + ' l7,12 l-14,0 Z', class: 'known' + f }, gPts);
        else if (role === 'station') { el('circle', { cx: a.x, cy: a.y, r: 8, class: 'station' + f }, gPts); el('circle', { cx: a.x, cy: a.y, r: 3.5, class: 'hole' }, gPts); }
        else el('circle', { cx: a.x, cy: a.y, r: big ? 7 : role === 'target' ? 5 : 4, class: role + f }, gPts);
        taken.push({ x: a.x - 8, y: a.y - 8, w: 16, h: 16 });
      }
      // 点名（重ならない位置を探す）
      for (const a of order.slice().reverse()) {
        if (!inView(a) || !a.p.name) continue;
        const size = a.p.id === focusId || a.p.role === 'station' ? 13 : 12;
        const w = textW(a.p.name, size), h = size + 2;
        const tries = [[10, -4], [10, 12], [-10 - w, -4], [-10 - w, 12], [-w / 2, -14], [-w / 2, 22]];
        let best = tries[0];
        for (const [dx, dy] of tries) { if (free(a.x + dx, a.y + dy - h + 3, w, h)) { best = [dx, dy]; break; } }
        taken.push({ x: a.x + best[0], y: a.y + best[1] - h + 3, w, h });
        const t = el('text', { x: a.x + best[0], y: a.y + best[1], class: (a.p.id === focusId || a.p.role === 'station' ? 'lbl-b ' : '') + (faded(a.p.id) ? 'faded' : '') }, gTxt);
        t.textContent = a.p.name;
      }
      // 北の矢印
      const n = el('g', { class: 'north', transform: 'translate(' + (W - 22) + ',26)' }, svg);
      el('path', { d: 'M0,-14 L6,6 L0,2 L-6,6 Z' }, n);
      const nt = el('text', { x: 0, y: 20, 'text-anchor': 'middle', style: 'font-size:11px' }, n); nt.textContent = 'N';
      // 縮尺の目盛り（デフォルメのときは出さない）
      if (m === 'deform') {
        const t = el('text', { x: 8, y: H - 8, class: 'note' }, svg); t.textContent = 'デフォルメ表示（距離は実際と違います）';
      } else {
        const len = niceBar(v.s), px = len * v.s;
        const g = el('g', { class: 'bar' }, svg);
        el('path', { d: 'M10,' + (H - 14) + ' v6 h' + px + ' v-6', fill: 'none', 'stroke-width': 1.5 }, g);
        const t = el('text', { x: 10 + px / 2, y: H - 18, 'text-anchor': 'middle', style: 'font-size:11px' }, g);
        t.textContent = (len >= 1 ? len : +len.toFixed(3)) + ' m';
        if (m === 'local') { const t2 = el('text', { x: W - 8, y: H - 8, 'text-anchor': 'end', class: 'note' }, svg); t2.textContent = '測点まわり（実縮尺）'; }
      }
    }

    // ---- 動かす・拡大縮小 ----
    const ptrs = new Map(); let pinch = null;
    function cur() { if (!view) { const { m, list } = placed(); view = autoView(m, list); } return view; }
    function zoomAt(px, py, k) {
      const v = cur();
      const u = v.cu + (px - W / 2) / v.s, vv = v.cv - (py - H / 2) / v.s;
      v.s *= k; v.cu = u - (px - W / 2) / v.s; v.cv = vv + (py - H / 2) / v.s;
      draw();
    }
    const local = e => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    svg.addEventListener('pointerdown', e => {
      svg.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, local(e)); svg.classList.add('grab');
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(b.x - a.x, b.y - a.y) }; }
    });
    svg.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId), now = local(e);
      ptrs.set(e.pointerId, now);
      if (ptrs.size === 1) { const v = cur(); v.cu -= (now.x - prev.x) / v.s; v.cv += (now.y - prev.y) / v.s; draw(); }
      else if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(b.x - a.x, b.y - a.y);
        if (pinch.d > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d);
        pinch.d = d;
      }
    });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) svg.classList.remove('grab'); };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    svg.addEventListener('dblclick', () => { view = null; draw(); });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null;
    if (ro) ro.observe(box); else window.addEventListener('resize', draw);

    return {
      set(d) { data = { points: (d && d.points) || [], lines: (d && d.lines) || [] }; draw(); },
      focus(id) { focusId = id || null; if (mode === 'local') view = null; draw(); },
      fit() { view = null; draw(); },
      setMode(m) { mode = m; view = null; draw(); },
      setOrigin(id) { origin = id; draw(); },
      get mode() { return mode; },
      get focused() { return focusId; },
      svg, redraw: draw,
      destroy() { if (ro) ro.disconnect(); box.remove(); }
    };
  }

  root.FxPlot = { create, place, fitTo, niceBar };
})(typeof globalThis !== 'undefined' ? globalThis : window);
