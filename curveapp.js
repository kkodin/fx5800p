// 曲線の測量（アプリ版プログラム）— このアプリだけで動く。電卓実機・電卓の変数・ほかのプログラムとは絡まない
//   FxCurveApp.open({ state() → S.curveApp, save(), toast(text), download(name, text), senteiAligns() → [{ name, align }], onClose })
//   S.curveApp：{ aligns: [{ name, align, savedAt }], cur: 使っている線形の名前, bx, by, ox, oy, records: [...] }
//   線形の形は senkei.js と同じ：{ bp: { x, y }, az: 方向角(度), L0: BP〜IP1, curves: [{ R, ia: 交角(度), dir: 'R'|'L', L: 前の IP から }], Lf: 最後の IP〜EP }
(function (root) {
  'use strict';
  const f3 = v => (Math.round(v * 1000) / 1000).toFixed(3);
  const num = text => {
    const s = String(text == null ? '' : text).normalize('NFKC').replace(/[ー－―−]/g, '-').replace(/,/g, '').trim();
    return s === '' ? null : (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN);
  };
  const V = () => root.FxCurveView, D = () => root.FxDialog;
  const stamp = d => { const z = v => String(v).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); };

  function alignSummary(a) {
    if (!a) return ['線形がまだありません'];
    const out = ['BP（' + f3(a.bp.x) + '、' + f3(a.bp.y) + '）　方向角 ' + V().fmtAngle(a.az) + '　BP〜IP1 ' + f3(a.L0)];
    a.curves.forEach((c, i) => out.push('第' + (i + 1) + '曲線　R ' + c.R + '　' + (c.dir === 'L' ? '左' : '右') + '　IA ' + V().fmtAngle(c.ia) + (i ? '　IP' + i + '〜IP' + (i + 1) + ' ' + f3(c.L) : '')));
    out.push('IP' + a.curves.length + '〜EP ' + f3(a.Lf));
    return out;
  }
  // 入力欄を ENTER で次へ、↑↓ で前後へ。最後の ENTER で last()
  function chain(order, last) {
    order.forEach((el, k) => el.addEventListener('keydown', e => {
      if (e.isComposing) return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (k === order.length - 1) last(); else { order[k + 1].focus(); order[k + 1].select && order[k + 1].select(); } }
      else if (e.key === 'ArrowUp' && k > 0) { e.preventDefault(); order[k - 1].focus(); order[k - 1].select && order[k - 1].select(); }
      else if (e.key === 'ArrowDown' && k < order.length - 1) { e.preventDefault(); order[k + 1].focus(); order[k + 1].select && order[k + 1].select(); }
    }));
  }

  let mainOpen = false;   // メインの窓を二重に開かない
  function open(env) {
    if (mainOpen) return;
    const st = env.state();
    const cur = () => st.aligns.find(a => a.name === st.cur) || null;
    const h = D().h;
    let dlg = null, goingOn = false;
    const go = f => { goingOn = true; dlg.close(); setTimeout(f, 0); };
    const again = () => open(env);
    const a = cur();
    const big = (text, sub, f, dis) => h('button', { type: 'button', class: 'dlg-btn ca-big', disabled: dis, onclick: () => go(f) }, [h('b', { text }), h('span', { text: sub })]);
    dlg = D().open({
      title: '曲線の測量（アプリ版）', width: 560,
      body: h('div', { class: 'ca-main' }, [
        h('p', { class: 'cv-note', text: 'アプリ版プログラム：このアプリだけで動きます。電卓の変数（A〜Z）や、SENTEI・KAIHOU などの電卓実機併用プログラムとは別です。' }),
        h('div', { class: 'ca-box' }, [
          h('div', { class: 'ca-boxhead' }, [h('b', { text: '線形　' + (a ? a.name : '（未設定）') }),
            h('button', { type: 'button', class: 'dlg-btn', text: '選ぶ・入れる', onclick: () => go(() => chooseAlign(env, again)) })]),
          ...alignSummary(a && a.align).map(t => h('span', { class: 'ca-line', text: t }))
        ]),
        h('div', { class: 'ca-box' }, [
          h('b', { text: '後視点・機械点（いまの値）' }),
          h('span', { class: 'ca-line', text: '後視点 BX ' + f3(st.bx || 0) + '　BY ' + f3(st.by || 0) }),
          h('span', { class: 'ca-line', text: '機械点 OX ' + f3(st.ox || 0) + '　OY ' + f3(st.oy || 0) })
        ]),
        h('div', { class: 'ca-bigs' }, [
          big('トランシット', '機械点を進める（開放トラバース）', () => transitForm(env, a, again), !a),
          big('ターゲット', '1〜10 点を測る・図・次回予測', () => targetCount(env, a, again), !a),
          big('記録', '保存した測量の結果', () => V().records({
            list: () => st.records.slice().sort((x, y) => String(y.savedAt).localeCompare(String(x.savedAt))),
            remove: rec => { st.records = st.records.filter(r => r !== rec); env.save(); env.toast('「' + rec.name + '」を消しました'); },
            download: env.download, onClose: again
          }))
        ]),
        a ? null : h('p', { class: 'cv-msg', text: '先に「選ぶ・入れる」で線形を決めてください。' })
      ]),
      buttons: [{ label: '閉じる', kind: 'primary' }],
      onClose: () => { mainOpen = false; if (!goingOn && env.onClose) setTimeout(env.onClose, 0); }
    });
    mainOpen = true;
  }

  // ---- 線形を選ぶ（保存した線形・SENTEI から写す・新しく入れる） ----
  function chooseAlign(env, back) {
    const st = env.state(), h = D().h;
    let dlg = null, goingOn = false;
    const go = f => { goingOn = true; dlg.close(); setTimeout(f, 0); };
    const me = () => chooseAlign(env, back);
    const list = st.aligns.slice().sort((x, y) => String(y.savedAt).localeCompare(String(x.savedAt)));
    const fromSentei = env.senteiAligns ? env.senteiAligns() : [];
    dlg = D().open({
      title: '線形を選ぶ', width: 560,
      body: h('div', {}, [
        h('p', { class: 'dlg-msg', text: list.length ? '使う線形を選びます。' : 'まだ線形がありません。「新しく入れる」か、SENTEI で保存した線形を写してください。' }),
        list.length ? h('ul', { class: 'sl-list' }, list.map(e => h('li', {}, [
          h('div', { class: 'sl-info' }, [h('b', { text: e.name + (e.name === st.cur ? '（使用中）' : '') }), ...alignSummary(e.align).map(t => h('span', { text: t }))]),
          h('div', { class: 'sl-btns' }, [
            h('button', { type: 'button', class: 'dlg-btn primary', text: '使う', onclick: () => { st.cur = e.name; env.save(); go(back); } }),
            h('button', { type: 'button', class: 'dlg-btn', text: '直す', onclick: () => go(() => editAlign(env, e, me)) }),
            h('button', { type: 'button', class: 'dlg-btn danger', text: '消す', onclick: async () => {
              if (!await D().confirm('線形を消す', '「' + e.name + '」を消します。元に戻せません（記録は残ります）。', '消す', 'danger')) return;
              st.aligns = st.aligns.filter(x => x !== e); if (st.cur === e.name) st.cur = null; env.save(); go(me);
            } })
          ])
        ]))) : null,
        fromSentei.length ? h('div', { class: 'ca-box' }, [
          h('b', { text: 'SENTEI で保存した線形から写す' }),
          h('span', { class: 'cv-note', text: '写したあとは別々です（こちらで直しても SENTEI の保存は変わりません）。' }),
          h('div', { class: 'ca-chips' }, fromSentei.map(s => h('button', { type: 'button', class: 'dlg-btn', text: s.name, onclick: async () => {
            const old = st.aligns.find(x => x.name === s.name);
            if (old && !await D().confirm('上書き', '「' + s.name + '」はもうあります。上書きしますか。', '上書き')) return;
            st.aligns = st.aligns.filter(x => x !== old).concat({ name: s.name, align: JSON.parse(JSON.stringify(s.align)), savedAt: new Date().toISOString() });
            st.cur = s.name; env.save(); env.toast('「' + s.name + '」を写しました'); go(back);
          } })))
        ]) : null
      ]),
      buttons: [{ label: '戻る', onClick: () => { goingOn = true; setTimeout(back, 0); } }, { label: '新しく入れる', kind: list.length ? '' : 'primary', onClick: () => { goingOn = true; setTimeout(() => editAlign(env, null, me), 0); } }],
      onClose: () => { if (!goingOn) setTimeout(back, 0); }
    });
  }

  // ---- 線形を入れる・直す ----
  function editAlign(env, entry, back) {
    const st = env.state(), h = D().h, Vw = V();
    const a0 = entry ? JSON.parse(JSON.stringify(entry.align)) : { bp: { x: 0, y: 0 }, az: 0, L0: 0, curves: [{ R: '', ia: '', dir: 'R', L: 0 }], Lf: 0 };
    const field = (value, label, mode) => h('input', { type: 'text', class: 'cv-in', inputmode: mode || 'decimal', autocomplete: 'off', enterkeyhint: 'next', 'aria-label': label, value: value == null ? '' : value });
    const cell = (label, el, extra) => h('label', { class: 'cv-cell' }, [h('span', { text: label }), el].concat(extra || []));
    const name = h('input', { type: 'text', class: 'cv-in ca-name', autocomplete: 'off', enterkeyhint: 'next', 'aria-label': '線形の名前', placeholder: '例：館町下水 1〜2', maxlength: 40, value: entry ? entry.name : '' });
    const bpx = field(entry ? f3(a0.bp.x) : '', 'BP の X', 'text'), bpy = field(entry ? f3(a0.bp.y) : '', 'BP の Y', 'text');
    const az = field(entry ? Vw.fmtAngle(a0.az) : '', '方向角（BP→IP1）'), azShow = h('span', { class: 'cv-ashow' });
    const l0 = field(entry ? f3(a0.L0) : '', 'BP〜IP1'), lf = field(entry ? f3(a0.Lf) : '', '最後の IP〜EP');
    const curvesBox = h('div', { class: 'ca-curves' });
    const curves = [];
    const showAngle = (inp, out) => { const v = Vw.parseAngle(inp.value); out.textContent = v == null ? '' : Number.isFinite(v) ? Vw.fmtAngle(v) : '読めません'; };
    az.addEventListener('input', () => showAngle(az, azShow));
    function addCurve(c) {
      const i = curves.length;
      const r = { R: field(c.R === '' ? '' : c.R, '第' + (i + 1) + '曲線 R'), ia: field(c.ia === '' ? '' : Vw.fmtAngle(c.ia), '第' + (i + 1) + '曲線 交角'), iaShow: h('span', { class: 'cv-ashow' }),
        L: i ? field(c.L ? f3(c.L) : '', 'IP' + i + '〜IP' + (i + 1)) : null, dir: c.dir === 'L' ? 'L' : 'R' };
      const chip = (d, t) => h('button', { type: 'button', class: 'dlg-btn ca-dir' + (r.dir === d ? ' on' : ''), text: t, onclick: e => { r.dir = d; e.target.parentNode.querySelectorAll('.ca-dir').forEach(b => b.classList.toggle('on', b === e.target)); } });
      r.ia.addEventListener('input', () => showAngle(r.ia, r.iaShow));
      r.el = h('div', { class: 'cv-row' }, [h('div', { class: 'cv-rowname', text: '第' + (i + 1) + '曲線' }),
        r.L ? cell('IP' + i + '〜IP' + (i + 1), r.L) : null, cell('R', r.R), cell('交角 IA', r.ia, [r.iaShow]),
        h('div', { class: 'cv-cell' }, [h('span', { text: '向き' }), h('div', { class: 'ca-chips' }, [chip('R', '右'), chip('L', '左')])])]);
      curves.push(r); curvesBox.append(r.el);
    }
    a0.curves.forEach(addCurve);
    const msg = h('p', { class: 'cv-msg' });
    let dlg = null, goingOn = false;
    function order() { const o = [name, bpx, bpy, az, l0]; curves.forEach(r => { if (r.L) o.push(r.L); o.push(r.R, r.ia); }); o.push(lf); return o; }
    function collect() {
      const nm = name.value.normalize('NFKC').trim();
      if (!nm) return [name, '線形の名前を入れてください'];
      const x = num(bpx.value), y = num(bpy.value), azv = Vw.parseAngle(az.value), L0 = num(l0.value), Lf = num(lf.value);
      if (!Number.isFinite(x)) return [bpx, 'BP の X を入れてください'];
      if (!Number.isFinite(y)) return [bpy, 'BP の Y を入れてください'];
      if (!Number.isFinite(azv)) return [az, '方向角を入れてください（例 45-30-00）'];
      if (!(L0 > 0)) return [l0, 'BP〜IP1 の距離を入れてください'];
      const cs = [];
      for (let i = 0; i < curves.length; i++) {
        const r = curves[i], R = num(r.R.value), ia = Vw.parseAngle(r.ia.value), L = r.L ? num(r.L.value) : 0;
        if (r.L && !(L > 0)) return [r.L, '第' + (i + 1) + '曲線の IP〜IP を入れてください'];
        if (!(R > 0)) return [r.R, '第' + (i + 1) + '曲線の R を入れてください'];
        if (!(ia > 0 && ia < 180)) return [r.ia, '第' + (i + 1) + '曲線の交角を入れてください（0〜180°）'];
        cs.push({ R, ia, dir: r.dir, L });
      }
      if (!(Lf > 0)) return [lf, '最後の IP〜EP の距離を入れてください'];
      return [null, '', nm, { bp: { x, y }, az: azv, L0, curves: cs, Lf }];
    }
    async function store() {
      const [bad, text, nm, align] = collect();
      if (bad) { msg.textContent = text; bad.focus(); return; }
      const old = st.aligns.find(e => e.name === nm);
      if (old && old !== entry && !await D().confirm('上書き', '「' + nm + '」はもうあります。上書きしますか。', '上書き')) return;
      st.aligns = st.aligns.filter(e => e !== old && e !== entry).concat({ name: nm, align, savedAt: new Date().toISOString() });
      st.cur = nm; env.save(); env.toast('線形「' + nm + '」を保存しました');
      goingOn = true; dlg.close(); setTimeout(back, 0);
    }
    const keyNav = e => {
      const o = order(), k = o.indexOf(e.target);
      if (k < 0 || e.isComposing) return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (k === o.length - 1) store(); else { o[k + 1].focus(); o[k + 1].select(); } }
      else if (e.key === 'ArrowUp' && k > 0) { e.preventDefault(); o[k - 1].focus(); o[k - 1].select(); }
      else if (e.key === 'ArrowDown' && k < o.length - 1) { e.preventDefault(); o[k + 1].focus(); o[k + 1].select(); }
    };
    name.setAttribute('autofocus', '');
    dlg = D().open({
      title: entry ? '線形を直す' : '線形を入れる', width: 560,
      body: h('div', { class: 'cv-form', onkeydown: keyNav }, [
        cell('名前', name),
        h('p', { class: 'cv-note', text: 'ENTER で次の欄へ、↑ で前の欄へ。角度は 45-30-00 か 453000 のように入れます。方向角は BP から IP1 への向き（北が 0°、右回り）。' }),
        h('div', { class: 'cv-st' }, [cell('BP の X', bpx), cell('BP の Y', bpy)]),
        cell('方向角', az, [azShow]), cell('BP〜IP1', l0),
        curvesBox,
        h('div', { class: 'ca-chips' }, [
          h('button', { type: 'button', class: 'dlg-btn', text: '曲線を足す', onclick: () => { addCurve({ R: '', ia: '', dir: 'R', L: 0 }); curves[curves.length - 1].L.focus(); } }),
          h('button', { type: 'button', class: 'dlg-btn danger', text: '最後の曲線を消す', onclick: () => { if (curves.length > 1) curves.pop().el.remove(); } })
        ]),
        cell('最後の IP〜EP', lf),
        msg
      ]),
      buttons: [{ label: 'やめる' }, { label: '保存して使う', kind: 'primary', onClick: () => { store(); return false; } }],
      onClose: () => { if (!goingOn) setTimeout(back, 0); }
    });
    showAngle(az, azShow); curves.forEach(r => showAngle(r.ia, r.iaShow));
  }

  // ---- トランシット：後視点・機械点・距離・角度 → 測った点と左右誤差、機械点を進める ----
  function transitForm(env, a, back) {
    const st = env.state(), h = D().h, Vw = V(), g = root.FxSenkei.build(a.align);
    const field = (value, label, mode, hint) => h('input', { type: 'text', class: 'cv-in', inputmode: mode, autocomplete: 'off', enterkeyhint: hint || 'next', 'aria-label': label, value: value == null ? '' : value });
    const cell = (label, el, extra) => h('label', { class: 'cv-cell' }, [h('span', { text: label }), el].concat(extra || []));
    const c = { bx: field(f3(st.bx || 0), '後視点 X', 'text'), by: field(f3(st.by || 0), '後視点 Y', 'text'), ox: field(f3(st.ox || 0), '機械点 X', 'text'), oy: field(f3(st.oy || 0), '機械点 Y', 'text') };
    const d = field('', '距離', 'decimal'), an = field('', '角度', 'decimal', 'done'), aShow = h('span', { class: 'cv-ashow' });
    const out = h('span', { class: 'cv-out', text: '―' }), xy = h('span', { class: 'cv-xy' }), msg = h('p', { class: 'cv-msg' });
    let dlg = null, goingOn = false, res = null;
    function calc() {
      const s = { bx: num(c.bx.value), by: num(c.by.value), ox: num(c.ox.value), oy: num(c.oy.value) }, dv = num(d.value), deg = Vw.parseAngle(an.value);
      aShow.textContent = deg == null ? '' : Number.isFinite(deg) ? Vw.fmtAngle(deg) : '読めません';
      res = null;
      if (!(Object.values(s).every(Number.isFinite) && (s.bx !== s.ox || s.by !== s.oy) && dv > 0 && Number.isFinite(deg))) { out.textContent = '―'; xy.textContent = ''; return; }
      const p = Vw.pointFrom(s, dv, deg), j = root.FxSenkei.judge(g, p);
      res = { s, p, j }; out.textContent = Vw.sideLine(j); xy.textContent = 'FX ' + f3(p.x) + '　FY ' + f3(p.y);
    }
    function finish() {
      calc();
      if (!res) { msg.textContent = !(num(d.value) > 0) ? '距離を入れてください' : '角度・座標を確かめてください'; (!(num(d.value) > 0) ? d : an).focus(); return; }
      const { s, p, j } = res;
      const before = { A: s.bx, B: s.by, C: s.ox, D: s.oy };
      st.bx = s.ox; st.by = s.oy; st.ox = p.x; st.oy = p.y; env.save();
      goingOn = true; dlg.close();
      setTimeout(() => Vw.transit({ p, side: Vw.sideLine(j), before, after: { A: st.bx, B: st.by, C: st.ox, D: st.oy } }, back), 0);
    }
    chain([c.bx, c.by, c.ox, c.oy, d, an], finish);
    an.addEventListener('blur', calc); d.addEventListener('blur', () => { if (an.value.trim()) calc(); });
    Object.values(c).forEach(el => el.addEventListener('blur', () => { if (an.value.trim()) calc(); }));
    an.addEventListener('input', () => { const v = Vw.parseAngle(an.value); aShow.textContent = v == null ? '' : Number.isFinite(v) ? Vw.fmtAngle(v) : '読めません'; });
    d.setAttribute('autofocus', '');
    dlg = D().open({
      title: 'トランシット（' + a.name + '）', width: 520,
      body: h('div', { class: 'cv-form' }, [
        h('div', { class: 'cv-st' }, [cell('後視点 BX', c.bx), cell('後視点 BY', c.by), cell('機械点 OX', c.ox), cell('機械点 OY', c.oy)]),
        h('p', { class: 'cv-note', text: 'ENTER で次の欄へ、↑ で前の欄へ。角度で ENTER を押すと、測った点を出して機械点を進めます（BX←OX、OX←FX）。' }),
        h('div', { class: 'cv-row' }, [cell('距離', d), cell('角度', an, [aShow]), h('div', { class: 'cv-cell cv-err' }, [h('span', { text: '誤差' }), out, xy])]),
        msg
      ]),
      buttons: [{ label: 'やめる' }, { label: '進める', kind: 'primary', onClick: () => { finish(); return false; } }],
      onClose: () => { if (!goingOn) setTimeout(back, 0); }
    });
  }

  // ---- ターゲット：数を選ぶ（ボタン） → 入力表・確かめ・図・保存（curveview.js） ----
  function targetCount(env, a, back) {
    const h = D().h;
    let dlg = null, goingOn = false;
    const pick = n => { goingOn = true; dlg.close(); setTimeout(() => targets(env, a, n, back), 0); };
    dlg = D().open({
      title: 'ターゲットの数', width: 420,
      body: h('div', {}, [
        h('p', { class: 'dlg-msg', text: '測る点の数を選んでください。4 点（1本目前・後、2本目前・後）で推進管の次回予測が出ます。' }),
        h('div', { class: 'ca-nums' }, Array.from({ length: 10 }, (_, i) => h('button', { type: 'button', class: 'dlg-btn' + (i === 3 ? ' primary' : ''), text: String(i + 1), onclick: () => pick(i + 1) })))
      ]),
      buttons: [{ label: 'やめる' }],
      onClose: () => { if (!goingOn) setTimeout(back, 0); }
    });
  }
  function targets(env, a, n, back) {
    const st = env.state();
    V().survey({
      g: root.FxSenkei.build(a.align), align: a.align, n, site: a.name,
      start: { bx: st.bx || 0, by: st.by || 0, ox: st.ox || 0, oy: st.oy || 0 },
      onSave: rec => {
        const d = new Date(), name = stamp(d) + ' 管No.' + rec.pipeNo;
        st.records.push(Object.assign({ name, savedAt: d.toISOString() }, rec));
        env.save(); env.toast('測量結果を保存しました：' + name);
        return name;
      }
    }, r => {
      if (r) { st.bx = r.bx; st.by = r.by; st.ox = r.ox; st.oy = r.oy; env.save(); }
      setTimeout(back, 0);
    });
  }

  root.FxCurveApp = { open, alignSummary };
})(typeof window !== 'undefined' ? window : globalThis);
