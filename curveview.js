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
  // 1 つの図。box：入れたい範囲の点（拡大のときは測点まわり）
  function drawView(title, box, data, paths, minSpan, short) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of box) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const span = Math.max(x1 - x0, y1 - y0, minSpan);
    const s = (Math.min(W, H) - PAD * 2) / span;
    const px = p => (W / 2 + (p.y - cy) * s).toFixed(1), py = p => (H / 2 - (p.x - cx) * s).toFixed(1);
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'cv-svg', role: 'img', 'aria-label': title });
    // 目盛り（X・Y の値を縁に）
    const step = niceStep(span), gx0 = cx - H / 2 / s, gx1 = cx + H / 2 / s, gy0 = cy - W / 2 / s, gy1 = cy + W / 2 / s;
    const dec = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
    for (let v = Math.ceil(gx0 / step) * step; v <= gx1; v += step) {
      const y = py({ x: v });
      svg.append(el('line', { x1: 0, x2: W, y1: y, y2: y, class: 'cv-grid' }), el('text', { x: 2, y: +y - 2, class: 'cv-tick' }, v.toFixed(dec)));
    }
    for (let v = Math.ceil(gy0 / step) * step; v <= gy1; v += step) {
      const x = px({ y: v });
      svg.append(el('line', { y1: 0, y2: H, x1: x, x2: x, class: 'cv-grid' }), el('text', { x: +x + 2, y: H - 3, class: 'cv-tick' }, v.toFixed(dec)));
    }
    const poly = (pts, cls) => svg.append(el('polyline', { points: pts.map(p => px(p) + ',' + py(p)).join(' '), class: cls }));
    if (paths.ipLine.length > 1) poly(paths.ipLine, 'cv-ip');
    for (const l of paths.lines) poly(l, 'cv-al');
    // 管の向き（1 本目：測点2→1、2 本目：測点4→3）と予測へ進む線
    const P = data.pts;
    if (P.length >= 2) poly([P[1], P[0]], 'cv-pipe');
    if (P.length >= 4) poly([P[3], P[2]], 'cv-pipe');
    if (data.pred && P.length) poly([P[0], data.pred], 'cv-predline');
    // 文字は点の右。右端に近いときは左に出す。全体の図は点が重なるので番号だけ
    const label = (p, text, cls) => {
      const x = +px(p), y = +py(p), left = x > W - 90;
      svg.append(el('circle', { cx: x, cy: y, r: 4.5, class: cls }));
      svg.append(el('text', { x: left ? x - 7 : x + 7, y: y + 4, class: 'cv-label', 'text-anchor': left ? 'end' : 'start' }, text));
    };
    P.forEach((p, i) => label(p, short ? String(i + 1) : (i + 1) + '　' + mmText(p.j), 'cv-pt'));
    if (data.pred) label(data.pred, short ? '予測' : '予測　' + mmText(data.pred.j), 'cv-pred');
    svg.append(el('text', { x: W / 2, y: 16, class: 'cv-title' }, title));
    svg.append(el('text', { x: W - 4, y: 16, class: 'cv-north' }, '↑北(X)'));
    return svg;
  }

  function open(data, onClose) {
    const D = root.FxDialog, h = D.h;
    const paths = alignmentPaths(data.g);
    const all = data.g.points.filter(p => !/^RO/.test(p.name)).concat(data.pts).concat(data.pred ? [data.pred] : []);
    const near = data.pts.concat(data.pred ? [data.pred] : []);
    // 拡大：測点と予測のまわり。近くの線形も入るよう、いちばん近い足も含める
    const feet = near.map(p => p.j && p.j.foot).filter(Boolean);
    const views = h('div', { class: 'cv-views' });
    views.append(drawView('全体', all, data, paths, 5, true), drawView('拡大', near.concat(feet), data, paths, 2));
    const rows = data.pts.map((p, i) => h('tr', {}, [
      h('td', { text: p.name + (i < 4 ? '（' + ['1本目前', '1本目後', '2本目前', '2本目後'][i] + '）' : '') }),
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
    D.open({
      title: '曲線の測量　結果', width: 760,
      body: h('div', { class: 'cv-body' }, [views, h('div', { class: 'cv-tablewrap' }, [table]), h('p', { class: 'cv-note', text: note })]),
      buttons: [{ label: '閉じる', kind: 'primary' }],
      onClose
    });
  }

  root.FxCurveView = { open, alignmentPaths };
})(typeof window !== 'undefined' ? window : globalThis);
