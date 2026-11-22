// 測設タブ・履歴タブ・点を選ぶダイアログ
(function () {
  'use strict';
  const A = FxAngle, G = FxGeo, P = FxPoints, ST = FxStore, D = FxDialog, SK = FxSokusetsu, GB = FxGenba, h = D.h;
  const { state, toast, guard, esc, f3 } = GB;
  const $ = id => document.getElementById(id);

  const blank = () => ({ k1: null, k2: null, o1: { h: '', s: '' }, o2: { h: '', s: '' }, targets: [], memo: '' });
  let calc = blank();
  let res = null;
  // 図の状態（表示のしかた・全部／1 点ずつ・いまの測点）
  const pv = { mode: 'deform', one: false, idx: 0, full: false, plot: null };
  try { const m = localStorage.getItem('fx5800p-genba-plotmode'); if (['real', 'deform', 'local'].includes(m)) pv.mode = m; } catch { /* 無視 */ }
  const uid = () => ST.uid();
  const settings = () => Object.assign({ angleStyle: 'hyphen', dmsDot: false, zero: 'k1', tol: 0.010 }, state.site && state.site.settings);
  const fa = v => Number.isFinite(v) ? A.format(v, { style: settings().angleStyle }) : '―';
  const fd = v => Number.isFinite(v) ? v.toFixed(3) : '―';

  // ---- 下書き（画面の状態を現場ごとに残す） ----
  let draftTimer;
  function saveDraft() {
    if (!state.site) return;
    const id = state.site.id;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => guard(() => ST.setMeta('draft:' + id, calc)), 300);
  }
  async function loadDraft() {
    calc = state.site ? Object.assign(blank(), await ST.getMeta('draft:' + state.site.id, null)) : blank();
    renderCalc();
  }

  // ---- 点を選ぶダイアログ ----
  //   opt.multi：複数選ぶ。opt.title。戻り値：[{ name, x, y, pointId }]（やめたら null）
  function pickPoints(opt) {
    opt = opt || {};
    return new Promise(resolve => {
      let result = null;
      const sel = new Map();           // id → 点（手入力は 'm:' で始まる id）
      let q = '', kind = '', rangeFrom = null, rangeMode = false, shown = [];
      const input = h('input', { type: 'search', placeholder: '点名で探す（数字だけでも可）', autocomplete: 'off', enterkeyhint: 'search' });
      const chips = h('div', { class: 'chips' });
      const ul = h('ul', { class: 'list pick-list' });
      const info = h('div', { class: 'pick-info small' });
      const rangeBtn = opt.multi ? h('button', { type: 'button', class: 'chip-btn', text: '範囲で選ぶ' }) : null;
      const allBtn = opt.multi ? h('button', { type: 'button', class: 'chip-btn', text: '表示中を全部' }) : null;
      let okBtn = null;
      // 手入力
      const mName = h('input', { placeholder: '点名', maxlength: P.NAME_MAX, autocomplete: 'off' });
      const mX = h('input', { class: 'num', placeholder: 'X（北）', inputmode: 'decimal', autocomplete: 'off' });
      const mY = h('input', { class: 'num', placeholder: 'Y（東）', inputmode: 'decimal', autocomplete: 'off' });
      const mReg = h('input', { type: 'checkbox' });
      const mErr = h('p', { class: 'err' });
      const mBtn = h('button', { type: 'button', class: 'primary', text: opt.multi ? '選んだ点に足す' : 'この点を使う' });
      const manual = h('details', { class: 'manual' }, [h('summary', { text: '一覧にない点を手で入れる' }),
        h('div', { class: 'form' }, [h('label', { text: '点名' }), mName, h('label', { text: 'X（北）' }), mX, h('label', { text: 'Y（東）' }), mY]),
        h('label', { class: 'chk' }, [mReg, ' 現場の座標一覧にも登録する']), h('div', { class: 'row-end' }, [mBtn]), mErr]);

      function draw() {
        chips.innerHTML = '';
        const counts = {}; for (const p of state.points) counts[p.kind] = (counts[p.kind] || 0) + 1;
        for (const k of [''].concat(P.KINDS)) {
          if (k && !counts[k]) continue;
          chips.append(h('button', { type: 'button', class: kind === k ? 'on' : '', text: k || '全部', onclick: () => { kind = kind === k ? '' : k; draw(); } }));
        }
        if (rangeBtn) { rangeBtn.classList.toggle('on', rangeMode); chips.append(rangeBtn, allBtn); }
        shown = P.search(state.points, q, { kind, recent: state.recent });
        const recent = new Set(state.recent.slice(0, 5));
        ul.innerHTML = '';
        if (!shown.length) ul.append(h('li', { class: 'none', text: state.points.length ? '見つかりません' : '座標一覧に点がありません。下の「手で入れる」を使ってください' }));
        for (const p of shown.slice(0, 300)) {
          const on = sel.has(p.id);
          const li = h('li', { 'data-id': p.id, class: (on ? 'sel ' : '') + (rangeFrom === p.id ? 'from' : '') });
          li.innerHTML = (opt.multi ? '<span class="ck">' + (on ? '☑' : '☐') + '</span>' : '')
            + '<span class="nm">' + (recent.has(p.id) && !q ? '🕘 ' : '') + esc(p.name) + '</span><span class="kd">' + esc(p.kind) + '</span>'
            + '<span class="xy">X ' + f3(p.x) + '　Y ' + f3(p.y) + '</span>';
          ul.append(li);
        }
        if (shown.length > 300) ul.append(h('li', { class: 'none', text: 'ほか ' + (shown.length - 300) + ' 点。絞り込んでください' }));
        const manualSel = [...sel.values()].filter(p => p.manual);
        info.textContent = opt.multi ? (sel.size ? sel.size + ' 点を選んでいます' + (manualSel.length ? '（手入力 ' + manualSel.length + '）' : '') : '点を押して選んでください') + (rangeMode ? (rangeFrom ? '　範囲：終わりの点を押してください' : '　範囲：始めの点を押してください') : '') : '点を押すと決まります';
        if (okBtn) { okBtn.disabled = !sel.size; okBtn.textContent = sel.size ? '決定（' + sel.size + '）' : '決定'; }
      }
      let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q = input.value; draw(); }, 60); });
      if (rangeBtn) {
        rangeBtn.addEventListener('click', () => { rangeMode = !rangeMode; rangeFrom = null; draw(); });
        allBtn.addEventListener('click', () => { for (const p of shown) sel.set(p.id, p); draw(); });
      }
      const toOut = p => ({ name: p.name, x: p.x, y: p.y, pointId: p.manual ? null : p.id });
      let dlg = null;
      ul.addEventListener('click', e => {
        const li = e.target.closest('li[data-id]'); if (!li) return;
        const p = state.points.find(x => x.id === li.dataset.id); if (!p) return;
        if (!opt.multi) { result = [toOut(p)]; GB.useRecent([p.id]); dlg.close(); return; }
        if (rangeMode) {
          if (!rangeFrom) { rangeFrom = p.id; draw(); return; }
          const from = shown.find(x => x.id === rangeFrom);
          for (const x of P.range(shown, from.name, p.name)) sel.set(x.id, x);
          rangeFrom = null; rangeMode = false; draw(); return;
        }
        if (sel.has(p.id)) sel.delete(p.id); else sel.set(p.id, p);
        draw();
      });
      mBtn.addEventListener('click', () => guard(async () => {
        mErr.textContent = '';
        const n = mName.value.trim(), x = P.num(mX.value), y = P.num(mY.value);
        if (!n) { mErr.textContent = '点名を入れてください'; return; }
        if (!Number.isFinite(x) || !Number.isFinite(y)) { mErr.textContent = 'X・Y を数字で入れてください'; return; }
        let p = { id: 'm:' + uid(), name: n, x, y, manual: true };
        if (mReg.checked) {
          if (state.points.some(q => q.name === n)) { mErr.textContent = '同じ点名が座標一覧にもうあります。一覧から選んでください'; return; }
          const rec = ST.newPoint(state.site.id, { name: n, x, y, kind: '測点', src: '手入力' }, Date.now());
          await ST.putPoints(state.site.id, [rec]); await GB.loadPoints();
          p = rec;
        }
        if (!opt.multi) { result = [toOut(p)]; if (!p.manual) GB.useRecent([p.id]); dlg.close(); return; }
        sel.set(p.id, p); mName.value = mX.value = mY.value = ''; manual.open = false; draw();
        toast('「' + n + '」を足しました');
      }));
      const buttons = [{ label: 'やめる' }];
      if (opt.multi) buttons.push({ label: '決定', kind: 'primary', ref: b => { okBtn = b; }, onClick: () => {
        result = [...sel.values()].map(toOut);
        GB.useRecent([...sel.values()].filter(p => !p.manual).map(p => p.id));
      } });
      dlg = D.open({
        title: opt.title || '点を選ぶ', width: 560, buttons,
        body: h('div', { class: 'picker' }, [input, chips, info, ul, manual]),
        onClose: () => resolve(result)
      });
      draw();
      if (opt.manualOpen) { manual.open = true; setTimeout(() => mName.focus(), 50); }
      else setTimeout(() => input.focus(), 50);
    });
  }

  // ---- 測設タブ ----
  function obsInputs(key, o) {
    const hIn = h('input', { class: 'num', 'data-f': key + '.h', value: o.h || '', placeholder: '0-00-00', inputmode: 'decimal', autocomplete: 'off', 'aria-label': '水平角' });
    const sIn = h('input', { class: 'num', 'data-f': key + '.s', value: o.s || '', placeholder: '0.000', inputmode: 'decimal', autocomplete: 'off', 'aria-label': '水平距離' });
    return h('div', { class: 'obs' }, [
      h('label', {}, [h('span', { text: '水平角' }), hIn, h('span', { class: 'hint', 'data-hint': key + '.h' })]),
      h('label', {}, [h('span', { text: '水平距離' }), sIn, h('span', { class: 'hint', 'data-hint': key + '.s' })])
    ]);
  }
  function knownCard(key, label, sub) {
    const p = calc[key], o = calc[key === 'k1' ? 'o1' : 'o2'];
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-h' }, [h('b', { text: label }), h('span', { class: 'small', text: sub })]),
      h('button', { type: 'button', class: 'pick' + (p ? '' : ' empty'), 'data-pick': key, html: p ? '<b>' + esc(p.name) + '</b><span class="xy">X ' + f3(p.x) + '　Y ' + f3(p.y) + '</span>' : '点を選ぶ（一覧から・手入力）' }),
      obsInputs(key === 'k1' ? 'o1' : 'o2', o)
    ]);
  }
  function targetCard(t, i) {
    const card = h('div', { class: 'tcard' + (t.done ? ' done' : ''), 'data-id': t.id }, [
      h('div', { class: 't-h' }, [
        h('span', { class: 't-no', text: '測点' + (i + 1) }),
        t.mode === 'obs' ? h('input', { class: 't-name', 'data-tf': 'name', value: t.name, maxlength: P.NAME_MAX, 'aria-label': '点名' }) : h('b', { class: 't-name', text: t.name }),
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'mini', 'data-act': 'up', title: '上へ', text: '▲' }),
        h('button', { type: 'button', class: 'mini', 'data-act': 'down', title: '下へ', text: '▼' }),
        h('button', { type: 'button', class: 'mini', 'data-act': 'del', title: '外す', text: '✕' })
      ]),
      t.mode === 'obs' ? h('div', { class: 'obs' }, [
        h('label', {}, [h('span', { text: '水平角' }), h('input', { class: 'num', 'data-tf': 'h', value: t.h || '', placeholder: '0-00-00', inputmode: 'decimal', autocomplete: 'off' })]),
        h('label', {}, [h('span', { text: '水平距離' }), h('input', { class: 'num', 'data-tf': 's', value: t.s || '', placeholder: '0.000', inputmode: 'decimal', autocomplete: 'off' })])
      ]) : null,
      h('div', { class: 't-big', 'data-out': 'big' }),
      h('div', { class: 't-foot' }, [h('span', { class: 't-xy', 'data-out': 'xy' }), h('span', { class: 'grow' }),
        h('label', { class: 'chk' }, [h('input', { type: 'checkbox', 'data-tf': 'done', checked: t.done }), ' 済'])]),
      h('div', { class: 'err', 'data-out': 'err' })
    ]);
    return card;
  }
  function renderCalc() {
    const view = $('calcView');
    $('calcNoSite').hidden = !!state.site; view.hidden = !state.site;
    if (!state.site) return;
    if (pv.plot) { pv.plot.destroy(); pv.plot = null; }
    view.innerHTML = '';
    const st = settings();
    view.append(
      h('div', { class: 'calc-top' }, [h('span', { class: 'small', text: '0 の向き：' + (st.zero === 'raw' ? '器械の読みのまま' : '既知点1を 0-00-00') + '　許容値 ' + Math.round(st.tol * 1000) + ' mm' + (st.dmsDot ? '　度.分秒' : '') }), h('span', { class: 'grow' }),
        h('button', { type: 'button', id: 'cSettings', class: 'mini', text: '⚙ 設定' })]),
      knownCard('k1', '既知点1', '先に視準する点'),
      h('div', { class: 'swap-row' }, [h('button', { type: 'button', id: 'cSwap', class: 'mini', text: '⇅ 既知点1と2を入れ替える' })]),
      knownCard('k2', '既知点2', '次に視準する点'),
      h('div', { class: 'card result', id: 'cResult' }),
      plotCard(),
      h('h3', { class: 'sec', text: '測点' }),
      h('div', { id: 'tList' }, calc.targets.map(targetCard)),
      h('div', { class: 'bar add-bar' }, [
        h('button', { type: 'button', id: 'tPick', text: '＋ 一覧から選ぶ' }),
        h('button', { type: 'button', id: 'tXY', text: '＋ 座標を手入力' }),
        h('button', { type: 'button', id: 'tObs', text: '＋ 距離・角度から' })
      ]),
      h('input', { id: 'cMemo', class: 'memo', placeholder: 'メモ（履歴に残ります）', value: calc.memo || '', autocomplete: 'off' }),
      h('div', { class: 'bar save-bar' }, [
        h('button', { type: 'button', id: 'cNew', text: '新しい計算' }), h('span', { class: 'grow' }),
        h('button', { type: 'button', id: 'cSave', class: 'primary big', text: '履歴に保存' })
      ]),
      h('div', { class: 'bar calc-prog' }, [
        h('button', { type: 'button', id: 'cProg', class: 'mini', text: '🖩 電卓（実機）用の測設プログラム' })
      ])
    );
    pv.plot = FxPlot.create($('cPlot'), { mode: pv.mode, origin: 'st', label: '既知点・器械点・測点の図' });
    update();
  }
  function plotCard() {
    const seg = (key, items) => h('div', { class: 'seg', role: 'group' }, items.map(([v, t]) => h('button', { type: 'button', ['data-' + key]: v, class: (key === 'pm' ? pv.mode === v : String(pv.one) === v) ? 'on' : '', text: t })));
    return h('div', { class: 'card plot-card' + (pv.full ? ' full' : ''), id: 'cPlotCard' }, [
      h('div', { class: 'plot-bar' }, [
        seg('pm', [['deform', 'デフォルメ'], ['real', '実縮尺'], ['local', '測点まわり']]),
        seg('pone', [['false', '全部'], ['true', '1点ずつ']]),
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'mini', 'data-pa': 'fit', title: '全体を表示（図をダブルクリックでも）', text: '全体' }),
        h('button', { type: 'button', class: 'mini', 'data-pa': 'full', title: '図を大きく', text: pv.full ? '✕ 戻す' : '⛶ 大きく' })
      ]),
      h('div', { class: 'plot-host', id: 'cPlot' }),
      h('div', { class: 'plot-nav', id: 'cPlotNav', hidden: !pv.one }, [
        h('button', { type: 'button', class: 'mini', 'data-pa': 'prev', text: '◀' }),
        h('div', { class: 'plot-now', id: 'cPlotNow' }),
        h('button', { type: 'button', class: 'mini', 'data-pa': 'next', text: '▶' })
      ])
    ]);
  }
  // 図に渡す点と線
  function updatePlot() {
    if (!pv.plot || !res) return;
    const pts = [], lines = [];
    if (calc.k1) pts.push({ id: 'k1', name: calc.k1.name, x: calc.k1.x, y: calc.k1.y, role: 'known' });
    if (calc.k2) pts.push({ id: 'k2', name: calc.k2.name, x: calc.k2.x, y: calc.k2.y, role: 'known' });
    if (res.ready) {
      pts.push({ id: 'st', name: '機械点1', x: res.station.x, y: res.station.y, role: 'station' });
      lines.push({ from: 'st', to: 'k1', style: 'dash', label: '既知点1' }, { from: 'st', to: 'k2', style: 'dash', label: '既知点2' });
    }
    const valid = res.targets.filter(t => Number.isFinite(t.x) && Number.isFinite(t.y));
    for (const t of valid) {
      pts.push({ id: t.id, name: t.name || '測点', x: t.x, y: t.y, role: 'target' });
      if (res.ready && Number.isFinite(t.h)) lines.push({ from: 'st', to: t.id, style: 'solid', label: '角 ' + fa(t.h) + ' / 距 ' + fd(t.s) });
    }
    pv.plot.set({ points: pts, lines });
    // 1 点ずつ
    const nav = $('cPlotNav'), now = $('cPlotNow');
    if (nav) nav.hidden = !pv.one;
    if (pv.one && valid.length) {
      pv.idx = Math.min(Math.max(pv.idx, 0), valid.length - 1);
      const t = valid[pv.idx];
      if (pv.plot.focused !== t.id) pv.plot.focus(t.id);
      now.innerHTML = '<span class="small">' + (pv.idx + 1) + ' / ' + valid.length + '</span> <b>' + esc(t.name) + '</b>'
        + (res.ready && Number.isFinite(t.h) ? '<span class="pn-v">角 <b>' + fa(t.h) + '</b>　距 <b>' + fd(t.s) + '</b></span>' : '');
    } else {
      if (pv.plot.focused) pv.plot.focus(null);
      if (now) now.textContent = pv.one ? '測点がありません' : '';
    }
  }
  function plotAction(b) {
    if (b.dataset.pm) {
      pv.mode = b.dataset.pm; pv.plot.setMode(pv.mode);
      try { localStorage.setItem('fx5800p-genba-plotmode', pv.mode); } catch { /* 無視 */ }
      b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      return true;
    }
    if (b.dataset.pone) {
      pv.one = b.dataset.pone === 'true';
      b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      if (!pv.one) pv.plot.focus(null);
      updatePlot(); return true;
    }
    const a = b.dataset.pa; if (!a) return false;
    if (a === 'fit') pv.plot.fit();
    else if (a === 'full') {
      pv.full = !pv.full;
      $('cPlotCard').classList.toggle('full', pv.full);
      document.documentElement.classList.toggle('plot-full', pv.full);
      b.textContent = pv.full ? '✕ 戻す' : '⛶ 大きく';
      setTimeout(() => pv.plot.fit(), 30);
    } else if (a === 'prev' || a === 'next') { pv.idx += a === 'prev' ? -1 : 1; const n = res.targets.filter(t => Number.isFinite(t.x)).length; if (n) pv.idx = (pv.idx + n) % n; updatePlot(); }
    return true;
  }
  // 測点の行を押したら、その点を図で 1 点ずつ表示する
  function focusTarget(id) {
    const valid = res.targets.filter(t => Number.isFinite(t.x) && Number.isFinite(t.y));
    const i = valid.findIndex(t => t.id === id); if (i < 0) return;
    pv.one = true; pv.idx = i;
    document.querySelectorAll('[data-pone]').forEach(x => x.classList.toggle('on', x.dataset.pone === 'true'));
    updatePlot();
    if (!pv.full) $('cPlotCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  // 入力を残したまま答えだけ描き直す
  function update() {
    if (!state.site) return;
    const st = settings();
    res = SK.compute(calc, st);
    const hint = (key, text, bad) => { const el = document.querySelector('[data-hint="' + key + '"]'); if (el) { el.textContent = text; el.classList.toggle('bad', !!bad); } const inp = document.querySelector('[data-f="' + key + '"]'); if (inp) inp.classList.toggle('bad', !!bad); };
    for (const [k, o, src] of [['o1', res.obs1, calc.o1], ['o2', res.obs2, calc.o2]]) {
      hint(k + '.h', o.errH || (Number.isFinite(o.h) && src.h && !/^\s*\d+-\d+-\d+(\.\d+)?\s*$/.test(src.h) ? '＝ ' + fa(o.h) : ''), !!o.errH);
      hint(k + '.s', o.errS, !!o.errS);
    }
    const r = $('cResult');
    if (!res.ready) {
      r.className = 'card result wait';
      r.innerHTML = '<div class="card-h"><b>機械点1</b></div><p class="small">' + esc(res.error) + '</p>';
    } else {
      const c = res.fs.check, mm = (c.diff * 1000);
      r.className = 'card result ' + (c.ok ? 'ok' : 'ng');
      r.innerHTML = '<div class="card-h"><b>機械点1</b></div>'
        + '<div class="xy-big">X <b>' + f3(res.station.x) + '</b>　Y <b>' + f3(res.station.y) + '</b></div>'
        + '<div class="check">' + (c.ok ? '✓' : '✗') + ' 既知点間　観測 ' + c.dObs.toFixed(3) + ' ／ 座標 ' + c.dCoord.toFixed(3) + ' ／ 差 ' + (mm >= 0 ? '+' : '') + mm.toFixed(1) + ' mm</div>'
        + '<div class="small">間の角 ' + c.between.toFixed(1) + '°　縮尺 ' + c.scale.toFixed(6) + '</div>'
        + res.fs.warnings.map(w => '<div class="warn">⚠ ' + esc(w) + '</div>').join('');
    }
    res.targets.forEach(t => {
      const card = document.querySelector('.tcard[data-id="' + t.id + '"]'); if (!card) return;
      card.querySelector('[data-out="big"]').innerHTML = res.ready && Number.isFinite(t.h)
        ? (t.mode === 'obs' ? '<span class="lab">X</span><span class="v">' + fd(t.x) + '</span><span class="lab">Y</span><span class="v">' + fd(t.y) + '</span>'
          : '<span class="lab">角</span><span class="v ang">' + fa(t.h) + '</span><span class="lab">距</span><span class="v">' + fd(t.s) + '</span>')
        : '<span class="small">' + (t.error ? '' : '機械点1が決まると出ます') + '</span>';
      card.querySelector('[data-out="xy"]').textContent = t.mode === 'obs' ? (res.ready && Number.isFinite(t.h) ? '角 ' + fa(t.h) + '　距 ' + fd(t.s) : '')
        : 'X ' + f3(t.x) + '　Y ' + f3(t.y) + (res.ready && Number.isFinite(t.az) ? '　方向角 ' + fa(t.az) : '');
      card.querySelector('[data-out="err"]').textContent = t.error;
    });
    updatePlot();
  }

  function setField(path, v) { const [a, b] = path.split('.'); calc[a][b] = v; }
  function bindCalc() {
    const view = $('calcView');
    view.addEventListener('input', e => {
      const f = e.target.dataset.f, tf = e.target.dataset.tf;
      if (f) setField(f, e.target.value);
      else if (tf) {
        const t = calc.targets.find(x => x.id === e.target.closest('.tcard').dataset.id);
        if (tf === 'done') { t.done = e.target.checked; e.target.closest('.tcard').classList.toggle('done', t.done); }
        else t[tf] = e.target.value;
      } else if (e.target.id === 'cMemo') calc.memo = e.target.value;
      else return;
      update(); saveDraft();
    });
    view.addEventListener('change', e => { if (e.target.dataset.tf === 'done') e.target.dispatchEvent(new Event('input', { bubbles: true })); });
    view.addEventListener('click', e => guard(async () => {
      const b = e.target.closest('button');
      if (!b) {
        const card = e.target.closest('.tcard');
        if (card && !e.target.closest('input,label')) focusTarget(card.dataset.id);
        return;
      }
      if (b.closest('#cPlotCard') && plotAction(b)) return;
      if (b.dataset.pick) {
        const r = await pickPoints({ title: (b.dataset.pick === 'k1' ? '既知点1（先に視準）' : '既知点2（次に視準）') + 'を選ぶ' });
        if (r) { calc[b.dataset.pick] = r[0]; renderCalc(); saveDraft(); }
        return;
      }
      const card = b.closest('.tcard');
      if (card && b.dataset.act) {
        const i = calc.targets.findIndex(x => x.id === card.dataset.id);
        if (b.dataset.act === 'del') calc.targets.splice(i, 1);
        else { const j = b.dataset.act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= calc.targets.length) return; [calc.targets[i], calc.targets[j]] = [calc.targets[j], calc.targets[i]]; }
        renderCalc(); saveDraft(); return;
      }
      switch (b.id) {
        case 'cSwap': [calc.k1, calc.k2] = [calc.k2, calc.k1]; [calc.o1, calc.o2] = [calc.o2, calc.o1]; renderCalc(); saveDraft(); toast('既知点1と2を入れ替えました'); break;
        case 'tPick': {
          const r = await pickPoints({ title: '測点を選ぶ（いくつでも）', multi: true });
          if (r && r.length) { for (const p of r) calc.targets.push({ id: uid(), mode: 'xy', name: p.name, x: p.x, y: p.y, pointId: p.pointId, done: false }); renderCalc(); saveDraft(); }
          break;
        }
        case 'tXY': {
          const r = await pickPoints({ title: '測点を手入力', multi: true, manualOpen: true });
          if (r && r.length) { for (const p of r) calc.targets.push({ id: uid(), mode: 'xy', name: p.name, x: p.x, y: p.y, pointId: p.pointId, done: false }); renderCalc(); saveDraft(); }
          break;
        }
        case 'tObs': {
          const n = calc.targets.filter(t => t.mode === 'obs').length + 1;
          calc.targets.push({ id: uid(), mode: 'obs', name: '観測' + n, h: '', s: '', done: false });
          renderCalc(); saveDraft();
          const last = document.querySelector('.tcard:last-child [data-tf="h"]'); if (last) last.focus();
          break;
        }
        case 'cSave': await saveCalc(); break;
        case 'cNew': {
          const has = calc.k1 || calc.k2 || calc.targets.length || calc.o1.h || calc.o1.s;
          if (has && !(await D.confirm('新しい計算', 'いまの入力を消して、新しい計算を始めます。\n履歴に保存していない内容は消えます。', '消して始める', 'danger'))) return;
          calc = blank(); renderCalc(); saveDraft(); break;
        }
        case 'cSettings': await settingsForm(); break;
        case 'cProg': calcProgramForm(); break;
      }
    }));
  }

  async function saveCalc() {
    if (!res || !res.ready) { toast(res && res.error ? res.error : '機械点1がまだ決まっていません'); return; }
    const snap = SK.snapshot(calc, res, settings(), calc.memo);
    await ST.putCalc(state.site.id, snap);
    toast('履歴に保存しました（測点 ' + snap.targets.length + ' 点）');
    await ST.setMeta('calcsSinceBackup', (await ST.getMeta('calcsSinceBackup', 0)) + 1);
    GB.checkBackup();
    if (state.tab === 'hist') renderHist();
  }

  // ---- 電卓（実機）用の測設プログラム ----
  function calcProgramForm() {
    const set = SK.calcPrograms(), res = set.map(p => ({ p, r: FxCcl.toCcl(p) }));
    const total = res.reduce((s, x) => s + x.r.size, 0);
    const rows = res.map(x => '<tr><td><b>' + esc(x.p.name) + '</b></td><td>' + esc(x.p.title) + '</td><td class="n">' + x.r.size + '</td><td class="small">' + esc(x.p.uses) + '</td></tr>').join('');
    const pre = h('pre', { class: 'prog-src', text: set.map(p => '■ ' + p.name + '（' + p.title + '）\n' + p.source).join('\n\n') });
    D.open({
      title: '電卓（実機）用の測設プログラム', width: 680,
      body: h('div', { class: 'prog-box' }, [
        h('p', { text: 'アプリの測設と同じ計算をする fx-5800P 用のプログラム一式です（全部で ' + total + ' バイト）。共通の部分は SUB（HADI・OBXY）にして、ほかのプログラムからも呼べるようにしています。' }),
        h('div', { class: 'tbl-wrap', html: '<table class="tbl"><thead><tr><th>名前</th><th>内容</th><th>バイト</th><th>使う変数</th></tr></thead><tbody>' + rows + '</tbody></table>' }),
        h('p', { class: 'small', text: 'NINI の使い方' }),
        h('ol', { class: 'small' }, [
          h('li', { text: 'Z 1/0：高さも出すなら 1（HI＝器械高、HT＝ターゲット高を聞きます）' }),
          h('li', { text: 'N：見る既知点の数（2 点以上）。既知点ごとに KX・KY（座標）、HA（水平角、°′″ キーで）、HD（水平距離）。高さありなら KZ（既知点の標高）、VD（高低差）' }),
          h('li', { text: 'SCALE（1 に近いほどよい）、RMS(MM)（観測のばらつき）、OX・OY（器械点）、OZ（器械点の地盤高）が出ます' }),
          h('li', { text: 'PX・PY に測点の座標を入れるたびに HA・HD が出ます。高さありなら PZ（計画高）を入れると、合わせる VD が出ます。AC で終わり' }),
          h('li', { text: 'KANSOKU：NINI のあとで、HA・HD を入れると、その点の座標 X・Y を出します' })
        ]),
        h('p', { class: 'small warn', text: '⚠ NINI は A〜Z の変数を全部使います。KAIHOU などほかのプログラムの値（A〜D の後視点・機械点など）は書き換わります。' }),
        pre,
        h('p', { class: 'small', text: '.ccl は CcLinker で電卓へ送れる形式です。手元の電卓から吸い出した 11 本で形式を確かめましたが、このプログラムを実機へ送って動かすのは、まだ確かめていません。SUB（HADI・OBXY）も一緒に送ってください。' })
      ]),
      buttons: [
        { label: '閉じる' },
        { label: '電卓アプリに入れる', onClick: () => {
          try {
            const KEY = 'fx5800p-emu-v1';
            const d = JSON.parse(localStorage.getItem(KEY) || '{}');
            d.programs = Array.isArray(d.programs) ? d.programs : [];
            for (const p of set) {
              const item = { name: p.name, mode: 'COMP', source: p.source };
              const i = d.programs.findIndex(x => x.name === p.name);
              if (i >= 0) d.programs[i] = item; else d.programs.push(item);
            }
            localStorage.setItem(KEY, JSON.stringify(d));
            toast('電卓アプリに ' + set.map(p => p.name).join('・') + ' を入れました（MODE → PROG → RUN → NINI）');
          } catch (e) { toast('入れられませんでした：' + e.message); return false; }
          return false;
        } },
        { label: '.ccl をまとめて書き出す（zip）', kind: 'primary', onClick: async () => {
          const ng = res.filter(x => !x.r.ok);
          if (ng.length) { toast('書き出せません：' + ng.map(x => x.p.name + ' ' + x.r.problems.map(q => q.msg).join('／')).join('、')); return false; }
          const zip = FxZip.make(res.map(x => ({ name: x.r.fileName, data: x.r.bytes })).concat([{ name: 'NINI一式の説明.txt', data: '﻿' + set.map(p => p.name + '：' + p.title + '\r\n使う変数：' + p.uses + '\r\n' + p.source.replace(/\n/g, '\r\n')).join('\r\n\r\n') }]));
          const how = await GB.download('NINI一式-' + GB.today() + '.zip', new Uint8Array(await zip.arrayBuffer()), 'application/zip');
          if (how) toast('NINI 一式（' + set.length + ' 本）を書き出しました');
          return false;
        } }
      ]
    });
  }

  // ---- 計算の設定（現場ごと） ----
  function settingsForm() {
    return new Promise(resolve => {
      const st = settings();
      const style = h('select', {}, [h('option', { value: 'hyphen', text: '161-33-54' }), h('option', { value: 'symbol', text: '161°33′54″' })]); style.value = st.angleStyle;
      const dot = h('input', { type: 'checkbox', checked: st.dmsDot });
      const zero = h('select', {}, [h('option', { value: 'k1', text: '既知点1を 0-00-00 にセット' }), h('option', { value: 'raw', text: '器械の読みをそのまま使う' })]); zero.value = st.zero;
      const tol = h('input', { class: 'num', value: String(Math.round(st.tol * 1000)), inputmode: 'numeric' });
      const err = h('p', { class: 'err' });
      D.open({
        title: '計算の設定（この現場）', width: 520,
        body: h('div', {}, [h('div', { class: 'form' }, [
          h('label', { text: '角度の表示' }), style,
          h('label', { text: '0 の向き' }), zero,
          h('label', { text: '許容値（mm）' }), tol,
          h('label', { text: '入力' }), h('label', { class: 'chk' }, [dot, ' 45.3015 を 45°30′15″ と読む（度.分秒）'])]),
          h('p', { class: 'small', text: '許容値：既知点間の距離（観測と座標）の差がこれを超えると赤で知らせます。' }), err]),
        buttons: [{ label: 'やめる' }, { label: '保存', kind: 'primary', onClick: async () => {
          const t = Number(tol.value);
          if (!(t > 0 && t <= 1000)) { err.textContent = '許容値は 1〜1000 mm で入れてください'; return false; }
          state.site.settings = Object.assign({}, st, { angleStyle: style.value, dmsDot: dot.checked, zero: zero.value, tol: t / 1000 });
          await ST.putSite(state.site); renderCalc(); toast('設定を保存しました');
        } }],
        onClose: resolve
      });
    });
  }

  // ---- 履歴タブ ----
  let hist = [];
  async function renderHist() {
    const ul = $('histList'); ul.innerHTML = '';
    hist = state.site ? await ST.listCalcs(state.site.id) : [];
    $('histCount').textContent = state.site ? '全 ' + hist.length + ' 件' : '';
    $('histCsv').disabled = !hist.length;
    if (!hist.length) { ul.append(h('li', { class: 'none', text: state.site ? 'まだ履歴がありません。測設タブで「履歴に保存」を押すと残ります' : '先に現場を作ってください' })); return; }
    for (const c of hist) {
      const li = h('li', { 'data-id': c.id });
      li.innerHTML = '<span class="nm">' + esc(new Date(c.time).toLocaleString('ja-JP')) + '</span><span class="kd ' + (c.check && c.check.ok ? 'ok' : 'ng') + '">' + (c.check ? (c.check.ok ? '点検 OK' : '点検 NG') : '') + '</span>'
        + '<span class="xy">' + esc((c.k1 && c.k1.name) + ' → ' + (c.k2 && c.k2.name)) + '　測点 ' + c.targets.length + ' 点' + (c.targets.length ? '（' + esc(c.targets.slice(0, 3).map(t => t.name).join('、')) + (c.targets.length > 3 ? '…' : '') + '）' : '') + '</span>'
        + (c.memo ? '<span class="memo">' + esc(c.memo) + '</span>' : '');
      ul.append(li);
    }
  }
  function histDetail(c) {
    const fmt = v => Number.isFinite(v) ? A.format(v, { style: settings().angleStyle }) : '';
    const rows = c.targets.map((t, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(t.name) + '</td><td class="n">' + fmt(t.h) + '</td><td class="n">' + fd(t.s) + '</td><td class="n">' + fd(t.x) + '</td><td class="n">' + fd(t.y) + '</td><td>' + (t.done ? '済' : '') + '</td></tr>').join('');
    const body = h('div', { class: 'hist-detail', html:
      '<p><b>' + esc(new Date(c.time).toLocaleString('ja-JP')) + '</b>' + (c.memo ? '　' + esc(c.memo) : '') + '</p>'
      + '<table class="tbl"><tbody>'
      + '<tr><th>既知点1</th><td>' + esc(c.k1.name) + '</td><td class="n">' + fd(c.k1.x) + '</td><td class="n">' + fd(c.k1.y) + '</td></tr>'
      + '<tr><th>既知点2</th><td>' + esc(c.k2.name) + '</td><td class="n">' + fd(c.k2.x) + '</td><td class="n">' + fd(c.k2.y) + '</td></tr>'
      + '<tr><th>機械点1</th><td></td><td class="n">' + fd(c.station.x) + '</td><td class="n">' + fd(c.station.y) + '</td></tr>'
      + '</tbody></table>'
      + (c.check ? '<p class="' + (c.check.ok ? 'okc' : 'ngc') + '">' + (c.check.ok ? '✓' : '✗') + ' 既知点間の差 ' + (c.check.diff * 1000).toFixed(1) + ' mm（観測 ' + c.check.dObs.toFixed(3) + ' ／ 座標 ' + c.check.dCoord.toFixed(3) + '）</p>' : '')
      + (c.warnings || []).map(w => '<p class="warn">⚠ ' + esc(w) + '</p>').join('')
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>測点</th><th>水平角</th><th>水平距離</th><th>X</th><th>Y</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="7">測点なし</td></tr>') + '</tbody></table></div>' });
    D.open({
      title: '計算の履歴', width: 680, body,
      buttons: [
        { label: '閉じる' },
        { label: '削除', kind: 'danger', onClick: async () => {
          if (!(await D.confirm('履歴を消す', 'この計算の履歴を消します。元に戻せません。', '消す', 'danger'))) return false;
          await ST.deleteCalcs(state.site.id, [c.id]); await renderHist(); toast('履歴を消しました');
        } },
        { label: '測設に戻す', kind: 'primary', onClick: async () => {
          const has = calc.k1 || calc.k2 || calc.targets.length;
          if (has && !(await D.confirm('測設に戻す', 'いまの測設タブの入力を、この履歴の入力で置き換えます。', '置き換える'))) return false;
          calc = Object.assign(blank(), JSON.parse(JSON.stringify(c.input)), { memo: c.memo || '' });
          renderCalc(); saveDraft(); GB.showTab('calc');
        } }
      ]
    });
  }

  // ---- つなぐ ----
  bindCalc();
  $('histList').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (!li) return; const c = hist.find(x => x.id === li.dataset.id); if (c) histDetail(c); });
  $('histCsv').addEventListener('click', () => {
    guard(async () => {
      if (await GB.download(GB.safeName(state.site.name) + '-測設履歴-' + GB.today() + '.csv', '\ufeff' + SK.historyCsv(hist, v => A.format(v, { style: settings().angleStyle })), 'text/csv')) toast(hist.length + ' 件を CSV で書き出しました');
    });
  });
  let lastSite = null;
  GB.hooks.points.push(async () => {
    const id = state.site && state.site.id;
    if (id !== lastSite) { lastSite = id; await loadDraft(); if (state.tab === 'hist') await renderHist(); }
  });
  GB.hooks.tab.push(name => { if (name === 'hist') guard(renderHist); if (name === 'calc') update(); });
  window.FxGenbaCalc = { pickPoints, get calc() { return calc; }, get res() { return res; } };
})();
