// フォーム（ダイアログ）とメニューの共通部品 — 開発の共通ルールに合わせる
//   1. タイトル帯をつかんで動かせる（マウス・指）。画面の外へ出切らない
//   2. ボタンはタイトル帯の右。スクロールするのは中身だけ
//   3. 外を押しても閉じない（閉じるのはボタンだけ）
//   4. ホイール・指のスクロールが後ろの画面へ伝わらない
//   5. メニュー（ドロップダウン）は、ほかを押したとき・ウィンドウの外へ移ったときに閉じる
(function (root) {
  'use strict';
  const KEEP = 48;        // 画面の中に必ず残すタイトル帯の幅（px）
  let openCount = 0;

  function h(tag, attrs, kids) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids || [])) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
    return el;
  }

  // スクロールできる要素の中でだけスクロールさせる（端で後ろへ伝えない）
  function trapWheel(container) {
    container.addEventListener('wheel', e => {
      let el = e.target;
      while (el && el !== container.parentNode) {
        if (el.nodeType === 1) {
          const st = getComputedStyle(el);
          const canY = /(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight;
          if (canY) {
            const up = e.deltaY < 0;
            const atTop = el.scrollTop <= 0, atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
            if ((up && !atTop) || (!up && !atEnd)) return;       // この要素の中でスクロールできる
            e.preventDefault(); return;                         // 端：後ろへ伝えない
          }
        }
        if (el === container) break;
        el = el.parentNode;
      }
      e.preventDefault();
    }, { passive: false });
  }

  // ダイアログを開く
  //   opt.title：タイトル
  //   opt.body：中身の要素
  //   opt.buttons：[{ label, kind: 'primary'|'danger'|'', onClick(close) }]。onClick が false を返すと閉じない
  //   opt.width：最大幅（px）
  //   戻り値：{ el, body, close, setTitle }
  function open(opt) {
    const back = h('div', { class: 'dlg-back' });
    const titleEl = h('div', { class: 'dlg-title', text: opt.title || '' });
    const btns = h('div', { class: 'dlg-btns' });
    const head = h('div', { class: 'dlg-head' }, [titleEl, btns]);
    const body = h('div', { class: 'dlg-body' }, opt.body);
    const box = h('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': opt.title || '' }, [head, body]);
    if (opt.full) box.classList.add('dlg-full');          // 画面いっぱい（動かさない）
    else if (opt.width) box.style.maxWidth = opt.width + 'px';
    back.append(box);
    let closed = false;
    function close() {
      if (closed) return; closed = true;
      back.remove(); openCount--;
      if (!openCount) document.documentElement.classList.remove('dlg-open');
      window.removeEventListener('resize', clamp);
      if (opt.onClose) opt.onClose();
    }
    for (const b of opt.buttons || []) {
      const el = h('button', { type: 'button', class: 'dlg-btn ' + (b.kind || ''), text: b.label });
      el.addEventListener('click', async () => {
        if (el.disabled) return;
        const r = b.onClick ? await b.onClick(close, el) : undefined;
        if (r !== false) close();
      });
      btns.append(el);
      if (b.ref) b.ref(el);
    }
    // 外を押しても閉じない。後ろの画面のスクロールも止める
    back.addEventListener('touchmove', e => { if (!body.contains(e.target)) e.preventDefault(); }, { passive: false });
    trapWheel(back);

    // タイトル帯をつかんで動かす
    let drag = null, pos = null;
    function place(x, y) {
      const w = box.offsetWidth, vw = window.innerWidth, vh = window.innerHeight, hh = head.offsetHeight;
      x = Math.min(Math.max(x, KEEP - w), vw - KEEP);
      y = Math.min(Math.max(y, 0), vh - hh);
      pos = { x, y };
      box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.transform = 'none'; box.style.margin = '0';
    }
    function clamp() { if (pos) place(pos.x, pos.y); }
    head.addEventListener('pointerdown', e => {
      if (opt.full || e.target.closest('button,input,select,textarea,a')) return;
      const r = box.getBoundingClientRect();
      drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      head.setPointerCapture(e.pointerId); head.classList.add('dragging');
      e.preventDefault();
    });
    head.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) place(e.clientX - drag.dx, e.clientY - drag.dy); });
    const end = e => { if (drag && e.pointerId === drag.id) { drag = null; head.classList.remove('dragging'); } };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
    window.addEventListener('resize', clamp);

    document.body.append(back);
    openCount++; document.documentElement.classList.add('dlg-open');
    const first = body.querySelector('[autofocus]');
    if (first) setTimeout(() => first.focus(), 30);
    return { el: box, body, close, setTitle: t => { titleEl.textContent = t; } };
  }

  // 確かめるだけの小さなダイアログ。OK なら true
  function confirm(title, message, okLabel, kind) {
    return new Promise(resolve => {
      let r = false;
      open({
        title, width: 420,
        body: h('p', { class: 'dlg-msg', text: message }),
        buttons: [{ label: 'やめる', onClick: () => { r = false; } }, { label: okLabel || 'OK', kind: kind || 'primary', onClick: () => { r = true; } }],
        onClose: () => resolve(r)
      });
    });
  }

  // メニュー（ドロップダウン）：anchor の下に items を出す
  //   items：[{ label, onClick, kind, disabled }] または '-'（区切り）
  function menu(anchor, items) {
    const list = h('div', { class: 'menu', role: 'menu' });
    for (const it of items) {
      if (it === '-') { list.append(h('div', { class: 'menu-sep' })); continue; }
      if (it.note) { list.append(h('div', { class: 'menu-note', text: it.note })); continue; }
      list.append(h('button', { type: 'button', role: 'menuitem', class: 'menu-item ' + (it.kind || ''), disabled: it.disabled, text: it.label, onclick: () => { close(); it.onClick && it.onClick(); } }));
    }
    document.body.append(list);
    const r = anchor.getBoundingClientRect();
    const w = list.offsetWidth;
    list.style.top = Math.min(r.bottom + 4, window.innerHeight - list.offsetHeight - 4) + 'px';
    list.style.left = Math.max(4, Math.min(r.right - w, window.innerWidth - w - 4)) + 'px';
    trapWheel(list);
    const outside = e => { if (!list.contains(e.target) && !anchor.contains(e.target)) close(); };
    function close() {
      list.remove();
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('blur', close); window.removeEventListener('resize', close);
      anchor.setAttribute('aria-expanded', 'false');
    }
    setTimeout(() => { document.addEventListener('pointerdown', outside, true); }, 0);
    window.addEventListener('blur', close); window.addEventListener('resize', close);
    anchor.setAttribute('aria-expanded', 'true');
    return { close };
  }

  root.FxDialog = { h, open, confirm, menu, trapWheel };
})(typeof globalThis !== 'undefined' ? globalThis : window);
