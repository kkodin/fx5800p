// 電卓の画面の配置：ディスプレイ・上のボタン・テンキー・タブの画面を、好きな位置と大きさに置く
//   ・縦／横は OS の画面の向きの固定に関係なく選べる（端末の向きと違うときは、画面ごと 90° 回して表示）
//   ・縦と横で、別々に配置を覚える。名前を付けて何種類も保存できる
//   ・文字の大きさは 5 段階
//   状態はアプリの保存データ（S.layout）に入る。app.js から FxLayout.init で呼ぶ
(function (root) {
  'use strict';
  const FS = [0.8, 0.9, 1, 1.15, 1.3];
  const BLOCKS = ['lcd', 'upper', 'nkeys', 'tabs'];
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

  function defaults() { return { orient: 'auto', font: 3, portrait: clone(DEF.portrait), landscape: clone(DEF.landscape), presets: [] }; }
  function fix(s) {
    const d = defaults();
    s = Object.assign(d, s || {});
    for (const o of ['portrait', 'landscape']) {
      s[o] = Object.assign(clone(DEF[o]), s[o] || {});
      s[o].blocks = Object.assign(clone(DEF[o].blocks), s[o].blocks || {});
    }
    if (!(s.font >= 1 && s.font <= 5)) s.font = 3;
    if (!['auto', 'portrait', 'landscape'].includes(s.orient)) s.orient = 'auto';
    if (!Array.isArray(s.presets)) s.presets = [];
    return s;
  }
  function save() { opt.save(st); }

  // ---- 画面に当てはめる ----
  function apply() {
    const calc = opt.calc, vw = window.innerWidth, vh = window.innerHeight;
    const natural = vw > vh ? 'landscape' : 'portrait';
    const o = st.orient === 'auto' ? natural : st.orient;
    const rotated = o !== natural;
    const W = rotated ? vh : vw, H = rotated ? vw : vh;
    const L = st[o], free = L.mode === 'free' || rotated || !!editing;
    info = { orient: o, free, rotated, W, H };
    document.documentElement.style.setProperty('--fs', String(FS[st.font - 1]));
    document.documentElement.classList.toggle('lo-free', free);
    calc.classList.toggle('free', free);
    calc.classList.toggle('rotated', free && rotated);
    calc.classList.toggle('lo-landscape', o === 'landscape');
    if (free) {
      calc.style.width = W + 'px'; calc.style.height = H + 'px';
      calc.style.transform = rotated ? 'translateX(' + vw + 'px) rotate(90deg)' : '';
    } else { calc.style.width = calc.style.height = calc.style.transform = ''; }
    for (const b of BLOCKS) {
      const el = calc.querySelector('[data-blk="' + b + '"]'), p = L.blocks[b];
      if (!el) continue;
      if (free) {
        el.hidden = b === 'tabs' && !p.show;
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
  function startEdit() {
    if (editing) return;
    const L = st[info.orient];
    if (L.mode !== 'free') { L.mode = 'free'; }
    editing = { before: clone(L) };
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
      if (kind === 'move' && e.target.classList.contains('lo-rs')) return;
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch { /* 捕まえられなくても動かせる */ }
      d = { id: e.pointerId, x: e.clientX, y: e.clientY, p: Object.assign({}, st[info.orient].blocks[b]) };
      const blk = opt.calc.querySelector('[data-blk="' + b + '"]'); opt.calc.querySelectorAll('.blk').forEach(x => { x.style.zIndex = ''; }); blk.style.zIndex = 5;
    });
    el.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const m = toLocal(e.clientX - d.x, e.clientY - d.y);
      const px = m.dx / info.W * 100, py = m.dy / info.H * 100, p = st[info.orient].blocks[b];
      const snap = v => Math.round(v * 2) / 2;   // 0.5% ずつ
      if (kind === 'move') {
        p.x = snap(Math.min(Math.max(d.p.x + px, 0), 100 - p.w));
        p.y = snap(Math.min(Math.max(d.p.y + py, 0), 100 - p.h));
      } else {
        p.w = snap(Math.min(Math.max(d.p.w + px, 12), 100 - p.x));
        p.h = snap(Math.min(Math.max(d.p.h + py, 8), 100 - p.y));
      }
      apply();
    });
    const up = e => { if (d && e.pointerId === d.id) d = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  // ---- 設定の画面（▦ 配置） ----
  function openSettings() {
    const D = root.FxDialog, h = D.h;
    let dlg = null;
    const seg = (items, cur, on) => h('div', { class: 'lo-seg' }, items.map(([v, t]) => h('button', { type: 'button', class: v === cur ? 'on' : '', text: t, onclick: e => { on(v); e.currentTarget.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === e.currentTarget)); } })));
    const presetBox = h('div', { class: 'lo-presets' });
    const nameIn = h('input', { placeholder: '例：iPad 横・現場用', maxlength: 30 });
    function drawPresets() {
      presetBox.innerHTML = '';
      if (!st.presets.length) { presetBox.append(h('p', { class: 'lo-note', text: 'まだ保存した配置はありません。' })); return; }
      st.presets.forEach((p, i) => {
        presetBox.append(h('div', { class: 'lo-preset' }, [
          h('div', { class: 'nm', html: '' }, [p.name, h('small', { text: (p.orient === 'landscape' ? '横' : '縦') + '・文字 ' + p.font + '・' + new Date(p.time).toLocaleDateString('ja-JP') })]),
          h('button', { type: 'button', text: '呼び出す', onclick: () => { st[p.orient] = clone(p.layout); st.font = p.font; save(); apply(); opt.toast && opt.toast('「' + p.name + '」を' + (p.orient === 'landscape' ? '横' : '縦') + 'の配置にしました'); } }),
          h('button', { type: 'button', text: '削除', onclick: async () => { if (await D.confirm('配置を消す', '「' + p.name + '」を消します。', '消す', 'danger')) { st.presets.splice(i, 1); save(); drawPresets(); } } })
        ]));
      });
    }
    drawPresets();
    const o = () => info.orient === 'landscape' ? '横' : '縦';
    const modeNote = h('p', { class: 'lo-note' });
    const updNote = () => { modeNote.textContent = 'いまの向き：' + o() + '（' + (st[info.orient].mode === 'free' ? '自由配置' : '標準の並び') + '）'; };
    updNote();
    dlg = D.open({
      title: '配置と大きさ', width: 520,
      body: h('div', { class: 'lo-form' }, [
        h('div', {}, [h('h4', { text: '画面の向き（OS の向きの固定に関係なく選べる）' }),
          seg([['auto', '自動'], ['portrait', '縦'], ['landscape', '横']], st.orient, v => { st.orient = v; save(); apply(); updNote(); }),
          h('p', { class: 'lo-note', text: '「縦」「横」に決めると、端末の向きと違うときは画面ごと回して表示します。縦と横で、それぞれの配置を覚えます。' })]),
        h('div', {}, [h('h4', { text: '文字の大きさ（ボタン・タブ・一覧）' }),
          seg([[1, '1 小'], [2, '2'], [3, '3 標準'], [4, '4'], [5, '5 大']], st.font, v => { st.font = v; save(); apply(); }),
          h('p', { class: 'lo-note', text: 'ディスプレイの文字は、ディスプレイの幅に合わせて決まります（16 桁）。ディスプレイを高くすると行数が増えます。' })]),
        h('div', {}, [h('h4', { text: '並び方' }), modeNote,
          seg([['standard', '標準の並び'], ['free', '自由配置']], st[info.orient].mode, v => { st[info.orient].mode = v; save(); apply(); updNote(); }),
          h('div', { class: 'lo-seg', style: 'margin-top:8px' }, [h('button', { type: 'button', class: 'on', text: '▦ 配置を変える（動かす・大きさ）', onclick: () => { dlg.close(); startEdit(); } })])]),
        h('div', {}, [h('h4', { text: '名前を付けて保存（いまの向きの配置と文字の大きさ）' }),
          h('div', { class: 'lo-new' }, [nameIn, h('button', { type: 'button', text: '保存', onclick: () => {
            const n = nameIn.value.trim(); if (!n) { nameIn.focus(); return; }
            const i = st.presets.findIndex(p => p.name === n && p.orient === info.orient);
            const item = { name: n, orient: info.orient, font: st.font, layout: clone(st[info.orient]), time: Date.now() };
            if (i >= 0) st.presets[i] = item; else st.presets.push(item);
            save(); drawPresets(); nameIn.value = ''; opt.toast && opt.toast('「' + n + '」を保存しました');
          } })]),
          presetBox]),
        h('div', {}, [h('div', { class: 'lo-seg' }, [h('button', { type: 'button', text: '初めの配置に戻す（' + o() + '）', onclick: () => { st[info.orient] = clone(DEF[info.orient]); save(); apply(); updNote(); } })])])
      ]),
      buttons: [{ label: '閉じる', kind: 'primary' }]
    });
  }

  function init(o) {
    opt = o; st = fix(o.load());
    apply();
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(apply, 80); });
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => setTimeout(apply, 120));
  }
  root.FxLayout = { init, apply, openSettings, startEdit, get info() { return info; }, get state() { return st; }, FS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
