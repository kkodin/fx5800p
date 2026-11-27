// 曲線の測量（アプリ版プログラム）— 電卓ディスプレイ内の表形式で表示・操作し、仮想キーボードを出さない
//   FxCurveApp.enter(env) / FxCurveApp.render(screenEl) / FxCurveApp.onKey(k, shift, alpha) / FxCurveApp.onChar(ch) / FxCurveApp.onTap(t)
//   S.curveApp：{ aligns: [{ name, align, savedAt }], cur: 使っている線形の名前, bx, by, ox, oy, records: [...] }
(function (root) {
  'use strict';
  const f3 = v => (Math.round(v * 1000) / 1000).toFixed(3);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = text => {
    const s = String(text == null ? '' : text).normalize('NFKC').replace(/[ー－―−]/g, '-').replace(/,/g, '').trim();
    return s === '' ? null : (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN);
  };
  const V = () => root.FxCurveView;
  const stamp = d => { const z = v => String(v).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); };

  function alignSummary(a) {
    if (!a) return ['線形がまだありません'];
    const out = ['BP（' + f3(a.bp.x) + '、' + f3(a.bp.y) + '）　方向角 ' + V().fmtAngle(a.az) + '　BP〜IP1 ' + f3(a.L0)];
    a.curves.forEach((c, i) => out.push('第' + (i + 1) + '曲線　R ' + c.R + '　' + (c.dir === 'L' ? '左' : '右') + '　IA ' + V().fmtAngle(c.ia) + (i ? '　IP' + i + '〜IP' + (i + 1) + ' ' + f3(c.L) : '')));
    out.push('IP' + a.curves.length + '〜EP ' + f3(a.Lf));
    return out;
  }

  let env = null, scr = 'main', S = null, msg = '';
  let mainSel = 0;
  let alEdit = null;   // { entry, fields: [...], curves: [...], sel: 0 }
  let trSt = null;     // { g, a, vals: [bx,by,ox,oy,d,an], sel: 4, res: null, done: null }
  let tgSt = null;     // { g, a, n, vals: { bx,by,ox,oy }, rows: [{d,an,res}], sel: 4, pred: null }
  let pipeSt = null;   // { st, pts, pred, no: '' }
  let cfmSt = null;    // { title, text, okLabel, onOk, onCancel }

  const st = () => env.state();
  const curAlign = () => { const s = st(); return s.aligns.find(a => a.name === s.cur) || null; };
  const redraw = () => env && env.redraw && env.redraw();
  const closeFlick = () => { if (env && env.isFlick && env.isFlick()) env.setFlick(false); };
  const canFlick = () => scr === 'alignEdit' || scr === 'pipeNo';
  const isAngleField = () => { const f = activeField(); return !!(f && f.kind === 'angle'); };
  const posCode = j => !j ? '―' : (j.type === 'cv' ? 'R-' : 'S-') + j.id + (j.priority >= 8 ? '（外）' : '');

  function enter(e) {
    env = e; scr = 'main'; msg = ''; mainSel = 0;
    alEdit = null; trSt = null; tgSt = null; pipeSt = null; cfmSt = null;
  }

  // ---- アクティブセルへの文字入出力 ----
  function activeField() {
    if (scr === 'alignEdit' && alEdit) return alEdit.fields[alEdit.sel] || null;
    if (scr === 'transit' && trSt) return trSt.fields[trSt.sel] || null;
    if (scr === 'targetTable' && tgSt) return tgSt.fields[tgSt.sel] || null;
    if (scr === 'targetConfirm' && tgSt && tgSt.predEditing) return { kind: 'num', get: () => tgSt.predLen, set: v => { tgSt.predLen = v; calcPreds(); } };
    if (scr === 'pipeNo' && pipeSt) return { kind: 'text', get: () => pipeSt.no, set: v => { pipeSt.no = v; } };
    return null;
  }
  function draftState() {
    if (scr === 'transit' && trSt) return trSt;
    if (scr === 'targetTable' && tgSt) return tgSt;
    if (scr === 'targetConfirm' && tgSt && tgSt.predEditing) return {
      hasPrev: tgSt.predHasPrev,
      get draft() { return tgSt.predDraft; },
      set draft(v) { tgSt.predDraft = v; },
      fields: [activeField()],
      sel: 0
    };
    return null;
  }
  function initCellDraft(ds) {
    if (!ds) return;
    const f = ds.fields[ds.sel];
    ds.draft = '';
    ds.hasPrev = !!(f && f.get() !== '');
  }
  function commitDraft(ds) {
    if (!ds) return;
    if (ds.hasPrev && ds.draft !== '') {
      const f = ds.fields[ds.sel];
      if (f) { f.set(ds.draft); afterEdit(); }
    }
    ds.draft = '';
  }
  function moveDraftSel(ds, nextSel) {
    commitDraft(ds);
    ds.sel = nextSel;
    initCellDraft(ds);
  }
  function getText() { const ds = draftState(); if (ds && ds.hasPrev) return ds.draft; const f = activeField(); return f ? f.get() : ''; }
  function replaceTail(n, s) {
    const ds = draftState();
    if (ds && ds.hasPrev) {
      const arr = Array.from(ds.draft);
      ds.draft = arr.slice(0, Math.max(0, arr.length - n)).join('') + s;
      msg = ''; return;
    }
    const f = activeField(); if (!f) return;
    const arr = Array.from(f.get());
    f.set(arr.slice(0, Math.max(0, arr.length - n)).join('') + s);
    afterEdit();
  }
  function onChar(ch) {
    const f = activeField(); if (!f) return;
    if (f.kind === 'dir') return;
    if (f.kind === 'num' && !/^[0-9.\-]$/.test(ch)) return;
    if (f.kind === 'angle' && !/^[0-9.\-°′″ ]$/.test(ch)) return;
    const ds = draftState();
    if (ds && ds.hasPrev) { ds.draft += ch; msg = ''; redraw(); return; }
    f.set(f.get() + ch);
    afterEdit();
    redraw();
  }
  function afterEdit() {
    msg = '';
    if (scr === 'transit' && trSt) calcTransit();
    if (scr === 'targetTable' && tgSt) calcTargetRow(tgSt.fields[tgSt.sel]);
  }

  // ---- 各画面の初期化 ----
  function startAlignEdit(entry) {
    const a0 = entry ? JSON.parse(JSON.stringify(entry.align)) : { bp: { x: 0, y: 0 }, az: 0, L0: 0, curves: [{ R: '', ia: '', dir: 'R', L: 0 }], Lf: 0 };
    alEdit = {
      entry,
      name: entry ? entry.name : '',
      bpx: String(a0.bp.x), bpy: String(a0.bp.y),
      az: entry ? V().fmtAngle(a0.az) : '',
      L0: entry ? String(a0.L0) : '',
      Lf: entry ? String(a0.Lf) : '',
      curves: (a0.curves || []).map(c => ({
        L: c.L ? String(c.L) : '', R: c.R === '' ? '' : String(c.R),
        dir: c.dir === 'L' ? 'L' : 'R', ia: Number.isFinite(c.ia) ? V().fmtAngle(c.ia) : ''
      })),
      sel: 0, fields: []
    };
    rebuildAlignFields();
    scr = 'alignEdit'; msg = '';
  }
  function rebuildAlignFields() {
    const e = alEdit, fs = [];
    const push = (id, label, kind, get, set) => fs.push({ id, label, kind, get, set });
    push('name', '線形名', 'text', () => e.name, v => { e.name = v; });
    push('bpx', '始点(BP) X', 'num', () => e.bpx, v => { e.bpx = v; });
    push('bpy', '始点(BP) Y', 'num', () => e.bpy, v => { e.bpy = v; });
    push('az', '方向角 (BP→IP1)', 'angle', () => e.az, v => { e.az = v; });
    push('L0', '始点〜第1交点 (BP〜IP1)', 'num', () => e.L0, v => { e.L0 = v; });
    e.curves.forEach((c, i) => {
      if (i > 0) push('cL' + i, '交点' + i + '〜交点' + (i + 1), 'num', () => c.L, v => { c.L = v; });
      push('cR' + i, '第' + (i + 1) + '曲線 半径(R)', 'num', () => c.R, v => { c.R = v; });
      push('cD' + i, '第' + (i + 1) + '曲線 向き', 'dir', () => c.dir, v => { c.dir = v; });
      push('cI' + i, '第' + (i + 1) + '曲線 交角(IA)', 'angle', () => c.ia, v => { c.ia = v; });
    });
    push('Lf', '最終交点〜終点 (IP〜EP)', 'num', () => e.Lf, v => { e.Lf = v; });
    e.fields = fs;
    if (e.sel >= fs.length) e.sel = fs.length - 1;
  }
  function saveAlignEdit() {
    const e = alEdit, Vw = V();
    const nm = String(e.name).normalize('NFKC').trim();
    if (!nm) { msg = '線形の名前を入れてください（i キーで日本語入力）'; e.sel = 0; return; }
    const x = num(e.bpx), y = num(e.bpy), azv = Vw.parseAngle(e.az), L0 = num(e.L0), Lf = num(e.Lf);
    if (!Number.isFinite(x)) { msg = 'BP の X を入れてください'; e.sel = 1; return; }
    if (!Number.isFinite(y)) { msg = 'BP の Y を入れてください'; e.sel = 2; return; }
    if (!Number.isFinite(azv)) { msg = '方向角を入れてください（例 45-30-00）'; e.sel = 3; return; }
    if (!(L0 > 0)) { msg = 'BP〜IP1 の距離を入れてください'; e.sel = 4; return; }
    const cs = [];
    for (let i = 0; i < e.curves.length; i++) {
      const c = e.curves[i], R = num(c.R), ia = Vw.parseAngle(c.ia), L = i > 0 ? num(c.L) : 0;
      if (i > 0 && !(L > 0)) { msg = '第' + (i + 1) + '曲線の IP〜IP を入れてください'; e.sel = e.fields.findIndex(f => f.id === 'cL' + i); return; }
      if (!(R > 0)) { msg = '第' + (i + 1) + '曲線の R を入れてください'; e.sel = e.fields.findIndex(f => f.id === 'cR' + i); return; }
      if (!(ia > 0 && ia < 180)) { msg = '第' + (i + 1) + '曲線の交角を入れてください（0〜180°）'; e.sel = e.fields.findIndex(f => f.id === 'cI' + i); return; }
      cs.push({ R, ia, dir: c.dir, L });
    }
    if (!(Lf > 0)) { msg = '最後の IP〜EP の距離を入れてください'; e.sel = e.fields.length - 1; return; }
    const s = st(), align = { bp: { x, y }, az: azv, L0, curves: cs, Lf };
    const old = s.aligns.find(x => x.name === nm);
    const commit = () => {
      s.aligns = s.aligns.filter(x => x !== old && x !== e.entry).concat({ name: nm, align, savedAt: new Date().toISOString() });
      s.cur = nm; env.save(); env.toast('線形「' + nm + '」を保存しました');
      closeFlick(); scr = 'main'; msg = '';
    };
    if (old && old !== e.entry) {
      cfmSt = { title: '上書きの確認', text: '「' + nm + '」はもうあります。上書きしますか？', okLabel: '上書き', onOk: commit, onCancel: () => { scr = 'alignEdit'; } };
      scr = 'confirm'; return;
    }
    commit();
  }

  // ---- トランシット ----
  function startTransit(a) {
    const s = st();
    trSt = {
      a, g: root.FxSenkei.build(a.align),
      bx: f3(s.bx || 0), by: f3(s.by || 0), ox: f3(s.ox || 0), oy: f3(s.oy || 0),
      d: '', an: '', sel: 0, draft: '', res: null, done: null, fields: []
    };
    trSt.fields = [
      { id: 'bx', label: '後視点 BX', kind: 'num', get: () => trSt.bx, set: v => { trSt.bx = v; } },
      { id: 'by', label: '後視点 BY', kind: 'num', get: () => trSt.by, set: v => { trSt.by = v; } },
      { id: 'ox', label: '機械点 OX', kind: 'num', get: () => trSt.ox, set: v => { trSt.ox = v; } },
      { id: 'oy', label: '機械点 OY', kind: 'num', get: () => trSt.oy, set: v => { trSt.oy = v; } },
      { id: 'd', label: '距離', kind: 'num', get: () => trSt.d, set: v => { trSt.d = v; } },
      { id: 'an', label: '角度', kind: 'angle', get: () => trSt.an, set: v => { trSt.an = v; } }
    ];
    initCellDraft(trSt);
    scr = 'transit'; msg = ''; closeFlick();
  }
  function calcTransit() {
    const t = trSt, Vw = V();
    const s = { bx: num(t.bx), by: num(t.by), ox: num(t.ox), oy: num(t.oy) }, dv = num(t.d), deg = Vw.parseAngle(t.an);
    t.res = null;
    if (!(Object.values(s).every(Number.isFinite) && (s.bx !== s.ox || s.by !== s.oy) && dv > 0 && Number.isFinite(deg))) return;
    const p = Vw.pointFrom(s, dv, deg), j = root.FxSenkei.judge(t.g, p);
    t.res = { s, p, j };
  }
  function finishTransit() {
    calcTransit();
    const t = trSt;
    if (!t.res) {
      msg = !(num(t.d) > 0) ? '距離を入れてください' : '角度・座標を確かめてください';
      t.sel = !(num(t.d) > 0) ? 4 : 5;
      return;
    }
    const { s, p, j } = t.res, stObj = st();
    const before = { A: s.bx, B: s.by, C: s.ox, D: s.oy };
    stObj.bx = s.ox; stObj.by = s.oy; stObj.ox = p.x; stObj.oy = p.y; env.save();
    t.done = { p, side: V().sideLine(j), before, after: { A: stObj.bx, B: stObj.by, C: stObj.ox, D: stObj.oy } };
    scr = 'transitDone'; msg = '';
  }

  // ---- ターゲット ----
  function startTargetTable(a, n) {
    const s = st(), PIPE = ['1本目前', '1本目後', '2本目前', '2本目後'];
    const rows = Array.from({ length: n }, (_, i) => ({
      name: i < 4 ? PIPE[i] : '測点' + (i + 1), d: '', an: '', res: null
    }));
    tgSt = {
      a, g: root.FxSenkei.build(a.align), n,
      bx: f3(s.bx || 0), by: f3(s.by || 0), ox: f3(s.ox || 0), oy: f3(s.oy || 0),
      rows, sel: 4, draft: '', pred: null, fields: []
    };
    const fs = [
      { id: 'bx', label: 'BX', kind: 'num', row: -1, get: () => tgSt.bx, set: v => { tgSt.bx = v; } },
      { id: 'by', label: 'BY', kind: 'num', row: -1, get: () => tgSt.by, set: v => { tgSt.by = v; } },
      { id: 'ox', label: 'OX', kind: 'num', row: -1, get: () => tgSt.ox, set: v => { tgSt.ox = v; } },
      { id: 'oy', label: 'OY', kind: 'num', row: -1, get: () => tgSt.oy, set: v => { tgSt.oy = v; } }
    ];
    rows.forEach((r, i) => {
      fs.push({ id: 'd' + i, label: r.name + ' 距離', kind: 'num', row: i, get: () => r.d, set: v => { r.d = v; } });
      fs.push({ id: 'a' + i, label: r.name + ' 角度', kind: 'angle', row: i, get: () => r.an, set: v => { r.an = v; } });
    });
    tgSt.fields = fs;
    initCellDraft(tgSt);
    scr = 'targetTable'; msg = ''; closeFlick();
  }
  function stationOfTarget() {
    const t = tgSt;
    return { bx: num(t.bx), by: num(t.by), ox: num(t.ox), oy: num(t.oy) };
  }
  function calcTargetRow(f) {
    if (!tgSt) return;
    if (!f || f.row < 0) { tgSt.rows.forEach((_, i) => calcOneTarget(i)); return; }
    calcOneTarget(f.row);
  }
  function calcOneTarget(i) {
    const t = tgSt, r = t.rows[i], Vw = V(), s = stationOfTarget();
    r.res = null;
    if (!Object.values(s).every(Number.isFinite) || (s.bx === s.ox && s.by === s.oy)) return;
    const dv = num(r.d), deg = Vw.parseAngle(r.an);
    if (!(dv > 0) || !Number.isFinite(deg)) return;
    const p = Vw.pointFrom(s, dv, deg), j = root.FxSenkei.judge(t.g, p);
    r.res = { name: r.name, d: dv, h: deg, x: p.x, y: p.y, j };
  }
  function calcPreds() {
    const t = tgSt;
    if (!t) return;
    t.preds = []; t.pred = null;
    const pts = t.rows.map(r => r.res);
    if (pts.length < 4 || pts.some(p => !p)) return;
    const base = root.FxSenkei.predict(pts[0], pts[1], pts[2], pts[3]);
    const stepLen = num(t.predLen);
    const L = (Number.isFinite(stepLen) && stepLen > 0) ? stepLen : base.len;
    const cnt = Math.max(1, Math.min(5, Number(t.predCount) || 1));
    const RAD = Math.PI / 180;
    let cx = pts[0].x, cy = pts[0].y;
    for (let k = 1; k <= cnt; k++) {
      const dir = (base.dir1 + k * base.bend) * RAD;
      cx += L * Math.cos(dir);
      cy += L * Math.sin(dir);
      t.preds.push({ step: k, x: cx, y: cy, len: L, bend: base.bend, j: root.FxSenkei.judge(t.g, { x: cx, y: cy }) });
    }
    t.pred = t.preds[0] || null;
  }
  function checkTargetTable() {
    const t = tgSt, s = stationOfTarget();
    if (!Object.values(s).every(Number.isFinite) || (s.bx === s.ox && s.by === s.oy)) {
      msg = '後視点・機械点の座標を確かめてください'; t.sel = 0; return;
    }
    for (let i = 0; i < t.rows.length; i++) {
      calcOneTarget(i);
      const r = t.rows[i];
      if (!r.res) {
        const badD = !(num(r.d) > 0);
        msg = r.name + ' の' + (badD ? '距離' : '角度') + 'を確かめてください';
        t.sel = 4 + i * 2 + (badD ? 0 : 1);
        return;
      }
    }
    const pts = t.rows.map(r => r.res);
    t.pred = null; t.preds = []; t.predEditing = false; t.predDraft = '';
    if (pts.length >= 4) {
      const base = root.FxSenkei.predict(pts[0], pts[1], pts[2], pts[3]);
      t.predLen = f3(base.len);
      t.predCount = t.predCount || 1;
      t.predHasPrev = true;
      calcPreds();
    }
    scr = 'targetConfirm'; msg = '';
  }
  function openTargetVisual() {
    const t = tgSt, s = stationOfTarget(), pts = t.rows.map(r => r.res);
    const viewPts = pts.map(p => ({ name: p.name, x: p.x, y: p.y, j: p.j }));
    V().open({ g: t.g, pts: viewPts, pred: t.pred, preds: t.preds }, () => {
      const stObj = st();
      stObj.bx = s.bx; stObj.by = s.by; stObj.ox = s.ox; stObj.oy = s.oy;
      env.save();
      pipeSt = { st: s, pts, pred: t.pred, no: '' };
      scr = 'pipeNo'; msg = '';
      redraw();
    }, { full: true });
  }
  function savePipeRecord() {
    const p = pipeSt, no = String(p.no).normalize('NFKC').trim();
    if (!no) { msg = '管番号を入れてください'; return; }
    const Vw = V(), s = st(), d = new Date(), name = stamp(d) + ' 管No.' + no;
    const secName = j => !j ? '―' : j.kind === 'straight' ? (j.index === 0 ? 'BP〜IP1' : j.index === tgSt.g.segs.length - 1 ? 'IP' + j.index + '〜EP' : '直線' + (j.index + 1)) : '第' + (j.curveIndex + 1) + '曲線';
    const jr = j => j ? { section: secName(j), offsetMm: Math.round(j.offset * 1000), fromBP: j.distFromBP } : null;
    s.records.push({
      name, savedAt: d.toISOString(), pipeNo: no, site: tgSt.a.name, align: tgSt.a.align,
      backsight: { x: p.st.bx, y: p.st.by }, station: { x: p.st.ox, y: p.st.oy },
      points: p.pts.map(pt => Object.assign({ name: pt.name, d: pt.d, h: pt.h, angle: Vw.fmtAngle(pt.h), x: pt.x, y: pt.y }, jr(pt.j))),
      pred: p.pred ? Object.assign({ x: p.pred.x, y: p.pred.y, bend: p.pred.bend, len: p.pred.len }, jr(p.pred.j)) : null
    });
    env.save(); env.toast('測量結果を保存しました：' + name);
    closeFlick(); scr = 'main'; msg = '';
  }

  // ---- キー入力処理 ----
  function onKey(k) {
    const id = k.id;
    if (scr === 'confirm') {
      if (id === 'EXE') { const fn = cfmSt.onOk; cfmSt = null; fn(); }
      else if (id === 'EXIT' || id === 'AC') { const fn = cfmSt.onCancel; cfmSt = null; fn(); }
      return;
    }
    if (id === 'EXIT') { return goBack(); }

    if (scr === 'main') {
      if (id === 'UP') mainSel = (mainSel + 2) % 3;
      else if (id === 'DOWN') mainSel = (mainSel + 1) % 3;
      else if (id === '1') openMainAction(0);
      else if (id === '2') openMainAction(1);
      else if (id === '3') openMainAction(2);
      else if (id === 'EXE') openMainAction(mainSel);
      return;
    }
    if (scr === 'targetCount') {
      if (id >= '1' && id <= '9') { startTargetTable(curAlign(), Number(id)); return; }
      if (id === '0') { startTargetTable(curAlign(), 10); return; }
      if (id === 'EXE') { startTargetTable(curAlign(), 4); return; }
      return;
    }
    if (scr === 'transitDone') {
      if (id === 'EXE' || id === 'AC') { scr = 'main'; msg = ''; }
      return;
    }
    if (scr === 'targetConfirm') {
      if (tgSt && tgSt.predEditing) {
        const f = activeField();
        if (id === 'DEL') {
          const arr = Array.from(tgSt.predDraft);
          if (arr.length) { tgSt.predDraft = arr.slice(0, -1).join(''); msg = ''; }
          return;
        }
        if (id === 'AC') {
          if (tgSt.predDraft) { tgSt.predDraft = ''; msg = ''; }
          else { tgSt.predEditing = false; }
          return;
        }
        if ((id === 'SUB' || id === 'NEG') && f) { onChar('-'); return; }
        if (id === 'DOT' && f) { onChar('.'); return; }
        if (k.ins && /^[0-9]$/.test(k.ins) && f) { onChar(k.ins); return; }
        if (id === 'EXE') {
          if (tgSt.predDraft !== '') { tgSt.predLen = tgSt.predDraft; tgSt.predDraft = ''; calcPreds(); }
          tgSt.predEditing = false;
          return;
        }
        return;
      }
      if (id === 'EXE') openTargetVisual();
      return;
    }
    if (scr === 'alignList') return;

    // 表入力画面共通（alignEdit / transit / targetTable / pipeNo）
    const f = activeField();
    if (!f) return;
    if (id === 'DEL') {
      const ds = draftState();
      if (ds && ds.hasPrev) {
        const arr = Array.from(ds.draft);
        if (arr.length) { ds.draft = arr.slice(0, -1).join(''); msg = ''; }
        return;
      }
      const arr = Array.from(f.get());
      if (arr.length) { f.set(arr.slice(0, -1).join('')); afterEdit(); }
      return;
    }
    if (id === 'AC') {
      const ds = draftState();
      if (ds && ds.hasPrev) { if (ds.draft) { ds.draft = ''; msg = ''; } else { f.set(''); ds.hasPrev = false; afterEdit(); } return; }
      if (f.kind !== 'dir') { f.set(''); afterEdit(); }
      return;
    }
    if ((id === 'DMS' || id === 'EXP') && f.kind === 'angle') { onChar('°'); return; }
    if ((id === 'SUB' || id === 'NEG') && f.kind !== 'dir') { onChar('-'); return; }
    if (id === 'DOT' && f.kind !== 'dir') { onChar('.'); return; }
    if (k.ins && /^[0-9]$/.test(k.ins) && f.kind !== 'dir') { onChar(k.ins); return; }

    if (scr === 'alignEdit') {
      if (f.kind === 'dir' && (id === 'LEFT' || id === 'RIGHT' || id === 'EXE')) {
        f.set(f.get() === 'L' ? 'R' : 'L');
        if (id === 'EXE') alEdit.sel = Math.min(alEdit.fields.length - 1, alEdit.sel + 1);
        return;
      }
      if (id === 'UP') alEdit.sel = Math.max(0, alEdit.sel - 1);
      else if (id === 'DOWN') alEdit.sel = Math.min(alEdit.fields.length - 1, alEdit.sel + 1);
      else if (id === 'EXE') {
        if (alEdit.sel === alEdit.fields.length - 1) saveAlignEdit();
        else alEdit.sel++;
      }
      return;
    }
    if (scr === 'transit') {
      if (id === 'UP') moveDraftSel(trSt, Math.max(0, trSt.sel - 1));
      else if (id === 'DOWN') moveDraftSel(trSt, Math.min(trSt.fields.length - 1, trSt.sel + 1));
      else if (id === 'LEFT' && trSt.sel < 4) moveDraftSel(trSt, Math.max(0, trSt.sel - 1));
      else if (id === 'RIGHT' && trSt.sel < 4) moveDraftSel(trSt, Math.min(3, trSt.sel + 1));
      else if (id === 'EXE') {
        commitDraft(trSt);
        if (trSt.sel === trSt.fields.length - 1) finishTransit();
        else { trSt.sel++; initCellDraft(trSt); }
      }
      return;
    }
    if (scr === 'targetTable') {
      if (id === 'UP') moveDraftSel(tgSt, tgSt.sel >= 6 ? tgSt.sel - 2 : Math.max(0, tgSt.sel - 2));
      else if (id === 'DOWN') moveDraftSel(tgSt, Math.min(tgSt.fields.length - 1, tgSt.sel + 2));
      else if (id === 'LEFT') moveDraftSel(tgSt, Math.max(0, tgSt.sel - 1));
      else if (id === 'RIGHT') moveDraftSel(tgSt, Math.min(tgSt.fields.length - 1, tgSt.sel + 1));
      else if (id === 'EXE') {
        commitDraft(tgSt);
        if (tgSt.sel === tgSt.fields.length - 1) checkTargetTable();
        else { tgSt.sel++; initCellDraft(tgSt); }
      }
      return;
    }
    if (scr === 'pipeNo') {
      if (id === 'EXE') savePipeRecord();
      return;
    }
  }

  function goBack() {
    closeFlick(); msg = '';
    if (scr === 'main') { env.onClose(); return; }
    if (scr === 'alignEdit') { scr = 'alignList'; return; }
    if (scr === 'targetTable') { scr = 'targetCount'; return; }
    if (scr === 'targetConfirm') { scr = 'targetTable'; return; }
    if (scr === 'pipeNo') { scr = 'main'; return; }
    scr = 'main';
  }

  function openMainAction(idx) {
    const a = curAlign();
    if (idx === 0) { if (!a) { msg = '先に線形を選んでください'; return; } startTransit(a); }
    else if (idx === 1) { if (!a) { msg = '先に線形を選んでください'; return; } scr = 'targetCount'; msg = ''; }
    else if (idx === 2) {
      const s = st();
      V().records({
        list: () => s.records.slice().sort((x, y) => String(y.savedAt).localeCompare(String(x.savedAt))),
        remove: rec => { s.records = s.records.filter(r => r !== rec); env.save(); env.toast('「' + rec.name + '」を消しました'); },
        download: env.download
      });
    }
  }

  // ---- タップ処理 ----
  function onTap(t) {
    if (t === 'back') { goBack(); return; }
    if (t === 'flick') { env.setFlick(!env.isFlick()); return; }
    if (t === 'dms') { onKey({ id: 'DMS' }); return; }
    if (t === 'up') { onKey({ id: 'UP' }); return; }
    if (t === 'down') { onKey({ id: 'DOWN' }); return; }
    if (t === 'ok') { if (cfmSt) { const fn = cfmSt.onOk; cfmSt = null; fn(); } return; }
    if (t === 'cancel') { if (cfmSt) { const fn = cfmSt.onCancel; cfmSt = null; fn(); } return; }

    if (scr === 'main') {
      if (t === 'choose') { scr = 'alignList'; msg = ''; return; }
      if (t === 'm0') openMainAction(0);
      else if (t === 'm1') openMainAction(1);
      else if (t === 'm2') openMainAction(2);
      return;
    }
    if (scr === 'alignList') {
      const s = st();
      if (t === 'new') { startAlignEdit(null); return; }
      if (t.startsWith('use:')) { const i = Number(t.slice(4)); const list = sortedAligns(); if (list[i]) { s.cur = list[i].name; env.save(); scr = 'main'; } return; }
      if (t.startsWith('edit:')) { const i = Number(t.slice(5)); const list = sortedAligns(); if (list[i]) startAlignEdit(list[i]); return; }
      if (t.startsWith('del:')) {
        const i = Number(t.slice(4)), list = sortedAligns(), e = list[i];
        if (!e) return;
        cfmSt = {
          title: '線形を消す', text: '「' + e.name + '」を消しますか？', okLabel: '消す',
          onOk: () => { s.aligns = s.aligns.filter(x => x !== e); if (s.cur === e.name) s.cur = null; env.save(); scr = 'alignList'; },
          onCancel: () => { scr = 'alignList'; }
        };
        scr = 'confirm'; return;
      }
      if (t.startsWith('sentei:')) {
        const i = Number(t.slice(7)), list = env.senteiAligns ? env.senteiAligns() : [], src = list[i];
        if (!src) return;
        const old = s.aligns.find(x => x.name === src.name);
        const copy = () => {
          s.aligns = s.aligns.filter(x => x !== old).concat({ name: src.name, align: JSON.parse(JSON.stringify(src.align)), savedAt: new Date().toISOString() });
          s.cur = src.name; env.save(); env.toast('「' + src.name + '」を写しました'); scr = 'main';
        };
        if (old) {
          cfmSt = { title: '上書き', text: '「' + src.name + '」はもうあります。上書きしますか？', okLabel: '上書き', onOk: copy, onCancel: () => { scr = 'alignList'; } };
          scr = 'confirm'; return;
        }
        copy(); return;
      }
      return;
    }
    if (scr === 'alignEdit') {
      if (t === 'addc') { alEdit.curves.push({ L: '', R: '', dir: 'R', ia: '' }); rebuildAlignFields(); alEdit.sel = alEdit.fields.findIndex(f => f.id === 'cL' + (alEdit.curves.length - 1)); return; }
      if (t === 'delc') { if (alEdit.curves.length > 1) { alEdit.curves.pop(); rebuildAlignFields(); } return; }
      if (t === 'save') { saveAlignEdit(); return; }
      if (t.startsWith('f:')) {
        const idx = Number(t.slice(2)), f = alEdit.fields[idx];
        if (f && f.kind === 'dir' && alEdit.sel === idx) f.set(f.get() === 'L' ? 'R' : 'L');
        alEdit.sel = idx;
        return;
      }
      return;
    }
    if (scr === 'transit') {
      if (t === 'go') { commitDraft(trSt); finishTransit(); return; }
      if (t.startsWith('f:')) { moveDraftSel(trSt, Number(t.slice(2))); return; }
      return;
    }
    if (scr === 'transitDone') {
      if (t === 'ok2') { scr = 'main'; msg = ''; }
      return;
    }
    if (scr === 'targetCount') {
      if (t.startsWith('n:')) { startTargetTable(curAlign(), Number(t.slice(2))); }
      return;
    }
    if (scr === 'targetTable') {
      if (t === 'check') { commitDraft(tgSt); checkTargetTable(); return; }
      if (t.startsWith('f:')) { moveDraftSel(tgSt, Number(t.slice(2))); return; }
      return;
    }
    if (scr === 'targetConfirm') {
      if (t === 'plen') { tgSt.predEditing = true; tgSt.predDraft = ''; tgSt.predHasPrev = tgSt.predLen !== ''; return; }
      if (t.startsWith('pcnt:')) {
        if (tgSt.predEditing && tgSt.predDraft !== '') { tgSt.predLen = tgSt.predDraft; tgSt.predDraft = ''; }
        tgSt.predEditing = false;
        tgSt.predCount = Number(t.slice(5)) || 1;
        calcPreds();
        return;
      }
      if (t === 'fix') { tgSt.predEditing = false; scr = 'targetTable'; initCellDraft(tgSt); return; }
      if (t === 'visual') {
        if (tgSt.predEditing && tgSt.predDraft !== '') { tgSt.predLen = tgSt.predDraft; tgSt.predDraft = ''; calcPreds(); }
        tgSt.predEditing = false;
        openTargetVisual(); return;
      }
      return;
    }
    if (scr === 'pipeNo') {
      if (t === 'save') { savePipeRecord(); return; }
      if (t === 'skip') { closeFlick(); scr = 'main'; msg = ''; return; }
      return;
    }
  }

  function sortedAligns() {
    return st().aligns.slice().sort((x, y) => String(y.savedAt).localeCompare(String(x.savedAt)));
  }

  // ---- LCD 描画（すべて表形式・<input> なし） ----
  function headHtml(title, tools) {
    const fl = env.isFlick && env.isFlick();
    const btns = (tools || []).map(x => {
      if (x === 'flick') return '<button type="button" class="ca-tbtn' + (fl ? ' on' : '') + '" data-tap="flick" title="i キーでも切替">あ/123</button>';
      if (x === 'dms') return '<button type="button" class="ca-tbtn" data-tap="dms">°′″</button>';
      if (x === 'nav') return '<button type="button" class="ca-tbtn" data-tap="up">▲</button><button type="button" class="ca-tbtn" data-tap="down">▼</button>';
      return '';
    }).join('');
    return '<div class="menu-head"><button type="button" class="mback" data-tap="back">◀ 戻る</button><b>' + esc(title) + '</b><span class="ca-tools">' + btns + '</span></div>';
  }
  const cellVal = (val, active) => esc(val) + (active ? '<span class="cur">&nbsp;</span>' : (val === '' ? '<span class="ca-ph">―</span>' : ''));

  function render(screenEl) {
    const s = st(), a = curAlign(), Vw = V();
    let html = '';
    if (scr === 'confirm' && cfmSt) {
      html = headHtml(cfmSt.title) +
        '<div class="ca-lcd"><p class="ca-msg">' + esc(cfmSt.text) + '</p>' +
        '<div class="ca-btns"><button type="button" class="ca-btn" data-tap="cancel">やめる</button>' +
        '<button type="button" class="ca-btn pri" data-tap="ok">' + esc(cfmSt.okLabel || 'OK') + '</button></div></div>';
    } else if (scr === 'main') {
      html = headHtml('曲線の測量（推進管）') +
        '<div class="ca-lcd">' +
        '<table class="ca-tbl"><tbody>' +
        '<tr><th>線形</th><td><b>' + esc(a ? a.name : '（未設定）') + '</b>' +
        '<div class="ca-sub">' + alignSummary(a && a.align).map(esc).join('<br>') + '</div></td>' +
        '<td class="ca-act"><button type="button" class="ca-btn" data-tap="choose">選ぶ・入れる</button></td></tr>' +
        '<tr><th>後視点</th><td colspan="2">X ' + f3(s.bx || 0) + '　Y ' + f3(s.by || 0) + '</td></tr>' +
        '<tr><th>機械点</th><td colspan="2">X ' + f3(s.ox || 0) + '　Y ' + f3(s.oy || 0) + '</td></tr>' +
        '</tbody></table>' +
        (msg ? '<p class="ca-err">' + esc(msg) + '</p>' : '') +
        '<div class="ca-menu">' +
        '<button type="button" class="ca-mbtn' + (mainSel === 0 ? ' sel' : '') + (!a ? ' dis' : '') + '" data-tap="m0"><b>1: トランシット</b><span>機械点を進める（開放トラバース）</span></button>' +
        '<button type="button" class="ca-mbtn' + (mainSel === 1 ? ' sel' : '') + (!a ? ' dis' : '') + '" data-tap="m1"><b>2: ターゲット</b><span>1〜10 点を測る・図・次回予測</span></button>' +
        '<button type="button" class="ca-mbtn' + (mainSel === 2 ? ' sel' : '') + '" data-tap="m2"><b>3: 記録</b><span>保存した測量の結果（' + s.records.length + ' 件）</span></button>' +
        '</div></div>';
    } else if (scr === 'alignList') {
      const list = sortedAligns(), sentei = env.senteiAligns ? env.senteiAligns() : [];
      html = headHtml('線形を選ぶ') + '<div class="ca-lcd">' +
        '<div class="ca-btns"><button type="button" class="ca-btn pri" data-tap="new">＋ 新しく入れる</button></div>' +
        (list.length ? '<table class="ca-tbl"><tbody>' + list.map((e, i) =>
          '<tr><td><b>' + esc(e.name) + (e.name === s.cur ? '（使用中）' : '') + '</b><div class="ca-sub">' + alignSummary(e.align).map(esc).join(' / ') + '</div></td>' +
          '<td class="ca-act"><button type="button" class="ca-btn pri" data-tap="use:' + i + '">使う</button> ' +
          '<button type="button" class="ca-btn" data-tap="edit:' + i + '">直す</button> ' +
          '<button type="button" class="ca-btn dan" data-tap="del:' + i + '">消す</button></td></tr>'
        ).join('') + '</tbody></table>' : '<p class="ca-msg">まだ線形がありません。「新しく入れる」を押してください。</p>') +
        (sentei.length ? '<div class="ca-sub" style="margin-top:6px">SENTEI から写す：' + sentei.map((x, i) =>
          '<button type="button" class="ca-btn" data-tap="sentei:' + i + '">' + esc(x.name) + '</button>'
        ).join(' ') + '</div>' : '') +
        '</div>';
    } else if (scr === 'alignEdit') {
      const e = alEdit;
      html = headHtml(e.entry ? '線形を直す' : '線形を入れる') +
        '<div class="ca-lcd">' +
        '<p class="ca-hint">セルを押すか ▲▼ で選び、下の「日本語 / ALPHA / 数字」で入力切替</p>' +
        '<table class="ca-tbl"><tbody>' + e.fields.map((f, i) => {
          const on = e.sel === i, v = f.get();
          let disp;
          if (f.kind === 'dir') {
            disp = '<span class="ca-dir">' + (v === 'L' ? '左（L）' : '右（R）') + '</span> <span class="ca-sub">タップ/EXEで切替</span>';
          } else if (f.kind === 'angle') {
            const p = Vw.parseAngle(v);
            disp = cellVal(v, on) + (p == null ? '' : Number.isFinite(p) ? ' <span class="ca-ok">→ ' + esc(Vw.fmtAngle(p)) + '</span>' : ' <span class="ca-bad">？</span>');
          } else {
            disp = cellVal(v, on);
          }
          return '<tr class="' + (on ? 'ca-active' : '') + '" data-tap="f:' + i + '"><th>' + esc(f.label) + '</th><td class="ca-val">' + disp + '</td></tr>';
        }).join('') + '</tbody></table>' +
        (msg ? '<p class="ca-err">' + esc(msg) + '</p>' : '') +
        '<div class="ca-btns">' +
        '<button type="button" class="ca-btn" data-tap="addc">＋曲線を足す</button>' +
        '<button type="button" class="ca-btn dan" data-tap="delc">－最後の曲線</button>' +
        '<button type="button" class="ca-btn pri" data-tap="save">保存して使う</button>' +
        '</div></div>';
    } else if (scr === 'transit') {
      const t = trSt;
      const angHint = v => {
        const p = Vw.parseAngle(v);
        return p == null ? '' : Number.isFinite(p) ? ' <span class="ca-ok">' + esc(Vw.fmtAngle(p)) + '</span>' : ' <span class="ca-bad">？</span>';
      };
      const cell = (idx, label) => {
        const f = t.fields[idx], on = t.sel === idx, isAng = f.kind === 'angle';
        const valHtml = (on && t.hasPrev)
          ? '<div class="ca-prev">' + esc(f.get()) + (isAng ? angHint(f.get()) : '') + '</div><div class="ca-draft">' + cellVal(t.draft, true) + (isAng ? angHint(t.draft) : '') + '</div>'
          : cellVal(f.get(), on) + (isAng ? angHint(f.get()) : '');
        return '<td class="ca-val' + (on ? ' ca-active' : '') + '" data-tap="f:' + idx + '"><span class="ca-lbl">' + esc(label) + '</span>' + valHtml + '</td>';
      };
      html = headHtml('トランシット（' + t.a.name + '）') +
        '<div class="ca-lcd"><table class="ca-tbl ca-transit-tbl"><tbody>' +
        '<tr>' + cell(0, '後視点 X') + cell(1, '後視点 Y') + '</tr>' +
        '<tr>' + cell(2, '機械点 X') + cell(3, '機械点 Y') + '</tr>' +
        '<tr>' + cell(4, '距離') + cell(5, '角度') + '</tr>' +
        '<tr><th>測った点・誤差</th><td>' + (t.res ? '測点X ' + f3(t.res.p.x) + '　測点Y ' + f3(t.res.p.y) + '<br><b>' + esc(Vw.sideLine(t.res.j)) + '</b>' : '―') + '</td></tr>' +
        '</tbody></table>' +
        (msg ? '<p class="ca-err">' + esc(msg) + '</p>' : '') +
        '<div class="ca-btns"><button type="button" class="ca-btn pri" data-tap="go">機械点を進める（確定）</button></div></div>';
    } else if (scr === 'transitDone') {
      const d = trSt.done, b = d.before, af = d.after;
      html = headHtml('機械点を進めました') + '<div class="ca-lcd">' +
        '<p class="ca-msg"><b>測点X ' + f3(d.p.x) + '　測点Y ' + f3(d.p.y) + '　' + esc(d.side) + '</b></p>' +
        '<table class="ca-tbl"><thead><tr><th>項目</th><th>前</th><th></th><th>後</th></tr></thead><tbody>' +
        '<tr><th>後視点 X</th><td>' + f3(b.A) + '</td><td>→</td><td><b>' + f3(af.A) + '</b></td></tr>' +
        '<tr><th>後視点 Y</th><td>' + f3(b.B) + '</td><td>→</td><td><b>' + f3(af.B) + '</b></td></tr>' +
        '<tr><th>機械点 X</th><td>' + f3(b.C) + '</td><td>→</td><td><b>' + f3(af.C) + '</b></td></tr>' +
        '<tr><th>機械点 Y</th><td>' + f3(b.D) + '</td><td>→</td><td><b>' + f3(af.D) + '</b></td></tr>' +
        '</tbody></table>' +
        '<div class="ca-btns"><button type="button" class="ca-btn pri" data-tap="ok2">戻る（EXE）</button></div></div>';
    } else if (scr === 'targetCount') {
      html = headHtml('ターゲットの数') + '<div class="ca-lcd">' +
        '<p class="ca-msg">測る点の数を選んでください（4 点で推進管の次回予測が出ます）</p>' +
        '<div class="ca-nums">' + Array.from({ length: 10 }, (_, i) =>
          '<button type="button" class="ca-nbtn' + (i === 3 ? ' pri' : '') + '" data-tap="n:' + (i + 1) + '">' + (i + 1) + '</button>'
        ).join('') + '</div></div>';
    } else if (scr === 'targetTable') {
      const t = tgSt;
      const angHint = v => {
        const p = Vw.parseAngle(v);
        return p == null ? '' : Number.isFinite(p) ? ' <span class="ca-ok">' + esc(Vw.fmtAngle(p)) + '</span>' : ' <span class="ca-bad">？</span>';
      };
      const stCell = (idx, label) => {
        const f = t.fields[idx], on = t.sel === idx;
        const valHtml = (on && t.hasPrev)
          ? '<div class="ca-prev">' + esc(f.get()) + '</div><div class="ca-draft">' + cellVal(t.draft, true) + '</div>'
          : cellVal(f.get(), on);
        return '<td class="ca-val' + (on ? ' ca-active' : '') + '" data-tap="f:' + idx + '"><span class="ca-lbl">' + label + '</span>' + valHtml + '</td>';
      };
      html = headHtml('ターゲット（' + t.a.name + '）') +
        '<div class="ca-lcd">' +
        '<table class="ca-tbl"><tbody>' +
        '<tr>' + stCell(0, '後視 X') + stCell(1, '後視 Y') + stCell(2, '機械 X') + stCell(3, '機械 Y') + '</tr>' +
        '</tbody></table>' +
        '<table class="ca-tbl" style="margin-top:4px"><thead><tr><th>測点</th><th>距離</th><th>角度</th><th>誤差</th></tr></thead><tbody>' +
        t.rows.map((r, i) => {
          const di = 4 + i * 2, ai = di + 1;
          const distView = (t.sel === di && t.hasPrev)
            ? '<div class="ca-prev">' + esc(r.d) + '</div><div class="ca-draft">' + cellVal(t.draft, true) + '</div>'
            : cellVal(r.d, t.sel === di);
          const angView = (t.sel === ai && t.hasPrev)
            ? '<div class="ca-prev">' + esc(r.an) + angHint(r.an) + '</div><div class="ca-draft">' + cellVal(t.draft, true) + angHint(t.draft) + '</div>'
            : cellVal(r.an, t.sel === ai) + angHint(r.an);
          return '<tr><th>' + esc(r.name) + '</th>' +
            '<td class="ca-val' + (t.sel === di ? ' ca-active' : '') + '" data-tap="f:' + di + '">' + distView + '</td>' +
            '<td class="ca-val' + (t.sel === ai ? ' ca-active' : '') + '" data-tap="f:' + ai + '">' + angView + '</td>' +
            '<td class="ca-errcell">' + (r.res ? esc(Vw.sideLine(r.res.j)) : '―') + '</td></tr>';
        }).join('') +
        '</tbody></table>' +
        (msg ? '<p class="ca-err">' + esc(msg) + '</p>' : '') +
        '<div class="ca-btns"><button type="button" class="ca-btn pri" data-tap="check">確かめへ（EXE）</button></div></div>';
    } else if (scr === 'targetConfirm') {
      const t = tgSt, s = stationOfTarget();
      const resCell = (x, y, j) => '<td class="ca-rescell"><div class="ca-res">' +
        '<div class="ca-res-xy"><span>X ' + f3(x) + '</span><span>Y ' + f3(y) + '</span></div>' +
        '<div class="ca-res-pos"><span>' + esc(posCode(j)) + '</span><span><b>' + esc(Vw.mmText(j)) + '</b></span></div>' +
        '</div></td>';
      let predHtml = '';
      if (t.preds && t.preds.length) {
        const lenView = t.predEditing
          ? '<div class="ca-prev">' + esc(t.predLen) + '</div><div class="ca-draft">' + cellVal(t.predDraft, true) + '</div>'
          : cellVal(t.predLen, false);
        predHtml = '<div class="ca-predbox">' +
          '<div class="ca-predhead"><b>次回予測</b><span>折れ角 ' + t.preds[0].bend.toFixed(3) + '°</span></div>' +
          '<div class="ca-predctrl">' +
          '<div class="ca-predlen' + (t.predEditing ? ' ca-active' : '') + '" data-tap="plen"><span class="ca-lbl">1本進む距離 (m)</span>' + lenView + '</div>' +
          '<div class="ca-predcnt"><span class="ca-lbl">何本後まで</span><div class="ca-pcnts">' +
          [1, 2, 3, 4, 5].map(k => '<button type="button" class="ca-pcnt' + (t.predCount === k ? ' on' : '') + '" data-tap="pcnt:' + k + '">' + k + '</button>').join('') +
          '</div></div></div>' +
          '<table class="ca-tbl ca-predtbl"><tbody>' +
          t.preds.map(pr => '<tr><th>' + (t.preds.length === 1 ? '1本後' : pr.step + '本後') + '</th>' +
            '<td>X ' + f3(pr.x) + '<br>Y ' + f3(pr.y) + '</td>' +
            '<td><b>' + esc(posCode(pr.j)) + '</b><br><b>' + esc(Vw.mmText(pr.j)) + '</b></td></tr>').join('') +
          '</tbody></table></div>';
      }
      html = headHtml('入れた値の確かめ') + '<div class="ca-lcd">' +
        predHtml +
        '<p class="ca-sub">後視点 X ' + f3(s.bx) + '　Y ' + f3(s.by) + ' ／ 機械点 X ' + f3(s.ox) + '　Y ' + f3(s.oy) + '</p>' +
        '<table class="ca-tbl ca-confirm-tbl"><thead><tr><th>測点</th><th>距離</th><th>角度</th><th>誤差</th></tr></thead><tbody>' +
        t.rows.map(r => {
          const p = r.res;
          return '<tr><th>' + esc(p.name) + '</th><td>' + f3(p.d) + '</td><td>' + esc(Vw.fmtAngle(p.h)) + '</td>' +
            resCell(p.x, p.y, p.j) + '</tr>';
        }).join('') +
        '</tbody></table>' +
        '<div class="ca-btns"><button type="button" class="ca-btn" data-tap="fix">戻って直す</button>' +
        '<button type="button" class="ca-btn pri" data-tap="visual">図を見る（EXE）</button></div></div>';
    } else if (scr === 'pipeNo') {
      html = headHtml('測量結果を保存しますか') + '<div class="ca-lcd">' +
        '<p class="ca-msg">管番号を入れると「日付・時刻＋管番号」で保存します（BACKUP に入ります）。</p>' +
        '<table class="ca-tbl"><tbody><tr class="ca-active"><th>管番号</th><td class="ca-val">' + cellVal(pipeSt.no, true) + '</td></tr></tbody></table>' +
        (msg ? '<p class="ca-err">' + esc(msg) + '</p>' : '') +
        '<div class="ca-btns"><button type="button" class="ca-btn" data-tap="skip">保存しない</button>' +
        '<button type="button" class="ca-btn pri" data-tap="save">保存する（EXE）</button></div></div>';
    }
    screenEl.innerHTML = html;
    const act = screenEl.querySelector('.ca-active');
    if (act) act.scrollIntoView({ block: 'nearest' });
  }

  root.FxCurveApp = { enter, render, onKey, onChar, onTap, getText, replaceTail, alignSummary, canFlick, isAngleField };
})(typeof window !== 'undefined' ? window : globalThis);
