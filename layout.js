// 電卓の画面の配置：ディスプレイ・上のボタン・テンキー・タブの画面を、好きな位置と大きさに置く
//   ・縦／横は OS の画面の向きの固定に関係なく選べる（端末の向きと違うときは、画面ごと 90° 回して表示）
//   ・縦と横で、別々に配置を覚える。名前を付けて何種類も保存できる
//   ・文字の大きさは 5 段階
//   状態はアプリの保存データ（S.layout）に入る。app.js から FxLayout.init で呼ぶ
(function (root) {
  'use strict';
  const FS = [0.8, 0.9, 1, 1.15, 1.3];
  const CURSOR_SCALE = [0.85, 1, 1.25];
  const APPEARANCE = ['font', 'lcd', 'lcdFont', 'cursorSide', 'cursorSize'];
  const BLOCKS = ['lcd', 'upper', 'nkeys', 'tabs'];
  const KEY_MIN = { upper: { w: 300, h: 204 }, nkeys: { w: 252, h: 144 } };
  const SNAP_PX = 10;
  const NAMES = { lcd: 'ディスプレイ', upper: '上のボタン', nkeys: 'テンキー', tabs: 'タブの画面' };
  const DEF = {
    // 縦：標準の並び（今までの見た目）。自由配置に切り替えたときの初めの置き方も持つ
    portrait: { mode: 'standard', blocks: { lcd: { x: 0, y: 0, w: 100, h: 28 }, upper: { x: 0, y: 28, w: 100, h: 33 }, nkeys: { x: 0, y: 61, w: 100, h: 39 }, tabs: { x: 0, y: 0, w: 100, h: 28, show: false } } },
    // 横：左にディスプレイとタブ、右にボタン
    landscape: { mode: 'free', blocks: { lcd: { x: 0, y: 0, w: 44, h: 50 }, tabs: { x: 0, y: 50, w: 44, h: 50, show: true }, upper: { x: 44, y: 0, w: 56, h: 47 }, nkeys: { x: 44, y: 47, w: 56, h: 53 } } }
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  let opt = null, st = null, info = { orient: 'portrait', free: false, rotated: false, W: 0, H: 0 };
  let editing = null;
  let menuOpen = false;
  // 電卓のメニューを開いた・閉じた（app.js が呼ぶ）
  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    if (info.free) apply();
    else if (!open) opt.onApply(info);
  }

  function defaults() { return { orient: 'auto', font: 3, lcd: 'wide', lcdFont: 3, cursorSize: 2, cursorSide: 'right', portrait: clone(DEF.portrait), landscape: clone(DEF.landscape), presets: [] }; }
  function fix(s) {
    const d = defaults();
    s = Object.assign(d, s || {});
    for (const o of ['portrait', 'landscape']) {
      s[o] = Object.assign(clone(DEF[o]), s[o] || {});
      s[o].blocks = Object.assign(clone(DEF[o].blocks), s[o].blocks || {});
    }
    if (!(s.font >= 1 && s.font <= 5)) s.font = 3;
    // ディスプレイ：wide＝見やすい表示（行・桁を増やす）、real＝実機と同じ 16 桁×4 行
    if (!['wide', 'real'].includes(s.lcd)) s.lcd = 'wide';
    if (!(s.lcdFont >= 1 && s.lcdFont <= 5)) s.lcdFont = 3;
    if (![1, 2, 3].includes(s.cursorSize)) s.cursorSize = 2;
    if (!['left', 'right'].includes(s.cursorSide)) s.cursorSide = 'right';
    if (!['auto', 'portrait', 'landscape'].includes(s.orient)) s.orient = 'auto';
    if (!Array.isArray(s.presets)) s.presets = [];
    return s;
  }
  function save() { opt.save(st); }
  const presetNameKey = name => name.normalize('NFKC').trim().toLowerCase();
  const validPreset = p => p && typeof p.name === 'string' && ['portrait', 'landscape'].includes(p.orient) && p.layout;
  function disambiguatePresetNames() {
    const presets = st.presets.filter(validPreset);
    const reserved = new Set(presets.map(p => presetNameKey(p.name)));
    const seen = new Set();
    let renamed = false;
    for (const p of presets) {
      const key = presetNameKey(p.name);
      if (seen.has(key)) {
        const side = p.orient === 'landscape' ? '横' : '縦';
        const base = p.name.trim();
        let n = 1, name = base + '（' + side + '）';
        while (reserved.has(presetNameKey(name))) name = base + '（' + side + ' ' + ++n + '）';
        p.name = name;
        reserved.add(presetNameKey(name));
        renamed = true;
      }
      seen.add(key);
    }
    return renamed;
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const halfPercent = value => Math.round(value * 2) / 2;
  function minSize(block) {
    const keys = KEY_MIN[block];
    return keys ? { w: Math.min(100, keys.w / info.W * 100), h: Math.min(100, keys.h / info.H * 100) } : { w: 12, h: 8 };
  }
  function displayedBlock(block, saved) {
    if (!KEY_MIN[block]) return saved;
    const min = minSize(block);
    const w = clamp(saved.w, min.w, 100), h = clamp(saved.h, min.h, 100);
    return { ...saved, w, h, x: clamp(saved.x, 0, 100 - w), y: clamp(saved.y, 0, 100 - h) };
  }
  function snapSize(rect, neighbors, min, axis) {
    const horizontal = axis === 'w';
    const origin = horizontal ? 'x' : 'y', across = horizontal ? 'y' : 'x', span = horizontal ? 'h' : 'w';
    const scale = horizontal ? info.W : info.H;
    const edge = rect[origin] + rect[axis];
    let distance = SNAP_PX, size = rect[axis];
    for (const other of neighbors) {
      if (rect[across] >= other[across] + other[span] || other[across] >= rect[across] + rect[span]) continue;
      const gap = Math.abs(edge - other[origin]) * scale / 100;
      const candidate = other[origin] - rect[origin];
      if (gap > distance || candidate < min[axis]) continue;
      distance = gap;
      size = candidate;
    }
    return size;
  }

  // ---- 画面に当てはめる ----
  function apply() {
    const calc = opt.calc, vw = window.innerWidth, vh = window.innerHeight;
    const natural = vw > vh ? 'landscape' : 'portrait';
    const o = st.orient === 'auto' ? natural : st.orient;
    const rotated = o !== natural;
    const W = rotated ? vh : vw, H = rotated ? vw : vh;
    const L = st[o], free = L.mode === 'free' || !!editing;
    info = { orient: o, free, rotated, W, H };
    document.documentElement.style.setProperty('--fs', String(FS[st.font - 1]));
    document.documentElement.classList.toggle('lo-free', free);
    calc.classList.toggle('free', free);
    calc.classList.toggle('rotated', rotated);
    calc.classList.toggle('lo-landscape', o === 'landscape');
    calc.classList.toggle('cursor-left', st.cursorSide === 'left');
    calc.style.setProperty('--pad-scale', CURSOR_SCALE[st.cursorSize - 1]);
    if (free || rotated) {
      const width = free ? W : Math.min(W, 480);
      calc.style.width = width + 'px'; calc.style.height = H + 'px';
      calc.style.transform = rotated ? 'translate(' + vw + 'px,' + ((W - width) / 2) + 'px) rotate(90deg)' : '';
    } else { calc.style.width = calc.style.height = calc.style.transform = ''; }
    // メニューを開いている間（自由配置）は、ディスプレイを「上のボタン」の場所まで広げる（テンキーは残す）
    const menuBig = free && menuOpen && !editing;
    const u = displayedBlock('upper', L.blocks.upper), l0 = L.blocks.lcd;
    const big = menuBig ? { x: Math.min(l0.x, u.x), y: Math.min(l0.y, u.y), w: Math.max(l0.x + l0.w, u.x + u.w) - Math.min(l0.x, u.x), h: Math.max(l0.y + l0.h, u.y + u.h) - Math.min(l0.y, u.y) } : null;
    for (const b of BLOCKS) {
      const el = calc.querySelector('[data-blk="' + b + '"]');
      let p = displayedBlock(b, L.blocks[b]);
      if (!el) continue;
      if (free) {
        el.hidden = (b === 'tabs' && !p.show) || (menuBig && b === 'upper');
        if (menuBig && b === 'lcd') p = big;
        el.style.zIndex = menuBig && b === 'lcd' ? 6 : '';
        el.style.left = p.x + '%'; el.style.top = p.y + '%'; el.style.width = p.w + '%'; el.style.height = p.h + '%';
      } else {
        el.hidden = b === 'tabs';
        el.style.left = el.style.top = el.style.width = el.style.height = '';
      }
    }
    if (opt.onApply) opt.onApply(info);
  }

  // ---- 配置を変える（ブロックを動かす・大きさを変える） ----
  function toLocal(dx, dy) { return info.rotated ? { dx: dy, dy: -dx } : { dx, dy }; }
  function bindLcdResize() {
    const handle = opt.calc.querySelector('#lcdResize');
    if (!handle) return;
    let drag = null;
    const resize = (layout, value) => {
      const max = Number(handle.getAttribute('aria-valuemax'));
      const next = Math.round(Math.min(max, Math.max(0, value)));
      if (next === (layout.lcdExtra || 0)) return;
      layout.lcdExtra = next;
      opt.onApply(info);
    };
    handle.addEventListener('pointerdown', e => {
      if (drag || e.button !== 0 || info.free || menuOpen) return;
      e.preventDefault();
      handle.focus({ preventScroll: true });
      try { handle.setPointerCapture(e.pointerId); } catch { /* つまみの上ではそのまま動かせる */ }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, layout: st[info.orient],
        rotated: info.rotated, start: Number(handle.getAttribute('aria-valuenow')) };
    });
    handle.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id || info.free || menuOpen ||
          drag.layout !== st[info.orient] || drag.rotated !== info.rotated) return;
      resize(drag.layout, drag.start + toLocal(e.clientX - drag.x, e.clientY - drag.y).dy);
    });
    const finish = e => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      save();
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    handle.addEventListener('lostpointercapture', finish);
    handle.addEventListener('keydown', e => {
      const current = Number(handle.getAttribute('aria-valuenow'));
      const rotated = info.rotated;
      const targets = { [rotated ? 'ArrowLeft' : 'ArrowDown']: current + 24,
        [rotated ? 'ArrowRight' : 'ArrowUp']: current - 24,
        Home: 0, End: Number(handle.getAttribute('aria-valuemax')) };
      if (!Object.hasOwn(targets, e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      resize(st[info.orient], targets[e.key]);
      save();
    });
  }
  function startEdit() {
    if (editing) return;
    const L = st[info.orient];
    editing = { before: clone(L) };
    L.mode = 'free';
    apply();
    const calc = opt.calc;
    calc.classList.add('lo-edit');
    for (const b of BLOCKS) {
      const el = calc.querySelector('[data-blk="' + b + '"]');
      if (!el) continue;
      const ov = document.createElement('div'); ov.className = 'lo-ov'; ov.innerHTML = '<b>' + NAMES[b] + '</b>';
      const rs = document.createElement('div'); rs.className = 'lo-rs'; rs.title = '大きさを変える';
      ov.append(rs); el.append(ov);
      dragOn(ov, b, 'move'); dragOn(rs, b, 'size');
    }
    const bar = document.createElement('div'); bar.className = 'lo-bar'; bar.id = 'loBar';
    const tabsShown = () => st[info.orient].blocks.tabs.show;
    bar.innerHTML = '<span>' + (info.orient === 'landscape' ? '横' : '縦') + 'の配置：ブロックをつかんで動かす・右下で大きさ</span>'
      + '<button type="button" data-lo="tabs">' + (tabsShown() ? 'タブの画面を隠す' : 'タブの画面を出す') + '</button>'
      + '<button type="button" data-lo="reset">初めの配置</button>'
      + '<button type="button" data-lo="cancel">やめる</button>'
      + '<button type="button" data-lo="done" class="primary">完了</button>';
    // 帯も電卓の画面の中に置き、回したときに一緒に回るようにする
    opt.calc.append(bar);
    bar.addEventListener('click', e => {
      const a = e.target.closest('[data-lo]'); if (!a) return;
      const k = a.dataset.lo, L2 = st[info.orient];
      if (k === 'tabs') { L2.blocks.tabs.show = !L2.blocks.tabs.show; a.textContent = L2.blocks.tabs.show ? 'タブの画面を隠す' : 'タブの画面を出す'; apply(); }
      else if (k === 'reset') { L2.blocks = clone(DEF[info.orient].blocks); if (info.orient === 'portrait') L2.blocks.tabs.show = false; apply(); }
      else if (k === 'cancel') { st[info.orient] = editing.before; endEdit(false); }
      else if (k === 'done') endEdit(true);
    });
  }
  function endEdit(keep) {
    const calc = opt.calc;
    calc.classList.remove('lo-edit');
    calc.querySelectorAll('.lo-ov').forEach(x => x.remove());
    const bar = document.getElementById('loBar'); if (bar) bar.remove();
    editing = null;
    save(); apply();
    if (opt.toast) opt.toast(keep ? '配置を覚えました（' + (info.orient === 'landscape' ? '横' : '縦') + '）' : '配置の変更をやめました');
  }
  function dragOn(el, b, kind) {
    let d = null;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || (kind === 'move' && e.target.classList.contains('lo-rs'))) return;
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch { /* 捕まえられなくても動かせる */ }
      const blocks = st[info.orient].blocks;
      d = { id: e.pointerId, x: e.clientX, y: e.clientY, orient: info.orient, W: info.W, H: info.H,
        p: { ...displayedBlock(b, blocks[b]) } };
      const blk = opt.calc.querySelector('[data-blk="' + b + '"]'); opt.calc.querySelectorAll('.blk').forEach(x => { x.style.zIndex = ''; }); blk.style.zIndex = 5;
    });
    el.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id || d.orient !== info.orient || d.W !== info.W || d.H !== info.H) return;
      const m = toLocal(e.clientX - d.x, e.clientY - d.y);
      const px = m.dx / info.W * 100, py = m.dy / info.H * 100, blocks = st[info.orient].blocks;
      const rect = { ...d.p };
      if (kind === 'move') {
        rect.x = clamp(halfPercent(rect.x + px), 0, 100 - rect.w);
        rect.y = clamp(halfPercent(rect.y + py), 0, 100 - rect.h);
      } else {
        const min = minSize(b);
        rect.w = clamp(halfPercent(rect.w + px), min.w, 100 - rect.x);
        rect.h = clamp(halfPercent(rect.h + py), min.h, 100 - rect.y);
        const neighbors = BLOCKS.filter(id => id !== b && (id !== 'tabs' || blocks.tabs.show))
          .map(id => displayedBlock(id, blocks[id]));
        const w = snapSize(rect, neighbors, min, 'w');
        rect.h = snapSize(rect, neighbors, min, 'h');
        rect.w = w;
      }
      Object.assign(blocks[b], rect);
      apply();
    });
    const up = e => { if (d && e.pointerId === d.id) d = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  // ---- 設定の画面（SETUP → 配置） ----
  function openSettings() {
    const D = root.FxDialog, h = D.h;
    let dlg = null;
    const refresh = [];
    const update = () => { save(); apply(); refresh.forEach(fn => fn()); };
    function seg(items, current, on) {
      const buttons = items.map(([v, t]) =>
        h('button', { type: 'button', text: t, onclick: () => { on(v); update(); } }));
      for (const [i, [value]] of items.entries()) {
        const refreshButton = () => {
          const active = value === current();
          buttons[i].classList.toggle('on', active);
          buttons[i].setAttribute('aria-pressed', String(active));
        };
        refresh.push(refreshButton);
        refreshButton();
      }
      return h('div', { class: 'lo-seg' }, buttons);
    }
    const presetBox = h('div', { class: 'lo-presets' });
    const nameIn = h('input', { placeholder: '例：iPad 横・現場用', maxlength: 30 });
    function drawPresets() {
      presetBox.innerHTML = '';
      if (!st.presets.length) { presetBox.append(h('p', { class: 'lo-note', text: 'まだ保存した配置はありません。' })); return; }
      st.presets.forEach((p, i) => {
        if (!validPreset(p)) return;
        presetBox.append(h('div', { class: 'lo-preset' }, [
          h('div', { class: 'nm', html: '' }, [p.name, h('small', { text: (p.orient === 'landscape' ? '横' : '縦') + '・文字 ' + p.font + '・' + new Date(p.time).toLocaleDateString('ja-JP') })]),
          h('button', { type: 'button', text: '呼び出す', onclick: () => {
            st[p.orient] = clone(p.layout);
            if (info.orient !== p.orient) st.orient = p.orient;
            for (const key of APPEARANCE) if (p[key] != null) st[key] = p[key];
            st = fix(st);
            update();
            opt.toast?.('「' + p.name + '」を呼び出しました');
          } }),
          h('button', { type: 'button', text: '削除', onclick: async () => { if (await D.confirm('配置を消す', '「' + p.name + '」を消します。', '消す', 'danger')) { st.presets.splice(i, 1); save(); drawPresets(); } } })
        ]));
      });
    }
    drawPresets();
    const o = () => info.orient === 'landscape' ? '横' : '縦';
    const modeNote = h('p', { class: 'lo-note' });
    const reset = h('button', { type: 'button', onclick: () => { st[info.orient] = clone(DEF[info.orient]); update(); } });
    const refreshMode = () => {
      modeNote.textContent = 'いまの向き：' + o() + '（' + (st[info.orient].mode === 'free' ? '自由配置' : '標準の並び') + '）';
      reset.textContent = '初めの配置に戻す（' + o() + '）';
    };
    refresh.push(refreshMode);
    refreshMode();
    dlg = D.open({
      title: '配置と大きさ', width: 520,
      body: h('div', { class: 'lo-form' }, [
        h('div', {}, [h('h4', { text: '画面の向き（OS の向きの固定に関係なく選べる）' }),
          seg([['auto', '自動'], ['portrait', '縦'], ['landscape', '横']], () => st.orient, v => { st.orient = v; }),
          h('p', { class: 'lo-note', text: '「縦」「横」に決めると、端末の向きと違うときは画面ごと回して表示します。縦と横で、それぞれの配置を覚えます。' })]),
        h('div', {}, [h('h4', { text: '文字の大きさ（ボタン・タブ・一覧）' }),
          seg([[1, '1 小'], [2, '2'], [3, '3 標準'], [4, '4'], [5, '5 大']], () => st.font, v => { st.font = v; }),
          h('p', { class: 'lo-note', text: 'ボタン・タブの画面・一覧の文字に効きます。' })]),
        h('div', {}, [h('h4', { text: 'ディスプレイの表示' }),
          seg([['wide', '見やすい表示（行と桁を増やす）'], ['real', '実機と同じ（16 桁×4 行）']], () => st.lcd, v => { st.lcd = v; }),
          h('p', { class: 'lo-note', text: '見やすい表示では、ディスプレイの高さと幅に合わせて行と桁が増えます。プログラムの入力・答え・日本語の変数名も残します。実機の表示を確かめるときは「実機と同じ」を選ぶと 16 桁×4 行になります。' }),
          h('h4', { text: 'ディスプレイの文字（見やすい表示のとき）' }),
          seg([[1, '1 小'], [2, '2'], [3, '3 標準'], [4, '4'], [5, '5 大']], () => st.lcdFont, v => { st.lcdFont = v; }),
          h('p', { class: 'lo-note', text: '小さくするほど、行と桁が増えます（16 桁より少なくはなりません）。' })]),
        h('div', {}, [h('h4', { text: '並び方' }), modeNote,
          seg([['standard', '標準の並び'], ['free', '自由配置']], () => st[info.orient].mode, v => { st[info.orient].mode = v; }),
          h('p', { class: 'lo-note', text: '標準の並びでは、ディスプレイ下端のつまみを上下に動かすと、キーの縦の大きさも合わせて変わります。' }),
          h('p', { class: 'lo-note', text: '自由配置のサイズ変更では、近くの窓の縁に吸い付きます。キーの窓は文字が重ならない大きさまで縮められます。' }),
          h('div', { class: 'lo-seg', style: 'margin-top:8px' }, [h('button', { type: 'button', class: 'on', text: '▦ 配置を変える（動かす・大きさ）', onclick: () => { dlg.close(); startEdit(); } })])]),
        h('div', {}, [h('h4', { text: 'カーソルキーの位置' }),
          seg([['left', '左'], ['right', '右']], () => st.cursorSide, v => { st.cursorSide = v; }),
          h('h4', { text: 'カーソルキーの大きさ' }),
          seg([[1, '小'], [2, '標準'], [3, '大']], () => st.cursorSize, v => { st.cursorSize = v; })]),
        h('div', {}, [h('h4', { text: '名前を付けて保存' }),
          h('div', { class: 'lo-new' }, [nameIn, h('button', { type: 'button', text: '保存', onclick: async () => {
            const n = nameIn.value.trim(); if (!n) { nameIn.focus(); return; }
            const key = presetNameKey(n);
            const i = st.presets.findIndex(p => validPreset(p) && presetNameKey(p.name) === key);
            const item = { name: n, orient: info.orient, layout: clone(st[info.orient]), time: Date.now() };
            for (const field of APPEARANCE) item[field] = st[field];
            if (i >= 0 && !(await D.confirm('配置を上書き', '「' + st.presets[i].name + '」を現在の設定で上書きしますか？', '上書き'))) return;
            if (i >= 0) st.presets[i] = item; else st.presets.push(item);
            save(); drawPresets(); nameIn.value = ''; opt.toast && opt.toast('「' + n + '」を保存しました');
          } })]),
          presetBox]),
        h('div', { class: 'lo-seg' }, [reset])
      ]),
      buttons: [{ label: '閉じる', kind: 'primary' }]
    });
  }

  function init(o) {
    opt = o; st = fix(o.load());
    if (disambiguatePresetNames()) save();
    bindLcdResize();
    apply();
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(apply, 80); });
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => setTimeout(apply, 120));
  }
  root.FxLayout = { init, apply, openSettings, startEdit, setMenu, get info() { return info; }, get state() { return st; }, FS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
