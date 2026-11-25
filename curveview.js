// 曲線の測量の図（全体・拡大）と推進管の次回予測の表 — 電卓の「曲線の測量」（SENTEI のあと）で使う
//   FxCurveView.open({ g: FxSenkei.build の答え, pts: [{ name, x, y, j }], pred: FxSenkei.predict の答え＋j }, onClose)
//   座標は X＝北（上）、Y＝東（右）。線形＝青、IP を結ぶ線＝赤、測点＝黄、予測＝緑
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const W = 340, H = 340, PAD = 26;
  const f3 = v => (Math.round(v * 1000) / 1000).toFixed(3);
  const mmText = j => {
    if (!j || !Number.isFinite(j.offset)) return '―';
    const mm = Math.round(Math.abs(j.offset) * 1000);
    return mm === 0 ? '中心' : (j.offset > 0 ? '右 ' : '左 ') + mm + ' mm';
  };
  const secName = j => j ? j.name.replace(/\s*[左右]$/, '') + (j.priority >= 8 ? '（範囲外）' : '') : '―';

  // 線形を線の並びに（曲線は細かく折れ線にする）
  function alignmentPaths(g) {
    const lines = [];
    for (const s of g.sections) lines.push([s.a, s.b]);
    for (const c of g.curves) {
      const s = Math.atan2(c.bc.y - c.ro.y, c.bc.x - c.ro.x), sweep = c.dir === 'R' ? c.IA : -c.IA;
      const n = Math.max(12, Math.ceil(Math.abs(c.IA) * 180 / Math.PI));
      const arc = [];
      for (let i = 0; i <= n; i++) { const t = s + sweep * i / n; arc.push({ x: c.ro.x + c.R * Math.cos(t), y: c.ro.y + c.R * Math.sin(t) }); }
      lines.push(arc);
    }
    const ipLine = g.points.filter(p => /^(BP|IP\d+|EP)$/.test(p.name));
    return { lines, ipLine };
  }
  // きりのよい目盛りの間隔（m）
  function niceStep(span) {
    const want = span / 6, p = Math.pow(10, Math.floor(Math.log10(want)));
    for (const m of [1, 2, 5, 10]) if (m * p >= want) return m * p;
    return 10 * p;
  }
  function el(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  // 図（1 画面）。指：二本指ピンチ＝拡大・縮小、二本指スワイプ＝移動、二本指ダブルタップ＝全体、一本指ダブルタップ＝拡大
  //   マウス：ドラッグ＝移動、ホイール＝拡大・縮小、ダブルクリック＝拡大
  function zoomView(data, paths, boxAll, boxNear) {
    const svg = el('svg', { class: 'cv-svg cv-zoom', role: 'img', 'aria-label': '曲線の測量の図' });
    let W = 340, H = 340, view = null;
    function fit(box, minSpan) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of box) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const s = Math.min((W - PAD * 2) / Math.max(y1 - y0, minSpan), (H - PAD * 2) / Math.max(x1 - x0, minSpan));
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s };
    }
    const fitAll = () => { view = fit(boxAll, 5); draw(); };
    const fitNear = () => { view = fit(boxNear, 2); draw(); };
    function size() {
      const r = svg.getBoundingClientRect();
      W = Math.max(200, Math.round(r.width) || 340); H = Math.max(200, Math.round(r.height) || 340);
    }
    function draw() {
      size();
      if (!view) view = fit(boxNear, 2);
      const { cx, cy, s } = view;
      const px = p => W / 2 + (p.y - cy) * s, py = p => H / 2 - (p.x - cx) * s;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      while (svg.firstChild) svg.firstChild.remove();
      // 目盛り（X・Y の値を縁に）
      const step = niceStep(Math.min(W, H) / s), gx0 = cx - H / 2 / s, gx1 = cx + H / 2 / s, gy0 = cy - W / 2 / s, gy1 = cy + W / 2 / s;
      const dec = step < 1 ? (step < 0.1 ? (step < 0.01 ? 3 : 2) : 1) : 0;
      for (let v = Math.ceil(gx0 / step) * step; v <= gx1; v += step) {
        const y = py({ x: v }).toFixed(1);
        svg.append(el('line', { x1: 0, x2: W, y1: y, y2: y, class: 'cv-grid' }), el('text', { x: 2, y: +y - 2, class: 'cv-tick' }, v.toFixed(dec)));
      }
      for (let v = Math.ceil(gy0 / step) * step; v <= gy1; v += step) {
        const x = px({ y: v }).toFixed(1);
        svg.append(el('line', { y1: 0, y2: H, x1: x, x2: x, class: 'cv-grid' }), el('text', { x: +x + 2, y: H - 3, class: 'cv-tick' }, v.toFixed(dec)));
      }
      const poly = (pts, cls) => svg.append(el('polyline', { points: pts.map(p => px(p).toFixed(1) + ',' + py(p).toFixed(1)).join(' '), class: cls }));
      if (paths.ipLine.length > 1) poly(paths.ipLine, 'cv-ip');
      for (const l of paths.lines) poly(l, 'cv-al');
      // 管の向き（1 本目：測点2→1、2 本目：測点4→3）と予測へ進む線
      const P = data.pts;
      if (P.length >= 2) poly([P[1], P[0]], 'cv-pipe');
      if (P.length >= 4) poly([P[3], P[2]], 'cv-pipe');
      if (data.pred && P.length) poly([P[0], data.pred], 'cv-predline');
      // 点が近すぎて文字が重なるときは番号だけ
      const marks = P.concat(data.pred ? [data.pred] : []);
      let close = false;
      for (let i = 0; i < marks.length; i++) for (let k = i + 1; k < marks.length; k++)
        if (Math.abs(py(marks[i]) - py(marks[k])) < 16 && Math.abs(px(marks[i]) - px(marks[k])) < 120) close = true;
      const label = (p, text, cls) => {
        const x = px(p), y = py(p), left = x > W - 110;
        svg.append(el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 5, class: cls }));
        svg.append(el('text', { x: (left ? x - 8 : x + 8).toFixed(1), y: (y + 4).toFixed(1), class: 'cv-label', 'text-anchor': left ? 'end' : 'start' }, text));
      };
      P.forEach((p, i) => label(p, close ? String(i + 1) : (i + 1) + '　' + mmText(p.j), 'cv-pt'));
      if (data.pred) label(data.pred, close ? '予測' : '予測　' + mmText(data.pred.j), 'cv-pred');
      svg.append(el('text', { x: W - 4, y: 16, class: 'cv-north' }, '↑北(X)'));
    }
    // 画面の点（svg の中の px）を固定したまま倍率を変える
    function zoomAt(sx, sy, k, base) {
      const v = base || view;
      const wx = v.cx + (sy - H / 2) / v.s, wy = v.cy + (sx - W / 2) / v.s;
      const s = Math.min(Math.max(v.s * k, 0.05), 200000);
      view = { s, cx: wx - (sy - H / 2) / s, cy: wy - (sx - W / 2) / s };
    }
    const local = e => { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const ptrs = new Map();
    let two = null, multi = false, lastTap = null, lastTwoTap = 0;
    svg.addEventListener('pointerdown', e => {
      try { svg.setPointerCapture(e.pointerId); } catch (_) { /* 取れなくても動く */ }
      const p = local(e);
      ptrs.set(e.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y, t0: Date.now(), type: e.pointerType });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        multi = true;
        two = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: Object.assign({}, view), t: Date.now(), moved: false };
      }
      e.preventDefault();
    });
    svg.addEventListener('pointermove', e => {
      const q = ptrs.get(e.pointerId); if (!q) return;
      const p = local(e), dx = p.x - q.x, dy = p.y - q.y;
      q.x = p.x; q.y = p.y;
      if (ptrs.size === 2 && two) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (Math.abs(d - two.d0) > 8 || Math.hypot(m.x - two.m0.x, m.y - two.m0.y) > 8) two.moved = true;
        // ピンチ（指の間の長さ）で倍率、指の中点の動きで移動
        zoomAt(two.m0.x, two.m0.y, d / two.d0, two.v0);
        view.cy -= (m.x - two.m0.x) / view.s; view.cx += (m.y - two.m0.y) / view.s;
        draw();
      } else if (ptrs.size === 1 && !multi && q.type !== 'touch' && (e.buttons & 1)) {
        view.cy -= dx / view.s; view.cx += dy / view.s; draw();   // マウスはドラッグで移動
      }
    });
    function up(e) {
      const q = ptrs.get(e.pointerId); if (!q) return;
      ptrs.delete(e.pointerId);
      const now = Date.now();
      if (multi) {
        if (!ptrs.size) {
          if (two && !two.moved && now - two.t < 350) {
            if (now - lastTwoTap < 450) { lastTwoTap = 0; fitAll(); }   // 二本指ダブルタップ＝全体
            else lastTwoTap = now;
          }
          two = null; multi = false;
        }
        return;
      }
      if (e.type === 'pointercancel') return;
      const moved = Math.hypot(q.x - q.x0, q.y - q.y0) > 10;
      if (moved || now - q.t0 > 350) { lastTap = null; return; }
      if (lastTap && now - lastTap.t < 350 && Math.hypot(q.x - lastTap.x, q.y - lastTap.y) < 30) {
        lastTap = null; zoomAt(q.x, q.y, 2); draw();   // 一本指ダブルタップ＝拡大
      } else lastTap = { t: now, x: q.x, y: q.y };
    }
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015)); draw(); }, { passive: false });
    if (root.ResizeObserver) new ResizeObserver(() => draw()).observe(svg);
    const btn = (t, f) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'dlg-btn'; b.textContent = t; b.addEventListener('click', f); return b; };
    const center = k => { zoomAt(W / 2, H / 2, k); draw(); };
    const bar = document.createElement('div'); bar.className = 'cv-zoombar';
    bar.append(btn('全体', fitAll), btn('測点まわり', fitNear), btn('＋', () => center(2)), btn('－', () => center(0.5)));
    const hint = document.createElement('p'); hint.className = 'cv-note';
    hint.textContent = '二本指でピンチ＝拡大・縮小、二本指で動かす＝移動、二本指でダブルタップ＝全体、一本指でダブルタップ＝拡大（マウスはドラッグ・ホイール・ダブルクリック）';
    const wrap = document.createElement('div'); wrap.className = 'cv-zoomwrap';
    wrap.append(bar, svg, hint);
    setTimeout(draw, 0);
    return wrap;
  }

  function open(data, onClose, opt) {
    opt = opt || {};
    const D = root.FxDialog, h = D.h;
    const paths = alignmentPaths(data.g);
    const all = data.g.points.filter(p => !/^RO/.test(p.name)).concat(data.pts).concat(data.pred ? [data.pred] : []);
    const near = data.pts.concat(data.pred ? [data.pred] : []);
    // 拡大：測点と予測のまわり。近くの線形も入るよう、いちばん近い足も含める
    const feet = near.map(p => p.j && p.j.foot).filter(Boolean);
    const views = zoomView(data, paths, all, near.concat(feet));
    const rows = data.pts.map((p, i) => h('tr', {}, [
      h('td', { text: p.name + (i < 4 && !PIPE_NAMES.includes(p.name) ? '（' + PIPE_NAMES[i] + '）' : '') }),
      h('td', { text: f3(p.x) }), h('td', { text: f3(p.y) }), h('td', { text: secName(p.j) }),
      h('td', { class: 'cv-mm', text: mmText(p.j) }), h('td', { text: p.j ? f3(p.j.distFromBP) : '―' })
    ]));
    if (data.pred) rows.push(h('tr', { class: 'cv-predrow' }, [
      h('td', { text: '次回予測' }), h('td', { text: f3(data.pred.x) }), h('td', { text: f3(data.pred.y) }), h('td', { text: secName(data.pred.j) }),
      h('td', { class: 'cv-mm', text: mmText(data.pred.j) }), h('td', { text: data.pred.j ? f3(data.pred.j.distFromBP) : '―' })
    ]));
    const table = h('table', { class: 'cv-table' }, [
      h('thead', {}, [h('tr', {}, ['測点', 'X', 'Y', '区間', '左右誤差', 'BPから'].map(t => h('th', { text: t })))]),
      h('tbody', {}, rows)
    ]);
    const note = data.pred
      ? '次回予測：1 本目と 2 本目の折れ角（' + data.pred.bend.toFixed(4) + '°）のまま、測点1〜測点3 の距離（' + f3(data.pred.len) + ' m）だけ進んだ位置。曲線総合プログラムと同じ求め方です。'
      : '次回予測は、測点を 4 つ（1 本目の前・後、2 本目の前・後）測ったときに出ます。';
    const kids = [opt.before || null, views, h('div', { class: 'cv-tablewrap' }, [table]), h('p', { class: 'cv-note', text: note })].filter(Boolean);
    let dlg = null;
    if (opt.full) kids.push(h('div', { class: 'cv-bottom' }, [h('button', { type: 'button', class: 'dlg-btn primary', text: '閉じる', onclick: () => dlg.close() })]));
    dlg = D.open({
      title: opt.title || '曲線の測量　結果', width: 760, full: !!opt.full,
      body: h('div', { class: 'cv-body' }, kids),
      buttons: (opt.buttons || []).concat([{ label: '閉じる', kind: 'primary' }]),
      onClose
    });
    return dlg;
  }

  // ---- 角度の入力：161-56-05／161 56 05／161°56′05″／1615605（電卓と同じ読み方）／161.5605（度.分秒） ----
  function parseAngle(text) {
    let s = String(text == null ? '' : text).normalize('NFKC').replace(/[ー－―−]/g, '-').trim();
    if (!s) return null;
    let neg = false;
    if (s[0] === '-') { neg = true; s = s.slice(1).trim(); }
    let d, m = 0, sec = 0;
    const tail = r => Number((r.slice(0, 2) || '0') + (r.length > 2 ? '.' + r.slice(2) : ''));
    if (/^\d+\.\d*$/.test(s)) {                     // 度.分秒
      const [a, b] = s.split('.'); const r = b.padEnd(4, '0');
      d = Number(a); m = Number(r.slice(0, 2)); sec = tail(r.slice(2));
    } else if (/^\d+$/.test(s)) {                   // 数字だけ：度（3 桁。360 以上になるなら 2 桁）→分 2 桁→秒
      if (s.length <= 3) d = Number(s);
      else {
        const dl = Number(s.slice(0, 3)) < 360 ? 3 : 2, r = s.slice(dl);
        d = Number(s.slice(0, dl)); m = Number(r.slice(0, 2)); sec = tail(r.slice(2));
      }
    } else {
      const parts = s.split(/[^\d.]+/).filter(Boolean);
      if (!parts.length || parts.length > 3) return NaN;
      [d, m = 0, sec = 0] = parts.map(Number);
    }
    if (![d, m, sec].every(Number.isFinite) || m >= 60 || sec >= 60) return NaN;
    const v = d + m / 60 + sec / 3600;
    return neg ? -v : v;
  }
  function fmtAngle(v) {
    if (!Number.isFinite(v)) return '';
    const neg = v < 0; let t = Math.round(Math.abs(v) * 36000) / 10;
    const d = Math.floor(t / 3600); t -= d * 3600;
    const m = Math.floor(t / 60), s = Math.round((t - m * 60) * 10) / 10;
    const ss = (s < 10 ? '0' : '') + (Number.isInteger(s) ? s : s.toFixed(1));
    return (neg ? '-' : '') + d + '°' + String(m).padStart(2, '0') + '′' + ss + '″';
  }
  // 数の欄：全角を半角に、長音・全角マイナスを - に
  const num = text => {
    const s = String(text == null ? '' : text).normalize('NFKC').replace(/[ー－―−]/g, '-').replace(/,/g, '').trim();
    return s === '' ? null : (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN);
  };
  const sideLine = j => !j ? '―' : secName(j) + '　' + mmText(j);
  const PIPE_NAMES = ['1本目前', '1本目後', '2本目前', '2本目後'];
  // 後視点・機械点・距離・角度から測った点（後視点の方向を 0、右回り）
  function pointFrom(st, d, deg) {
    const az = Math.atan2(st.by - st.oy, st.bx - st.ox) + deg * Math.PI / 180;
    return { x: st.ox + d * Math.cos(az), y: st.oy + d * Math.sin(az) };
  }

  // ---- トランシット：入れ替えた値を表で見せる ----
  function transit(data, onClose) {
    const D = root.FxDialog, h = D.h, b = data.before, a = data.after;
    const row = (name, k) => h('tr', {}, [h('td', { text: name }), h('td', { text: f3(b[k]) }), h('td', { text: '→' }), h('td', { class: 'cv-mm', text: f3(a[k]) })]);
    let btn = null;
    D.open({
      title: 'トランシットを進めました', width: 460, onClose,
      body: h('div', { class: 'cv-body' }, [
        h('table', { class: 'cv-table cv-sum' }, [h('tbody', {}, [
          h('tr', {}, [h('td', { text: '測った点' }), h('td', { text: 'FX ' + f3(data.p.x) }), h('td', {}), h('td', { text: 'FY ' + f3(data.p.y) })]),
          h('tr', {}, [h('td', { text: '左右誤差' }), h('td', { class: 'cv-mm', colspan: 3, text: data.side })])
        ])]),
        h('table', { class: 'cv-table cv-sum' }, [
          h('thead', {}, [h('tr', {}, ['入れ替え', '前', '', '後'].map(t => h('th', { text: t })))]),
          h('tbody', {}, [row('後視点 BX（←OX）', 'A'), row('後視点 BY（←OY）', 'B'), row('機械点 OX（←FX）', 'C'), row('機械点 OY（←FY）', 'D')])
        ])
      ]),
      buttons: [{ label: '閉じる', kind: 'primary', ref: el => { btn = el; } }]
    });
    setTimeout(() => btn && btn.focus(), 30);
  }

  // ---- ターゲット：距離・角度を表で入れる → 確かめ（画面いっぱい）→ 図（画面いっぱい）→ 保存するか ----
  //   opt：{ g, n, site, start: { bx, by, ox, oy }, onSave(record) → 名前 }
  //   done(result)：やめたら null。{ bx, by, ox, oy, pts: [{ name, d, h, x, y, j }], pred, saved }
  function survey(opt, done) {
    const D = root.FxDialog, h = D.h, g = opt.g, n = opt.n;
    const field = (value, label, mode, hint) => h('input', { type: 'text', class: 'cv-in', inputmode: mode, autocomplete: 'off', enterkeyhint: hint || 'next', 'aria-label': label, value: value == null ? '' : value });
    const st0 = opt.start;
    const coord = { bx: field(f3(st0.bx), '後視点 X', 'text'), by: field(f3(st0.by), '後視点 Y', 'text'), ox: field(f3(st0.ox), '機械点 X', 'text'), oy: field(f3(st0.oy), '機械点 Y', 'text') };
    const rows = [];
    for (let i = 0; i < n; i++) {
      const name = PIPE_NAMES[i] || '測点' + (i + 1);
      const r = { name, d: field('', name + ' 距離', 'decimal'), a: field('', name + ' 角度', 'decimal', i === n - 1 ? 'done' : 'next'),
        aShow: h('span', { class: 'cv-ashow' }), out: h('span', { class: 'cv-out', text: '―' }), xy: h('span', { class: 'cv-xy' }), res: null };
      rows.push(r);
    }
    const msg = h('p', { class: 'cv-msg' });
    const station = () => {
      const v = { bx: num(coord.bx.value), by: num(coord.by.value), ox: num(coord.ox.value), oy: num(coord.oy.value) };
      return Object.values(v).every(Number.isFinite) && (v.bx !== v.ox || v.by !== v.oy) ? v : null;
    };
    // 1 行を計算（距離・角度がそろったとき）。そろわなければ誤差は「―」
    function calc(r) {
      const d = num(r.d.value), deg = parseAngle(r.a.value), st = station();
      r.aShow.textContent = deg == null ? '' : Number.isFinite(deg) ? fmtAngle(deg) : '読めません';
      r.res = null;
      if (!(Number.isFinite(d) && d > 0 && Number.isFinite(deg) && st)) { r.out.textContent = '―'; r.xy.textContent = ''; return; }
      const p = pointFrom(st, d, deg), j = root.FxSenkei.judge(g, p);
      r.res = { name: r.name, d, h: deg, x: p.x, y: p.y, j };
      r.out.textContent = sideLine(j);
      r.xy.textContent = 'FX ' + f3(p.x) + '　FY ' + f3(p.y);
    }
    const order = [coord.bx, coord.by, coord.ox, coord.oy];
    rows.forEach(r => order.push(r.d, r.a));
    const lastField = order[order.length - 1];
    // 確かめの前に、全部そろっているか
    function check() {
      if (!station()) { msg.textContent = '後視点・機械点の座標を確かめてください'; coord.bx.focus(); return false; }
      for (const r of rows) {
        calc(r);
        if (!r.res) {
          msg.textContent = r.name + 'の' + (Number.isFinite(num(r.d.value)) && num(r.d.value) > 0 ? '角度' : '距離') + 'を入れてください';
          (Number.isFinite(num(r.d.value)) && num(r.d.value) > 0 ? r.a : r.d).focus();
          return false;
        }
      }
      msg.textContent = ''; return true;
    }
    order.forEach((el, k) => {
      el.addEventListener('keydown', e => {
        if (e.isComposing) return;
        if (e.key === 'Enter') {
          e.preventDefault(); e.stopPropagation();
          if (el === lastField) { if (check()) confirmView(); return; }
          order[k + 1].focus(); order[k + 1].select();
        } else if (e.key === 'ArrowUp' && k > 0) { e.preventDefault(); order[k - 1].focus(); order[k - 1].select(); }
        else if (e.key === 'ArrowDown' && k < order.length - 1) { e.preventDefault(); order[k + 1].focus(); order[k + 1].select(); }
      });
    });
    // 誤差は、角度の欄から離れたとき（距離を直したとき・座標を直したときも計算し直す）
    rows.forEach(r => {
      r.a.addEventListener('blur', () => calc(r));
      r.d.addEventListener('blur', () => { if (r.a.value.trim()) calc(r); });
      r.a.addEventListener('input', () => { const deg = parseAngle(r.a.value); r.aShow.textContent = deg == null ? '' : Number.isFinite(deg) ? fmtAngle(deg) : '読めません'; });
    });
    Object.values(coord).forEach(el => el.addEventListener('blur', () => rows.forEach(r => { if (r.res || r.a.value.trim()) calc(r); })));
    rows[0].d.setAttribute('autofocus', '');

    const cell = (label, el) => h('label', { class: 'cv-cell' }, [h('span', { text: label }), el]);
    const body = h('div', { class: 'cv-form' }, [
      h('div', { class: 'cv-st' }, [cell('後視点 BX', coord.bx), cell('後視点 BY', coord.by), cell('機械点 OX', coord.ox), cell('機械点 OY', coord.oy)]),
      h('p', { class: 'cv-note', text: 'ENTER で次の欄へ。↑ で前の欄に戻って直せます。角度は 161-56-05 か 1615605 のように入れます。最後の角度で ENTER を押すと確かめの画面になります。' }),
      ...rows.map(r => h('div', { class: 'cv-row' }, [
        h('div', { class: 'cv-rowname', text: r.name }),
        cell('距離', r.d), h('div', { class: 'cv-cell' }, [h('span', { text: '角度' }), r.a, r.aShow]),
        h('div', { class: 'cv-cell cv-err' }, [h('span', { text: '誤差' }), r.out, r.xy])
      ])),
      msg
    ]);
    let finished = false;
    const form = D.open({
      title: '曲線の測量　ターゲット ' + n + ' 点' + (opt.site ? '（' + opt.site + '）' : ''), width: 560, body,
      buttons: [{ label: 'やめる' }, { label: '確かめへ', kind: 'primary', onClick: () => { if (check()) confirmView(); return false; } }],
      onClose: () => { if (!finished) done(null); }
    });

    function confirmView() {
      const st = station(), pts = rows.map(r => r.res);
      const tr = pts.map(p => h('tr', {}, [h('td', { text: p.name }), h('td', { text: f3(p.d) }), h('td', { text: fmtAngle(p.h) }),
        h('td', { text: f3(p.x) }), h('td', { text: f3(p.y) }), h('td', { text: secName(p.j) }), h('td', { class: 'cv-mm', text: mmText(p.j) })]));
      let nextBtn = null;
      D.open({
        title: '入れた値の確かめ', full: true,
        body: h('div', { class: 'cv-body cv-confirm' }, [
          h('p', { class: 'cv-big', text: '後視点 BX ' + f3(st.bx) + '　BY ' + f3(st.by) + '　／　機械点 OX ' + f3(st.ox) + '　OY ' + f3(st.oy) }),
          h('div', { class: 'cv-tablewrap' }, [h('table', { class: 'cv-table cv-big' }, [
            h('thead', {}, [h('tr', {}, ['測点', '距離', '角度', 'FX', 'FY', '区間', '左右誤差'].map(t => h('th', { text: t })))]),
            h('tbody', {}, tr)
          ])]),
          h('p', { class: 'cv-note', text: 'よければ「次へ」で図を出します。直すときは「戻って直す」。' })
        ]),
        buttons: [{ label: '戻って直す', onClick: () => { setTimeout(() => lastField.focus(), 30); } },
          { label: '次へ', kind: 'primary', ref: el => { nextBtn = el; }, onClick: () => { setTimeout(() => showVisual(st, pts), 0); } }]
      });
      setTimeout(() => nextBtn && nextBtn.focus(), 30);
    }

    function showVisual(st, pts) {
      finished = true; form.close();
      let pred = null;
      if (pts.length >= 4) { pred = root.FxSenkei.predict(pts[0], pts[1], pts[2], pts[3]); pred.j = root.FxSenkei.judge(g, pred); }
      const viewPts = pts.map(p => ({ name: p.name, x: p.x, y: p.y, j: p.j }));
      open({ g, pts: viewPts, pred }, () => askSave(st, pts, pred), { full: true });
    }

    function askSave(st, pts, pred) {
      const result = { bx: st.bx, by: st.by, ox: st.ox, oy: st.oy, pts, pred, saved: '' };
      const pipe = h('input', { class: 'sl-name', type: 'text', inputmode: 'decimal', autocomplete: 'off', maxlength: 20, placeholder: '例：12', 'aria-label': '管番号' });
      D.open({
        title: '測量結果を保存しますか', width: 440, onClose: () => setTimeout(() => done(result), 0),
        body: h('div', {}, [
          h('p', { class: 'dlg-msg', text: '保存すると「今日の日付・時刻＋管番号」の名前で本体に残ります（BACKUP にも入ります）。' }),
          h('label', { class: 'cv-cell' }, [h('span', { text: '管番号' }), pipe])
        ]),
        buttons: [{ label: '保存しない' }, { label: '保存する', kind: 'primary', onClick: () => {
          const no = String(pipe.value).normalize('NFKC').trim();
          if (!no) { pipe.focus(); pipe.placeholder = '管番号を入れてください'; return false; }
          const jr = j => j ? { section: secName(j), offsetMm: Math.round(j.offset * 1000), fromBP: j.distFromBP } : null;
          result.saved = opt.onSave ? opt.onSave({
            pipeNo: no, site: opt.site || '', align: opt.align || null,
            backsight: { x: st.bx, y: st.by }, station: { x: st.ox, y: st.oy },
            points: pts.map(p => Object.assign({ name: p.name, d: p.d, h: p.h, angle: fmtAngle(p.h), x: p.x, y: p.y }, jr(p.j))),
            pred: pred ? Object.assign({ x: pred.x, y: pred.y, bend: pred.bend, len: pred.len }, jr(pred.j)) : null
          }) : '';
        } }]
      });
      pipe.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); e.stopPropagation(); pipe.closest('.dlg').querySelector('.dlg-btn.primary').click(); } });
      setTimeout(() => pipe.focus(), 50);
    }
  }

  // ---- 保存した測量の記録：一覧 → 中身（図と表・CSV）・消す ----
  //   opt：{ list() → 記録の配列（新しい順）, remove(rec), download(name, text), onClose }
  const mmOf = v => !Number.isFinite(v) ? '―' : v === 0 ? '中心' : (v > 0 ? '右 ' : '左 ') + Math.abs(v) + ' mm';
  function recordCsv(rec) {
    const q = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [['名前', rec.name], ['現場', rec.site || ''], ['管番号', rec.pipeNo],
      ['後視点 X', f3(rec.backsight.x)], ['後視点 Y', f3(rec.backsight.y)], ['機械点 X', f3(rec.station.x)], ['機械点 Y', f3(rec.station.y)], [],
      ['測点', '距離', '角度', 'X', 'Y', '区間', '左右誤差(mm)', 'BPから']];
    for (const p of rec.points) lines.push([p.name, f3(p.d), p.angle, f3(p.x), f3(p.y), p.section || '', p.offsetMm, Number.isFinite(p.fromBP) ? f3(p.fromBP) : '']);
    if (rec.pred) lines.push(['次回予測', '', '', f3(rec.pred.x), f3(rec.pred.y), rec.pred.section || '', rec.pred.offsetMm, Number.isFinite(rec.pred.fromBP) ? f3(rec.pred.fromBP) : '']);
    return lines.map(l => l.map(q).join(',')).join('\r\n') + '\r\n';
  }
  function records(opt) {
    const D = root.FxDialog, h = D.h;
    const all = opt.list();
    let dlg = null, goingOn = false;
    const reopen = () => setTimeout(() => records(opt), 0);
    const view = rec => { goingOn = true; dlg.close(); showRecord(rec, opt, reopen); };
    const items = all.map(rec => {
      const pts = rec.points || [];
      return h('li', {}, [
        h('div', { class: 'sl-info' }, [
          h('b', { text: rec.name }),
          h('span', { text: (rec.site ? rec.site + '　' : '') + pts.length + ' 点' }),
          h('span', { text: pts.map(p => p.name + ' ' + mmOf(p.offsetMm)).join('　') + (rec.pred ? '　予測 ' + mmOf(rec.pred.offsetMm) : '') })
        ]),
        h('div', { class: 'sl-btns' }, [
          h('button', { type: 'button', class: 'dlg-btn primary', text: '見る', onclick: () => view(rec) }),
          h('button', { type: 'button', class: 'dlg-btn danger', text: '消す', onclick: async () => {
            if (!await D.confirm('記録を消す', '「' + rec.name + '」を消します。元に戻せません。', '消す', 'danger')) return;
            opt.remove(rec); goingOn = true; dlg.close(); reopen();
          } })
        ])
      ]);
    });
    dlg = D.open({
      title: '曲線の測量の記録', width: 600,
      body: h('div', {}, [
        h('p', { class: 'dlg-msg', text: all.length ? '保存した測量の結果です（新しい順）。「見る」で図と表、CSV の書き出しができます。BACKUP にも入っています。' : 'まだ記録はありません。ターゲットの測量で図を閉じたあと、管番号を入れて保存すると、ここに出ます。' }),
        all.length ? h('ul', { class: 'sl-list' }, items) : null
      ]),
      buttons: [{ label: '閉じる', kind: 'primary' }],
      onClose: () => { if (!goingOn && opt.onClose) setTimeout(opt.onClose, 0); }
    });
  }
  function showRecord(rec, opt, back) {
    const D = root.FxDialog, h = D.h, K = root.FxSenkei;
    const title = rec.name + (rec.site ? '（' + rec.site + '）' : '');
    const head = h('div', { class: 'cv-body' }, [
      h('p', { class: 'cv-big', text: '後視点 BX ' + f3(rec.backsight.x) + '　BY ' + f3(rec.backsight.y) + '　／　機械点 OX ' + f3(rec.station.x) + '　OY ' + f3(rec.station.y) }),
      h('div', { class: 'cv-tablewrap' }, [h('table', { class: 'cv-table' }, [
        h('thead', {}, [h('tr', {}, ['測点', '距離', '角度', 'FX', 'FY', '区間', '左右誤差'].map(t => h('th', { text: t })))]),
        h('tbody', {}, rec.points.map(p => h('tr', {}, [h('td', { text: p.name }), h('td', { text: f3(p.d) }), h('td', { text: p.angle || fmtAngle(p.h) }),
          h('td', { text: f3(p.x) }), h('td', { text: f3(p.y) }), h('td', { text: p.section || '―' }), h('td', { class: 'cv-mm', text: mmOf(p.offsetMm) })]))
          .concat(rec.pred ? [h('tr', { class: 'cv-predrow' }, [h('td', { text: '次回予測' }), h('td', {}), h('td', {}), h('td', { text: f3(rec.pred.x) }), h('td', { text: f3(rec.pred.y) }),
            h('td', { text: rec.pred.section || '―' }), h('td', { class: 'cv-mm', text: mmOf(rec.pred.offsetMm) })])] : []))
      ])])
    ]);
    const csvName = (rec.name + (rec.site ? '_' + rec.site : '')).replace(/[\s:]/g, '_') + '.csv';
    const buttons = [{ label: 'CSV', onClick: () => { opt.download(csvName, recordCsv(rec)); return false; } }];
    // 線形も残っている記録は図も出す。照合は記録の座標で計算し直す（同じ式なので同じ答え）
    if (rec.align && K) {
      const g = K.build(rec.align);
      const pts = rec.points.map(p => ({ name: p.name, x: p.x, y: p.y, j: K.judge(g, p) }));
      const pred = rec.pred ? Object.assign({}, rec.pred, { j: K.judge(g, rec.pred) }) : null;
      open({ g, pts, pred }, back, { full: true, title, before: head, buttons });
      return;
    }
    let dlg = null;
    dlg = D.open({
      title, full: true,
      body: h('div', { class: 'cv-body' }, [head, h('p', { class: 'cv-note', text: 'この記録には線形が入っていないので、図は出せません（v1.4.19 で保存したもの）。' }),
        h('div', { class: 'cv-bottom' }, [h('button', { type: 'button', class: 'dlg-btn primary', text: '閉じる', onclick: () => dlg.close() })])]),
      buttons: buttons.concat([{ label: '閉じる', kind: 'primary' }]),
      onClose: back
    });
  }

  root.FxCurveView = { open, alignmentPaths, transit, survey, records, recordCsv, parseAngle, fmtAngle, pointFrom, sideLine };
})(typeof window !== 'undefined' ? window : globalThis);
