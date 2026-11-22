// 電卓でプログラムが値を聞いているときに、現場の座標一覧（IndexedDB fx5800p-genba）から点を選んで入れる
//   FxPickXY.open({ hint, onPick(values) })
//     values：入れる値の文字の並び（X→Y なら [x, y]）。続けて聞かれる入力に順に入れる
//   FxPickXY.text(v)：入れる値の文字（小数 4 桁まで、余分な 0 は消す）
//   座標一覧は読むだけ。現場の選択は genba と同じ meta の lastSite を使い、選び直したら覚える
(function (root) {
  'use strict';
  const D = () => root.FxDialog, ST = () => root.FxStore;
  const MODE_KEY = 'fx5800p-emu-v1-pickxy';   // 入れ方（xy・x・y・z・xyz）を覚える

  function text(v) {
    if (v == null || !isFinite(v)) return '';
    let s = (Math.round(v * 10000) / 10000).toFixed(4).replace(/\.?0+$/, '');
    if (s === '-0') s = '0';
    return s;
  }
  const f3 = v => v == null || !isFinite(v) ? '―' : (+v).toFixed(3);
  const readMode = () => { try { return localStorage.getItem(MODE_KEY) || 'xy'; } catch (e) { return 'xy'; } };
  const saveMode = m => { try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* 覚えられなくても動く */ } };
  // 入れる値の並び
  function values(p, mode) {
    const z = p.z == null ? null : p.z;
    switch (mode) {
      case 'x': return [text(p.x)];
      case 'y': return [text(p.y)];
      case 'z': return z == null ? null : [text(z)];
      case 'xyz': return z == null ? null : [text(p.x), text(p.y), text(z)];
      default: return [text(p.x), text(p.y)];
    }
  }
  // 聞かれている変数の日本語の名前から、入れ方の初めを決める（「…の Y」なら Y だけ、など）
  function guessMode(hint, saved) {
    const s = String(hint || '');
    if (/の\s*Y\b|の\s*Ｙ|Y（東）|\bY$/.test(s)) return 'y';
    if (/標高|高さ|\bZ\b/.test(s)) return 'z';
    return saved === 'x' || saved === 'xyz' ? saved : 'xy';
  }

  async function open(opt) {
    opt = opt || {};
    const Dl = D(), S = ST();
    if (!Dl || !S) { if (opt.toast) opt.toast('座標一覧の部品を読めませんでした'); return; }
    const h = Dl.h;
    let sites = [];
    try { sites = await S.listSites(); } catch (e) { if (opt.toast) opt.toast(e.message); return; }
    if (!sites.length) { if (opt.toast) opt.toast('座標一覧がまだありません。MODE → GENBA（現場の座標）で現場を作り、点を入れてください', 6000); return; }
    let siteId = null;
    try { siteId = await S.getMeta('lastSite', null); } catch (e) { /* 初めの現場を使う */ }
    if (!sites.some(s => s.id === siteId)) siteId = sites[0].id;
    let points = [], q = '', mode = guessMode(opt.hint, readMode());

    const sel = h('select', { 'aria-label': '現場' }, sites.map(s => h('option', { value: s.id, text: s.name })));
    sel.value = siteId;
    const search = h('input', { type: 'search', placeholder: '点名で探す（数字だけでも可）', autocomplete: 'off', enterkeyhint: 'search' });
    const modes = [['xy', 'X→Y'], ['x', 'X だけ'], ['y', 'Y だけ'], ['z', '標高'], ['xyz', 'X→Y→標高']];
    const seg = h('div', { class: 'px-seg', role: 'group', 'aria-label': '入れる値' }, modes.map(([v, t]) => h('button', { type: 'button', 'data-m': v, class: v === mode ? 'on' : '', text: t })));
    const note = h('p', { class: 'px-note' });
    const ul = h('ul', { class: 'px-list' });
    const drawNote = () => {
      note.textContent = {
        xy: '選んだ点の X を今の入力に入れて EXE、続けて聞かれる入力に Y を入れて EXE します。',
        x: '選んだ点の X だけを入れて EXE します。', y: '選んだ点の Y だけを入れて EXE します。',
        z: '選んだ点の標高だけを入れて EXE します（標高のない点は選べません）。',
        xyz: 'X・Y・標高を、続けて聞かれる入力に順に入れます。'
      }[mode] + (opt.hint ? '　いま聞かれているもの：' + opt.hint : '');
    };
    function draw() {
      ul.innerHTML = '';
      const k = q.trim().toLowerCase();
      // 数字だけなら、点名の中の数字が同じものも出す（K12 を 12 で）
      const num = /^\d+$/.test(k) ? k : null;
      const shown = points.filter(p => !k || p.name.toLowerCase().includes(k) || (num && (p.name.match(/\d+/g) || []).includes(num)));
      if (!points.length) { ul.append(h('li', { class: 'px-empty', text: 'この現場には点がありません。' })); return; }
      if (!shown.length) { ul.append(h('li', { class: 'px-empty', text: '見つかりません。' })); return; }
      for (const p of shown.slice(0, 300)) {
        const v = values(p, mode);
        const b = h('button', { type: 'button', class: 'px-pt', disabled: !v }, [
          h('b', { text: p.name }), h('span', { class: 'px-xy', text: 'X ' + f3(p.x) + '　Y ' + f3(p.y) + (p.z == null ? '' : '　Z ' + f3(p.z)) }),
          p.kind && p.kind !== 'その他' ? h('small', { text: p.kind }) : ''
        ]);
        b.addEventListener('click', () => { if (!v) return; saveMode(mode); dlg.close(); opt.onPick(v, p); });
        ul.append(h('li', {}, [b]));
      }
      if (shown.length > 300) ul.append(h('li', { class: 'px-empty', text: 'ほかに ' + (shown.length - 300) + ' 点。点名で絞り込んでください。' }));
    }
    async function load() {
      try { points = await S.listPoints(siteId); } catch (e) { points = []; if (opt.toast) opt.toast(e.message); }
      draw();
    }
    sel.addEventListener('change', async () => { siteId = sel.value; try { await S.setMeta('lastSite', siteId); } catch (e) { /* 覚えられなくても動く */ } load(); });
    search.addEventListener('input', () => { q = search.value; draw(); });
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      mode = b.dataset.m; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); drawNote(); draw();
    });
    drawNote();
    const dlg = Dl.open({
      title: '座標一覧から入れる', width: 520,
      body: h('div', { class: 'px-form' }, [h('div', { class: 'px-row' }, [h('label', { text: '現場' }), sel]), search, seg, note, ul]),
      buttons: [{ label: 'やめる' }]
    });
    await load();
  }

  root.FxPickXY = { open, text, values, guessMode };
})(typeof window !== 'undefined' ? window : globalThis);
