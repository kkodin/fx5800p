// fx-5800P 風 プログラム関数電卓 — 画面と操作
(function () {
  'use strict';
  const E = FxEngine, B = FxBasic, MEM = FxMemory, FORMULAS = FxFormulas;
  const $ = id => document.getElementById(id);
  const LETTERS = E.LETTERS;
  const STORE_KEY = 'fx5800p-emu-v1';
  const VERSION = '1.1.0';

  // ---- 保存データ ----------------------------------------------------
  const blankVars = () => { const v = { Ans: 0, __z: [], __dim: 0 }; for (const L of LETTERS) v[L] = 0; return v; };
  let S = { vars: blankVars(), angle: 'Deg', disp: { mode: 'Norm', n: 1 }, programs: [], history: [], fmlaVals: {}, migrated: false };
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        S = Object.assign(S, d);
        S.vars = Object.assign(blankVars(), d.vars || {});
        if (!Array.isArray(S.programs)) S.programs = [];
        if (!Array.isArray(S.history)) S.history = [];
      }
    } catch { toast('保存データを読めませんでした'); }
    if (!S.programs.length) S.programs = samplePrograms();
  }
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
      catch { toast('端末に保存できません。BACKUP でファイルに保存してください'); }
    }, 150);
  }
  function samplePrograms() {
    return [
      { name: 'OCTAHEDRON', mode: 'COMP', source: '"A"?→A\n2×√(3)×A²◢\n√(2)÷3×A^(3)' },
      { name: 'ZAHYO', mode: 'COMP', source: '"X0"?X:"Y0"?Y\n"HOKO"?H\n"L"?L\nRec(L,H)\nX+I→M:Y+J→N\n"X=":M◢\n"Y=":N' },
      { name: 'SUM', mode: 'COMP', source: '"N"?→N\n0→S\nFor 1→I To N\nS+I→S\nNext\n"SUM=":S' },
      { name: 'MENSEKI', mode: 'Formula', source: '"MENSEKI":S=A×B÷2' }
    ];
  }
  // 以前の Pocket Calc（IndexedDB）に入れたプログラムを1回だけ引き継ぐ
  function migrateOld() {
    if (S.migrated || !window.indexedDB) return;
    S.migrated = true; save();
    try {
      const r = indexedDB.open('pocket-calc-v1');
      r.onsuccess = () => {
        try {
          const db = r.result;
          if (!db.objectStoreNames.contains('data')) return;
          const g = db.transaction('data').objectStore('data').get('state');
          g.onsuccess = () => {
            const old = g.result; let n = 0;
            for (const p of (old && old.programs) || []) {
              if (p.kind === 'basic' && p.source && !S.programs.some(x => x.name === p.name) && !['材料費', '合計', '条件分岐'].includes(p.name)) {
                S.programs.push({ name: p.name, mode: 'COMP', source: p.source }); n++;
              }
            }
            if (n) { save(); toast('前の版のプログラム ' + n + ' 本を引き継ぎました'); }
          };
        } catch { /* 古いデータが無ければ何もしない */ }
      };
    } catch { /* 同上 */ }
  }

  // ---- キー定義（写真の fx-5800P の並び） -------------------------------
  // id, 表示, SHIFT表示, ALPHA表示, Getkeyコード, 入力文字, SHIFT入力文字, 種類
  const ROWS = [
    [['SHIFT', 'SHIFT', '', '', 71, null, null, 'k-shift'], ['ALPHA', 'ALPHA', 'A-LOCK', '', 72, null, null, 'k-alpha'], ['EXIT', 'EXIT', '', '', 73, null, null, 'k-light'], ['FMLA', 'FMLA', '', '', 74, null, null, 'k-light'], ['CALC', 'CALC', '', '', 75, null, null, 'k-light'], ['SOLVE', 'SOLVE', '', '', 76, null, null, 'k-light']],
    [['FILE', 'FILE', 'Prog', '', 61, null, 'Prog "', 'k-fn'], ['SQRT', '√▢', '∛', '', 62, '√(', '∛(', 'k-fn'], ['SQR', 'x²', 'x⁻¹', '', 63, '²', '⁻¹', 'k-fn'], ['LOG', 'log', '10ˣ', '', 64, 'log(', '10^(', 'k-fn'], ['LN', 'ln', 'eˣ', '', 65, 'ln(', 'e^(', 'k-fn'], ['POW', 'x▢', 'ˣ√', '', 66, '^(', 'ˣ√(', 'k-fn']],
    [['CPLX', 'i', '', 'A', 51, null, null, 'k-fn'], ['FRAC', '▭⁄▭', '', 'B', 52, '⌟', null, 'k-fn'], ['DMS', '°′″', '▸DMS', 'C', 53, '°', '▸DMS', 'k-fn'], ['SIN', 'sin', 'sin⁻¹', 'D', 54, 'sin(', 'sin⁻¹(', 'k-fn'], ['COS', 'cos', 'cos⁻¹', 'E', 55, 'cos(', 'cos⁻¹(', 'k-fn'], ['TAN', 'tan', 'tan⁻¹', 'F', 56, 'tan(', 'tan⁻¹(', 'k-fn']],
    [['RCL', 'RCL', 'STO', '=', 41, null, null, 'k-fn'], ['SD', 'S⇔D', '→', 'G', 42, null, '→', 'k-fn'], ['LP', '(', '', 'H', 43, '(', null, 'k-fn'], ['RP', ')', '', 'I', 44, ')', null, 'k-fn'], ['COMMA', ',', '', 'J', 45, ',', null, 'k-fn'], ['MPLUS', 'M+', 'M−', '"', 46, null, null, 'k-fn']]
  ];
  const NROWS = [
    [['7', '7', '', 'K', 31, '7'], ['8', '8', '', 'L', 32, '8'], ['9', '9', '', 'M', 33, '9'], ['DEL', 'DEL', 'INS', '', 34, null, null, 'k-del'], ['AC', 'AC', 'OFF', '', 0, null, null, 'k-del']],
    [['4', '4', '', 'N', 21, '4'], ['5', '5', '', 'O', 22, '5'], ['6', '6', '', 'P', 23, '6'], ['MUL', '×', '?', 'Q', 24, '×', '?'], ['DIV', '÷', ':', 'R', 87, '÷', ':']],
    [['1', '1', '', 'S', 35, '1'], ['2', '2', '', 'T', 36, '2'], ['3', '3', '', 'U', 37, '3'], ['ADD', '+', 'Pol(', 'V', 77, '+', 'Pol('], ['SUB', '−', 'Rec(', 'W', 67, '-', 'Rec(']],
    [['0', '0', 'Rnd(', 'X', 25, '0', 'Rnd('], ['DOT', '.', 'DimZ', 'Y', 26, '.', 'DimZ'], ['EXP', '×10ˣ', 'π', 'Z', 27, 'ᴇ', 'π'], ['NEG', '(−)', 'Ans', 'SPACE', 57, '-', 'Ans'], ['EXE', 'EXE', '◢', '', 47, null, '◢', 'k-exe']]
  ];
  const KEYS = {};
  for (const r of [...ROWS, ...NROWS]) for (const k of r) KEYS[k[0]] = { id: k[0], label: k[1], sl: k[2], al: k[3], code: k[4], ins: k[5] ?? null, sins: k[6] ?? null, cls: k[7] || 'k-num' };
  Object.assign(KEYS, {
    MODE: { id: 'MODE', code: 81 }, FUNC: { id: 'FUNC', code: 82 },
    LEFT: { id: 'LEFT', code: 83 }, UP: { id: 'UP', code: 84 }, DOWN: { id: 'DOWN', code: 85 }, RIGHT: { id: 'RIGHT', code: 86 }
  });
  const alphaChar = k => { const a = k.al; if (!a) return null; return a === 'SPACE' ? ' ' : a; };

  // ---- 画面の状態 ------------------------------------------------------
  let mode = 'comp';           // comp / error / menu / calc / solve / fmla / name / edit / run / confirm
  let shift = false, alpha = false, alock = false, pending = null; // pending: 'STO' | 'RCL'
  let comp = { toks: [], cur: 0, shown: null, histIdx: -1 };
  let errState = null, menu = null, calc = null, solve = null, fm = null, nameIn = null, edit = null, run = null, confirmSt = null;
  let lastKeyCode = 0;
  const ctxComp = () => ({ vars: S.vars, angle: S.angle, disp: S.disp, getkey: () => 0 });

  // ---- 液晶の描画 ------------------------------------------------------
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function line(text, opt = {}) { return { text: text ?? '', ...opt }; }
  function paint(lines) {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const l = lines[i] || line('');
      let html;
      if (l.html !== undefined) html = l.html;
      else html = esc(l.text);
      out.push('<div class="ln' + (l.right ? ' right' : '') + (l.inv ? ' inv' : '') + (l.small ? ' small' : '') + (l.tap !== undefined ? ' tap' : '') + '"' + (l.tap !== undefined ? ' data-tap="' + l.tap + '"' : '') + '>' + html + '</div>');
    }
    $('screen').innerHTML = out.join('');
    indicators();
  }
  function indicators(extra) {
    const ind = [];
    if (shift) ind.push('<b class="i-s">S</b>');
    if (alpha || alock) ind.push('<b class="i-a">' + (alock ? 'A̲' : 'A') + '</b>');
    if (pending) ind.push('<b>' + pending + '</b>');
    if ((S.vars.M || 0) !== 0) ind.push('<b class="tapind" data-ind="var" title="変数の一覧">M</b>');
    // タップで角度・表示桁を選べる
    ind.push('<span class="tapind" data-ind="angle" title="角度の単位を選ぶ">' + { Deg: 'D', Rad: 'R', Gra: 'G' }[S.angle] + '</span>');
    ind.push('<span class="tapind' + (S.disp.mode === 'Norm' ? ' faint' : '') + '" data-ind="disp" title="表示の桁を選ぶ">' + (S.disp.mode === 'Norm' ? 'Norm' + S.disp.n : S.disp.mode + ' ' + S.disp.n) + '</span>');
    if (mode === 'run' && run && run.wait && run.wait.type === 'pause') ind.push('<b>Disp</b>');
    if (mode === 'run' && run && !run.wait && !run.done) ind.push('<b class="busy">▮</b>');
    if (mode === 'edit' && edit) ind.unshift('<span class="ed">' + esc(edit.prog.name) + (edit.prog.mode === 'Formula' ? ' FM' : '') + '</span>');
    if (extra) ind.push(extra);
    $('ind').innerHTML = ind.join(' ');
  }
  // 式を16桁で折り返し、カーソルを含む行を表示する
  function wrapWithCursor(text, curIdx, maxLines) {
    const chars = Array.from(text), curChar = Array.from(text.slice(0, curIdx)).length;
    const rows = [];
    for (let i = 0; i <= chars.length; i += 16) rows.push(i);
    if (chars.length && chars.length % 16 === 0 && curChar === chars.length) { /* カーソルは次の行 */ } else if (rows.length > 1 && rows[rows.length - 1] === chars.length) rows.pop();
    const curRow = Math.min(Math.floor(curChar / 16), rows.length - 1);
    const first = Math.max(0, curRow - maxLines + 1);
    const lines = [];
    for (let r = first; r < Math.min(rows.length, first + maxLines); r++) {
      const seg = chars.slice(r * 16, r * 16 + 16);
      let html = '';
      for (let j = 0; j <= seg.length; j++) {
        const pos = r * 16 + j;
        if (pos === curChar && curIdx >= 0) html += j < seg.length ? '<span class="cur">' + esc(seg[j]) + '</span>' : '<span class="cur">&nbsp;</span>';
        else if (j < seg.length) html += esc(seg[j]);
      }
      lines.push(line('', { html }));
    }
    return lines;
  }
  const fmtVal = (v, how) => how === 'dms' ? E.formatDMS(v) : how === 'frac' ? (E.toFraction(v) || E.formatNumber(v, S.disp)) : E.formatNumber(v, S.disp);

  function render() {
    const lcd = $('lcd');
    lcd.classList.toggle('editing', mode === 'edit');
    document.querySelector('.calc').classList.toggle('menu-open', mode === 'menu');
    $('editor').hidden = mode !== 'edit';
    $('screen').hidden = mode === 'edit';
    if (mode === 'comp') return renderComp();
    if (mode === 'error') return renderError();
    if (mode === 'menu') return renderMenu();
    if (mode === 'calc') return renderSubst(calc, false);
    if (mode === 'solve') return renderSubst(solve, true);
    if (mode === 'fmla') return renderFmla();
    if (mode === 'name') return renderName();
    if (mode === 'run') return renderRun();
    if (mode === 'confirm') return renderConfirm();
    if (mode === 'edit') return indicators();
  }

  // ---- COMP（通常計算） ------------------------------------------------
  const compText = () => comp.toks.join('');
  function renderComp() {
    const text = compText();
    const curIdx = comp.shown ? -1 : comp.toks.slice(0, comp.cur).join('').length;
    const r = comp.shown;
    if (!r) { paint(wrapWithCursor(text, curIdx, 4)); return; }
    const lines = wrapWithCursor(r.label ?? text, -1, r.pair ? 2 : 3);
    while (lines.length < (r.pair ? 2 : 3)) lines.push(line(''));
    if (r.pair) {
      lines.push(line(r.pair.a[0] + '=' + E.formatNumber(r.pair.a[1], S.disp)), line(r.pair.b[0] + '=' + (r.pair.angleB && r.how === 'dms' ? E.formatDMS(r.pair.b[1]) : E.formatNumber(r.pair.b[1], S.disp))));
    } else lines.push(line(r.text ?? fmtVal(r.value, r.how), { right: true }));
    paint(lines);
  }
  function compInsert(s) {
    if (comp.shown) {
      const cont = /^(\+|-|×|÷|\^\(|²|⁻¹|³|!|%|→|▸DMS|ˣ√\(|ℙ|ℂ|=|≠|<|>|≤|≥| And | Or )/.test(s) && !comp.shown.noAns;
      comp.toks = cont ? ['Ans'] : [];
      comp.cur = comp.toks.length; comp.shown = null;
    }
    comp.toks.splice(comp.cur, 0, s); comp.cur++;
    comp.histIdx = -1;
  }
  function compEvaluate(text, label) {
    const k = text.lastIndexOf('→');
    let target = null, expr = text;
    if (k >= 0 && !/[:◢?"]/.test(text)) { target = text.slice(k + 1).trim(); expr = text.slice(0, k); }
    const r = E.evaluate(expr, ctxComp());
    if (target) {
      if (/^[A-Z]$/.test(target)) S.vars[target] = r.value;
      else if (target === 'DimZ') MEM.setDim(S.vars, r.value);
      else { const m = target.match(/^([A-Z])\[(.+?)\]?$/); if (!m) throw new E.CalcError('Syntax ERROR', '代入先'); MEM.set(S.vars, MEM.indexOf(m[1], E.evaluate(m[2], ctxComp()).value), r.value); }
    }
    S.vars.Ans = r.value;
    comp.shown = { value: r.value, how: r.dms ? 'dms' : 'norm', pair: r.pair, label };
  }
  function pushHistory(toks) {
    if (!toks.length) return;
    S.history = S.history.filter(h => h.join('') !== toks.join(''));
    S.history.unshift(toks.slice());
    S.history = S.history.slice(0, 40);
  }
  const PROGLIKE = /[:◢?"]|(^|[^A-Za-z])(If|For|While|Do|Lbl|Goto|Prog|Locate|Cls|Isz|Dsz|Return|Stop|Deg|Rad|Gra|Fix|Sci|Norm|ClrMemory)([^a-z]|$)/;
  function compExe() {
    if (!comp.toks.length) {
      if (comp.shown && S.history[0]) comp.toks = S.history[0].slice();
      else return;
    }
    const toks = comp.toks.slice(), text = toks.join('');
    pushHistory(toks);
    if (PROGLIKE.test(text)) { startRun({ name: '(COMP)', mode: 'COMP', source: text }, 'comp'); return; }
    try { compEvaluate(text); comp.cur = comp.toks.length; save(); }
    catch (e) { showError(e, 'comp', text); }
  }
  function compStore(letter) {
    try {
      const text = comp.shown ? 'Ans' : compText();
      const r = E.evaluate(text || 'Ans', ctxComp());
      S.vars[letter] = r.value; S.vars.Ans = r.value;
      if (!comp.shown) pushHistory(comp.toks);
      comp.toks = comp.shown ? [] : comp.toks;
      comp.shown = { value: r.value, how: r.dms ? 'dms' : 'norm', label: (comp.shown ? 'Ans' : text) + '→' + letter, noAns: false };
      save();
    } catch (e) { showError(e, 'comp', compText()); }
  }
  function compRecall(letter) {
    const v = S.vars[letter] || 0;
    S.vars.Ans = v;
    comp.toks = [letter]; comp.cur = 1;
    comp.shown = { value: v, how: 'norm', label: letter };
    save();
  }
  function compMemory(sign) {
    try {
      const text = comp.shown ? 'Ans' : compText();
      if (!text) return;
      const r = E.evaluate(text, ctxComp());
      S.vars.M = (S.vars.M || 0) + sign * r.value; S.vars.Ans = r.value;
      if (!comp.shown) pushHistory(comp.toks);
      comp.shown = { value: r.value, how: r.dms ? 'dms' : 'norm', label: text + (sign > 0 ? 'M+' : 'M−') };
      save();
    } catch (e) { showError(e, 'comp', compText()); }
  }
  function compKey(k) {
    const id = k.id;
    if (id === 'EXE') { if (shift) return compInsert('◢'); return compExe(); }
    if (id === 'AC') { comp = { toks: [], cur: 0, shown: null, histIdx: -1 }; return; }
    if (id === 'DEL') {
      if (comp.shown) { comp.toks = comp.toks.length ? comp.toks : (S.history[0] || []).slice(); comp.cur = comp.toks.length; comp.shown = null; }
      if (comp.cur > 0) { comp.toks.splice(comp.cur - 1, 1); comp.cur--; }
      return;
    }
    if (id === 'LEFT' || id === 'RIGHT') {
      if (comp.shown) { comp.toks = comp.toks.length ? comp.toks : (S.history[0] || []).slice(); comp.cur = id === 'LEFT' ? comp.toks.length : 0; comp.shown = null; return; }
      comp.cur = Math.max(0, Math.min(comp.toks.length, comp.cur + (id === 'LEFT' ? -1 : 1)));
      return;
    }
    if (id === 'UP' || id === 'DOWN') {
      if (!S.history.length) return;
      comp.histIdx = Math.max(-1, Math.min(S.history.length - 1, comp.histIdx + (id === 'UP' ? 1 : -1)));
      comp.toks = comp.histIdx < 0 ? [] : S.history[comp.histIdx].slice();
      comp.cur = comp.toks.length; comp.shown = null;
      return;
    }
    if (id === 'DMS' && !shift && comp.shown && !comp.shown.pair) { comp.shown.how = comp.shown.how === 'dms' ? 'norm' : 'dms'; return; }
    if (id === 'DMS' && !shift && comp.shown && comp.shown.pair) { comp.shown.how = comp.shown.how === 'dms' ? 'norm' : 'dms'; return; }
    if (id === 'SD' && !shift) {
      if (comp.shown && !comp.shown.pair) {
        if (comp.shown.how === 'frac') comp.shown.how = 'norm';
        else if (E.toFraction(comp.shown.value)) comp.shown.how = 'frac';
        else toast('分数で表せない値です');
      }
      return;
    }
    if (id === 'MPLUS') return compMemory(shift ? -1 : 1);
    if (id === 'CALC') return startCalc();
    if (id === 'SOLVE') return startSolve();
    if (id === 'CPLX') { toast('複素数 i は未対応です'); return; }
    const s = shift ? k.sins : k.ins;
    if (s) compInsert(s);
  }

  // ---- エラー表示 -------------------------------------------------------
  function showError(e, back, text) {
    if (!(e instanceof E.CalcError)) { console.error(e); e = new E.CalcError('Syntax ERROR', String(e.message || e)); }
    errState = { e, back, text };
    mode = 'error';
  }
  function renderError() {
    const e = errState.e;
    // 計算画面で命令を打って EXE した場合は、プログラムの書き方へ案内する
    if (errState.back === 'comp' && e.prog === '(COMP)') {
      paint([line(e.kind, { inv: true }), line(e.detail, { small: true }), line('書くのは MODE→PROG→NEW（EXE=改行）', { small: true }), line('[◀][▶]:式に戻る　[AC]:消す', { small: true })]);
      return;
    }
    const where = e.prog ? (e.prog + (e.line ? ' ' + e.line + '行' : '')) : '';
    paint([line(e.kind, { inv: true }), line(e.detail || where, { small: true }), line(e.detail && where ? where : '[AC] :Cancel', { small: true }), line(errState.back === 'comp' || errState.back === 'edit' ? '[◀][▶]:Goto' : '[EXIT]:戻る', { small: true })]);
  }
  function errorKey(k) {
    const back = errState.back;
    if ((k.id === 'LEFT' || k.id === 'RIGHT') && back === 'comp') {
      mode = 'comp'; comp.shown = null;
      if (errState.e.pos !== undefined) { let n = 0, c = 0; while (c < comp.toks.length && n + comp.toks[c].length <= errState.e.pos) { n += comp.toks[c].length; c++; } comp.cur = c; }
      else comp.cur = comp.toks.length;
      return;
    }
    if ((k.id === 'LEFT' || k.id === 'RIGHT') && back === 'edit' && errState.prog) { openEditor(errState.prog, errState.e.line); return; }
    if (k.id === 'AC' || k.id === 'EXIT' || k.id === 'EXE' || k.id === 'LEFT' || k.id === 'RIGHT') {
      if (back === 'comp') { mode = 'comp'; comp.shown = null; if (k.id === 'AC') comp.toks = []; comp.cur = comp.toks.length; }
      else if (back === 'calc') { mode = 'calc'; calc.phase = 'input'; }
      else if (back === 'solve') { mode = 'solve'; solve.phase = 'input'; }
      else if (back === 'fmla') { mode = 'fmla'; fm.phase = 'input'; }
      else if (back === 'runlist' || back === 'edit') openProgList('RUN');
      else { mode = 'comp'; }
    }
  }

  // ---- 汎用メニュー（4行の液晶に一覧を出し、▲▼・数字・タップで選ぶ） ------
  function openMenu(title, items, opt = {}) {
    menu = { title, items, sel: 0, top: 0, back: opt.back || null, numbered: opt.numbered !== false, onKey: opt.onKey || null };
    mode = 'menu';
  }
  // メニューは液晶を大きく広げ、指で選びやすい一覧にする（短い項目はボタンを並べる）
  function renderMenu() {
    const m = menu;
    const short = m.items.length > 6 && m.items.every(it => Array.from(it.label).length <= 9);
    const items = m.items.map((it, i) =>
      '<button type="button" class="mi' + (i === m.sel ? ' sel' : '') + '" data-tap="' + i + '">' +
      (m.numbered && i < 9 ? '<span class="no">' + (i + 1) + '</span>' : '') + '<span class="lb">' + esc(it.label) + '</span></button>').join('');
    $('screen').innerHTML =
      '<div class="menu-head"><button type="button" class="mback" data-tap="back">◀ 戻る</button><b>' + esc(m.title) + '</b><span class="mcount">' + m.items.length + '件</span></div>' +
      '<div class="menu-list' + (short ? ' grid' : '') + '">' + (items || '<div class="empty">（なし）</div>') + '</div>';
    const sel = $('screen').querySelector('.mi.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
    indicators();
  }
  function menuKey(k) {
    const m = menu, id = k.id;
    if (id === 'UP') { m.sel = (m.sel - 1 + m.items.length) % Math.max(1, m.items.length); return; }
    if (id === 'DOWN') { m.sel = (m.sel + 1) % Math.max(1, m.items.length); return; }
    if (id === 'EXE') { const it = m.items[m.sel]; if (it) it.act(); return; }
    if (id === 'EXIT') { if (m.back) m.back(); else mode = 'comp'; return; }
    if (id === 'AC') { mode = 'comp'; return; }
    if (m.onKey && m.onKey(k)) return;
    if (m.numbered && /^[1-9]$/.test(id) && !alpha && !alock) { const i = Number(id) - 1; if (m.items[i]) { m.sel = i; m.items[i].act(); } return; }
    const ch = alphaChar(k);
    if ((alpha || alock) && ch && /[A-Z]/.test(ch)) { const i = m.items.findIndex(it => (it.key || it.label).toUpperCase().startsWith(ch)); if (i >= 0) m.sel = i; }
  }

  // ---- FUNCTION（関数・命令の一覧） -----------------------------------
  const FN_GROUPS = [
    ['MATH 数学', ['Abs(', 'Int(', 'Intg(', 'Frac(', 'Rnd(', 'x⁻¹|⁻¹', 'x!|!', 'x³|³', '∛(', 'ˣ√(', 'nPr|ℙ', 'nCr|ℂ', 'Ran#', 'RanInt#(', 'Pol(', 'Rec(', 'GCD(', 'LCM(', '%', 'π', 'e', 'sinh(', 'cosh(', 'tanh(', 'sinh⁻¹(', 'cosh⁻¹(', 'tanh⁻¹(', 'log(a,b)|log(']],
    ['PROG 命令', ['?', '→', '◢', ':', '"', '⇒', '=', '≠', '>', '≥', '<', '≤', 'If |If ', 'Then |Then ', 'Else |Else ', 'IfEnd', 'For →I To |For ', ' To | To ', ' Step | Step ', 'Next', 'While |While ', 'WhileEnd', 'Do', 'LpWhile |LpWhile ', 'Lbl |Lbl ', 'Goto |Goto ', 'Prog "|Prog "', 'Return', 'Stop', 'Break', 'Isz |Isz ', 'Dsz |Dsz ', 'Locate |Locate ', 'Cls', 'Getkey', ' And | And ', ' Or | Or ', ' Xor | Xor ', 'Not(', 'Z[|Z[', ']', 'DimZ', 'ClrMemory']],
    ['ANGLE 角度', ['°', '▸DMS', 'Deg', 'Rad', 'Gra']],
    ['DISP 表示', ['Fix |Fix ', 'Sci |Sci ', 'Norm |Norm ']]
  ];
  function openFunction() {
    const ins = s => { mode = menuBackMode; insertText(s); };
    const menuBackMode = mode === 'menu' ? 'comp' : mode;
    const back = () => { mode = menuBackMode; };
    openMenu('FUNCTION', FN_GROUPS.map(([g, list]) => ({
      label: g, act: () => openMenu(g, list.map(x => { const [lab, val] = x.includes('|') ? x.split('|') : [x, x]; return { label: lab.trim() || lab, act: () => ins(val) }; }), { back: () => openFunction() })
    })), { back });
  }
  // 入力中の場所へ文字を入れる（COMP・代入画面・名前・エディタ・プログラム入力）
  function insertText(s) {
    if (mode === 'comp') return compInsert(s);
    if (mode === 'edit') return editInsert(s);
    if (mode === 'calc' || mode === 'solve') return substInsert(mode === 'calc' ? calc : solve, s);
    if (mode === 'fmla' && fm.phase === 'input') return substInsert(fm, s);
    if (mode === 'run' && run && run.wait && run.wait.type === 'input') { run.inToks.splice(run.inCur, 0, s); run.inCur++; return; }
    if (mode === 'name') { nameIn.text += s; }
  }

  // ---- CALC・SOLVE（代入画面） -----------------------------------------
  function parseFormulaText(text) {
    let comment = '', body = text.trim();
    const m = body.match(/^"([^"]*)"\s*:?\s*(.*)$/s);
    if (m) { comment = m[1]; body = m[2]; }
    return { comment, body };
  }
  function topLevelEq(s) {
    let d = 0;
    for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--; else if (c === '=' && d === 0) return i; }
    return -1;
  }
  function startCalc() {
    let toks = comp.toks.length ? comp.toks : (S.history[0] || []);
    if (!toks.length) { toast('式を入れてから CALC を押します'); return; }
    const text = toks.join(''), { comment, body } = parseFormulaText(text);
    let resultVar = null, expr = body;
    const m = body.match(/^([A-Z])\s*=\s*(.+)$/);
    if (m) { resultVar = m[1]; expr = m[2]; }
    const vars = E.variablesIn(expr);
    pushHistory(toks); comp.toks = toks.slice(); comp.cur = toks.length;
    calc = { kind: 'calc', text, comment, expr, resultVar, vars, idx: 0, editing: null, phase: vars.length ? 'input' : 'result' };
    mode = 'calc';
    if (!vars.length) calcCompute();
  }
  function startSolve() {
    let toks = comp.toks.length ? comp.toks : (S.history[0] || []);
    if (!toks.length) { toast('方程式を入れてから SOLVE を押します'); return; }
    const text = toks.join(''), { comment, body } = parseFormulaText(text);
    const k = topLevelEq(body);
    const lhs = k >= 0 ? body.slice(0, k) : body, rhs = k >= 0 ? body.slice(k + 1) : '0';
    const vars = E.variablesIn(body);
    if (!vars.length) { toast('変数（A〜Z）を含む式にしてください'); return; }
    pushHistory(toks); comp.toks = toks.slice(); comp.cur = toks.length;
    solve = { kind: 'solve', text, comment, lhs, rhs, vars, idx: vars.length - 1, editing: null, phase: 'input', result: null };
    // 解く変数は最後の変数を初期選択（実機は反転表示で選ぶ）。X があれば X。
    const xi = vars.indexOf('X'); if (xi >= 0) solve.idx = xi;
    mode = 'solve';
  }
  function renderSubst(st, isSolve) {
    if (st.phase === 'result') {
      const head = wrapWithCursor(st.comment || st.text, -1, 1);
      if (isSolve) {
        const v = st.vars[st.idx];
        paint([head[0], line(v + '=' + E.formatNumber(S.vars[v], S.disp), { inv: true }), line('L-R=' + E.formatNumber(st.result.res, S.disp)), line('[EXE]:戻る', { small: true })]);
      } else {
        paint([head[0], line(''), line(st.resultVar ? st.resultVar + '=' : ''), line(fmtVal(st.result.value, st.result.how), { right: true })]);
      }
      return;
    }
    const head = wrapWithCursor(st.comment || st.text, -1, 1);
    const lines = [head[0]];
    const top = Math.max(0, Math.min(st.idx - 1, st.vars.length - 3));
    for (let i = top; i < Math.min(st.vars.length, top + 3); i++) {
      const v = st.vars[i];
      if (i === st.idx && st.editing) {
        const t = st.editing.toks.join(''), cur = st.editing.toks.slice(0, st.editing.cur).join('').length;
        const w = wrapWithCursor(t, cur, 1)[0];
        lines.push(line('', { html: esc(v) + '=' + w.html, tap: i }));
      } else lines.push(line(v + '=' + E.formatNumber(S.vars[v] || 0, S.disp), { inv: i === st.idx, tap: i }));
    }
    paint(lines);
    indicators(isSolve ? '<b>SOLVE</b>' : '<b>CALC</b>');
  }
  function substInsert(st, s) {
    if (!st.editing) st.editing = { toks: [], cur: 0 };
    st.editing.toks.splice(st.editing.cur, 0, s); st.editing.cur++;
  }
  // 編集中の値を確定。成功なら true
  function substCommit(st, back) {
    if (!st.editing) return true;
    const text = st.editing.toks.join('');
    if (!text) { st.editing = null; return true; }
    try {
      const r = E.evaluate(text, ctxComp());
      const name = st.vars[st.idx];
      if (st.kind === 'fmla') st.vals[name] = r.value; else S.vars[name] = r.value;
      st.editing = null; save(); return true;
    } catch (e) { showError(e, back); return false; }
  }
  function calcCompute() {
    try {
      const r = E.evaluate(calc.expr, ctxComp());
      if (calc.resultVar) S.vars[calc.resultVar] = r.value;
      S.vars.Ans = r.value;
      calc.result = { value: r.value, how: r.dms ? 'dms' : 'norm' };
      calc.phase = 'result'; save();
    } catch (e) { showError(e, 'calc'); }
  }
  function substKey(st, k, isSolve) {
    const id = k.id, back = isSolve ? 'solve' : 'calc';
    if (st.phase === 'result') {
      if (id === 'AC' || id === 'EXIT') { mode = 'comp'; comp.shown = null; return; }
      if (id === 'EXE' || id === (isSolve ? 'SOLVE' : 'CALC')) { st.phase = 'input'; if (!isSolve) st.idx = 0; return; }
      if (id === 'DMS' && !isSolve && st.result) { st.result.how = st.result.how === 'dms' ? 'norm' : 'dms'; return; }
      if (!isSolve) { st.phase = 'input'; mode = 'comp'; comp.shown = null; return compKey(k); }
      return;
    }
    if (id === 'AC') { if (st.editing) { st.editing = null; return; } mode = 'comp'; comp.shown = null; return; }
    if (id === 'EXIT') { mode = 'comp'; comp.shown = null; return; }
    if (id === 'UP' || id === 'DOWN') {
      if (!substCommit(st, back)) return;
      st.idx = Math.max(0, Math.min(st.vars.length - 1, st.idx + (id === 'UP' ? -1 : 1)));
      return;
    }
    if (id === 'LEFT' || id === 'RIGHT') { if (st.editing) st.editing.cur = Math.max(0, Math.min(st.editing.toks.length, st.editing.cur + (id === 'LEFT' ? -1 : 1))); return; }
    if (id === 'DEL') { if (st.editing && st.editing.cur > 0) { st.editing.toks.splice(st.editing.cur - 1, 1); st.editing.cur--; } return; }
    if (id === 'EXE') {
      if (!substCommit(st, back)) return;
      if (!isSolve && st.idx >= st.vars.length - 1) return calcCompute();
      st.idx = Math.min(st.vars.length - 1, st.idx + 1);
      return;
    }
    if (id === 'CALC' && !isSolve) { if (substCommit(st, back)) calcCompute(); return; }
    if (id === 'SOLVE' && isSolve) { if (substCommit(st, back)) doSolve(); return; }
    const s = shift ? k.sins : k.ins;
    if (s) substInsert(st, s);
  }
  function doSolve() {
    const v = solve.vars[solve.idx], ctx = ctxComp();
    const f = x => { const save0 = S.vars[v]; S.vars[v] = x; try { const L = E.evaluate(solve.lhs, ctx).value, R = E.evaluate(solve.rhs, ctx).value; return { d: L - R, scale: Math.max(1, Math.abs(L), Math.abs(R)) }; } finally { S.vars[v] = save0; } };
    const safe = x => { try { const r = f(x); return Number.isFinite(r.d) ? r : null; } catch { return null; } };
    const good = (x, r) => r && Math.abs(r.d) <= 1e-10 * r.scale;
    let x = S.vars[v] || 0, r = safe(x), ans = null;
    if (!r) { showError(new E.CalcError('Math ERROR', '初期値で計算できません'), 'solve'); return; }
    for (let i = 0; i < 200 && r; i++) {
      if (good(x, r) && i > 0 && Math.abs(r.d) === 0) { ans = x; break; }
      const h = Math.max(Math.abs(x) * 1e-7, 1e-9), a = safe(x + h), b = safe(x - h);
      if (!a || !b) break;
      const d = (a.d - b.d) / (2 * h);
      if (!Number.isFinite(d) || d === 0) break;
      let step = r.d / d, xn = x - step, rn = safe(xn), tries = 0;
      while ((!rn || Math.abs(rn.d) > Math.abs(r.d)) && tries < 30) { step /= 2; xn = x - step; rn = safe(xn); tries++; }
      if (!rn) break;
      const done = Math.abs(xn - x) <= 1e-14 * Math.max(1, Math.abs(xn));
      x = xn; r = rn;
      if (done || (good(x, r) && Math.abs(step) <= 1e-12 * Math.max(1, Math.abs(x)))) { ans = x; break; }
    }
    if (ans === null && r && good(x, r)) ans = x;
    if (ans === null) {
      // 符号が変わる区間を探して二分法
      const x0 = S.vars[v] || 0;
      outer: for (let span = 1; span < 1e8; span *= 2) {
        for (const [p, q] of [[x0, x0 + span], [x0 - span, x0]]) {
          const fp = safe(p), fq = safe(q);
          if (fp && fq && Math.sign(fp.d) !== Math.sign(fq.d)) {
            let lo = p, hi = q, flo = fp.d;
            for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, fm2 = safe(mid); if (!fm2) break; if (Math.sign(fm2.d) === Math.sign(flo)) { lo = mid; flo = fm2.d; } else hi = mid; }
            const mid = (lo + hi) / 2, fr = safe(mid);
            if (fr && Math.abs(fr.d) <= 1e-8 * fr.scale) { ans = mid; r = fr; }
            break outer;
          }
        }
      }
    }
    if (ans === null) { showError(new E.CalcError("Can't Solve", '初期値を変えて試してください'), 'solve'); return; }
    S.vars[v] = ans; S.vars.Ans = ans;
    const fin = safe(ans); solve.result = { res: Math.abs(fin.d) <= 1e-12 * fin.scale ? 0 : fin.d };
    solve.phase = 'result'; save();
  }

  // ---- FMLA（内蔵公式・自作公式） --------------------------------------
  function userFormula(p) {
    const { comment, body } = parseFormulaText(p.source);
    const stmts = body.split(/[:\n]/).map(s => s.trim()).filter(Boolean);
    const outs = [], assigned = new Set(), inputs = [];
    for (const s of stmts) {
      const m = s.match(/^([A-Z])\s*=\s*(.+)$/), expr = m ? m[2] : s;
      for (const v of E.variablesIn(expr)) if (!assigned.has(v) && !inputs.includes(v)) inputs.push(v);
      if (m) assigned.add(m[1]);
      outs.push([m ? m[1] : 'Ans', '', expr]);
    }
    return { name: p.name, jp: comment || '自作公式', user: true, in: inputs.map(v => [v, '']), out: outs };
  }
  function openFmlaList() {
    const items = FORMULAS.map(f => ({ label: f.name, key: f.name, act: () => startFmla(f) }));
    for (const p of S.programs.filter(p => p.mode === 'Formula')) items.push({ label: p.name + ' ·FM', key: p.name, act: () => startFmla(userFormula(p)) });
    openMenu('FMLA 公式', items, { numbered: false });
  }
  function startFmla(f) {
    const saved = S.fmlaVals[f.name] || {};
    const vals = {};
    for (const [k] of f.in) vals[k] = f.user ? (S.vars[k] || 0) : (saved[k] ?? 0);
    fm = { kind: 'fmla', f, vars: f.in.map(x => x[0]), vals, idx: 0, editing: null, phase: f.in.length ? 'input' : 'out', outs: [], oi: 0 };
    mode = 'fmla';
    if (!f.in.length) fmlaCompute();
  }
  function fmlaCompute() {
    const f = fm.f, ang = S.angle;
    const h = { rad: x => ang === 'Rad' ? x : ang === 'Gra' ? x * Math.PI / 200 : x * Math.PI / 180, deg: x => ang === 'Rad' ? x : ang === 'Gra' ? x * 200 / Math.PI : x * 180 / Math.PI };
    try {
      fm.outs = [];
      if (f.user) {
        for (const k of fm.vars) S.vars[k] = fm.vals[k];
        for (const [name, , expr] of f.out) {
          const r = E.evaluate(expr, ctxComp());
          if (name !== 'Ans') S.vars[name] = r.value;
          S.vars.Ans = r.value;
          fm.outs.push({ name, label: '', value: r.value, how: r.dms ? 'dms' : 'norm' });
        }
      } else {
        S.fmlaVals[f.name] = { ...fm.vals };
        for (const [name, label, fn, isAng] of f.out) {
          const v = fn(fm.vals, h);
          if (!Number.isFinite(v)) throw new E.CalcError('Math ERROR', label + ' を計算できません');
          fm.outs.push({ name, label, value: v, how: isAng && ang === 'Deg' ? 'dms' : 'norm' });
        }
        S.vars.Ans = fm.outs[0].value;
      }
      fm.oi = 0; fm.phase = 'out'; save();
    } catch (e) { showError(e instanceof E.CalcError ? e : new E.CalcError('Math ERROR', e.message), 'fmla'); }
  }
  function renderFmla() {
    const f = fm.f;
    if (fm.phase === 'out') {
      const o = fm.outs[fm.oi];
      paint([line(f.name, { small: true }), line(o.label || f.jp, { small: true }), line(o.name + '='), line(fmtVal(o.value, o.how), { right: true })]);
      indicators(fm.oi < fm.outs.length - 1 ? '<b>Disp</b>' : '<b>FMLA</b>');
      return;
    }
    const k = fm.vars[fm.idx], spec = f.in[fm.idx];
    let valLine;
    if (fm.editing) {
      const t = fm.editing.toks.join(''), cur = fm.editing.toks.slice(0, fm.editing.cur).join('').length;
      valLine = line('', { html: esc(k) + '=' + wrapWithCursor(t, cur, 1)[0].html });
    } else valLine = line(k + '=' + (spec[2] === 'ang' && S.angle === 'Deg' ? E.formatDMS(fm.vals[k] || 0) : E.formatNumber(fm.vals[k] || 0, S.disp)), { inv: true });
    paint([line(f.name, { small: true }), line(f.jp, { small: true }), valLine, line((spec[1] || '') + (spec[2] === 'ang' ? '（°′″可）' : '') + '  ' + (fm.idx + 1) + '/' + fm.vars.length, { small: true })]);
    indicators('<b>FMLA</b>');
  }
  function fmlaKey(k) {
    const id = k.id;
    if (fm.phase === 'out') {
      if (id === 'EXE') { if (fm.oi < fm.outs.length - 1) fm.oi++; else { fm.phase = 'input'; fm.idx = 0; } return; }
      if (id === 'UP') { if (fm.oi > 0) fm.oi--; return; }
      if (id === 'DOWN') { if (fm.oi < fm.outs.length - 1) fm.oi++; return; }
      if (id === 'DMS') { const o = fm.outs[fm.oi]; o.how = o.how === 'dms' ? 'norm' : 'dms'; return; }
      if (id === 'EXIT') { openFmlaList(); return; }
      if (id === 'AC') { mode = 'comp'; return; }
      return;
    }
    if (id === 'EXIT') { openFmlaList(); return; }
    if (id === 'AC') { if (fm.editing) { fm.editing = null; return; } mode = 'comp'; return; }
    if (id === 'UP') { if (substCommit(fm, 'fmla')) fm.idx = Math.max(0, fm.idx - 1); return; }
    if (id === 'DOWN') { if (substCommit(fm, 'fmla')) fm.idx = Math.min(fm.vars.length - 1, fm.idx + 1); return; }
    if (id === 'LEFT' || id === 'RIGHT') { if (fm.editing) fm.editing.cur = Math.max(0, Math.min(fm.editing.toks.length, fm.editing.cur + (id === 'LEFT' ? -1 : 1))); return; }
    if (id === 'DEL') { if (fm.editing && fm.editing.cur > 0) { fm.editing.toks.splice(fm.editing.cur - 1, 1); fm.editing.cur--; } return; }
    if (id === 'EXE') {
      if (!substCommit(fm, 'fmla')) return;
      if (fm.idx >= fm.vars.length - 1) fmlaCompute(); else fm.idx++;
      return;
    }
    const s = shift ? k.sins : k.ins;
    if (s) substInsert(fm, s);
  }

  // ---- MODE・SETUP -----------------------------------------------------
  function openMode() {
    setupReturn = 'comp';
    openMenu('MODE', [
      { label: 'COMP 通常計算', act: () => { mode = 'comp'; } },
      { label: 'PROG プログラム', act: openProgMenu },
      { label: 'SETUP 設定', act: openSetup },
      { label: 'VAR 変数一覧', act: openVarList }
    ]);
  }
  // 設定を変えて、開く前の画面（計算・実行中の入力など）へ戻る
  let setupReturn = 'comp';
  const toComp = () => { mode = setupReturn === 'menu' ? 'comp' : setupReturn; };
  const setAndClose = (fn, msg) => () => { fn(); save(); toast(msg || '設定しました'); toComp(); };
  const angleItems = () => [
    { label: 'Deg' + (S.angle === 'Deg' ? ' ✓' : '') + ' 度（360°）', act: setAndClose(() => { S.angle = 'Deg'; }, '角度：Deg（度）') },
    { label: 'Rad' + (S.angle === 'Rad' ? ' ✓' : '') + ' ラジアン', act: setAndClose(() => { S.angle = 'Rad'; }, '角度：Rad（ラジアン）') },
    { label: 'Gra' + (S.angle === 'Gra' ? ' ✓' : '') + ' グラード（400）', act: setAndClose(() => { S.angle = 'Gra'; }, '角度：Gra（グラード）') }
  ];
  const now = (m, n) => S.disp.mode === m && (n === undefined || S.disp.n === n) ? ' ✓' : '';
  function openFix(back) {
    openMenu('Fix 小数点以下の桁数', [...Array(10).keys()].map(n => ({ label: 'Fix ' + n + now('Fix', n), act: setAndClose(() => { S.disp = { mode: 'Fix', n }; }, '表示：Fix ' + n) })),
      { back, numbered: false, onKey: k => digitPick(k, n => setAndClose(() => { S.disp = { mode: 'Fix', n }; }, '表示：Fix ' + n)()) });
  }
  function openSci(back) {
    openMenu('Sci 有効桁数', [...Array(10).keys()].map(n => ({ label: 'Sci ' + (n + 1) + now('Sci', n + 1), act: setAndClose(() => { S.disp = { mode: 'Sci', n: n + 1 }; }, '表示：Sci ' + (n + 1)) })),
      { back, numbered: false, onKey: k => digitPick(k, n => setAndClose(() => { S.disp = { mode: 'Sci', n: n === 0 ? 10 : n }; }, '表示：Sci ' + (n === 0 ? 10 : n))()) });
  }
  const dispItems = back => [
    { label: 'Fix' + now('Fix') + ' 小数点以下の桁数を固定', act: () => openFix(back) },
    { label: 'Sci' + now('Sci') + ' 有効桁数を固定', act: () => openSci(back) },
    { label: 'Norm 1' + now('Norm', 1) + ' 通常', act: setAndClose(() => { S.disp = { mode: 'Norm', n: 1 }; }, '表示：Norm 1') },
    { label: 'Norm 2' + now('Norm', 2) + ' 小さい数も小数で', act: setAndClose(() => { S.disp = { mode: 'Norm', n: 2 }; }, '表示：Norm 2') }
  ];
  function remember() { if (mode !== 'menu' && mode !== 'confirm') setupReturn = mode; }
  // SHIFT MODE（SETUP）。戻るは開く前の画面へ。
  function openSetup() {
    remember();
    const self = () => openSetup();
    openMenu('SETUP 角度・表示', [
      ...angleItems(),
      ...dispItems(self),
      { label: 'ClrMemory 変数を0に', act: () => askConfirm('A〜Z・Z[ ]・M を0にしますか', () => { const keep = S.vars.Ans; S.vars = blankVars(); S.vars.Ans = keep; save(); toComp(); toast('変数をクリアしました'); }, self) }
    ], { back: toComp });
  }
  // 液晶の「D」「Fix」などをタップしたとき
  function openAngleMenu() { remember(); openMenu('角度の単位', angleItems(), { back: toComp }); }
  function openDispMenu() { remember(); const self = () => openDispMenu(); openMenu('表示の桁', dispItems(self), { back: toComp }); }
  function digitPick(k, fn) { if (/^[0-9]$/.test(k.id)) { fn(Number(k.id)); return true; } return false; }
  function openVarList() {
    const items = LETTERS.split('').map(L => ({ label: L + '=' + E.formatNumber(S.vars[L] || 0, S.disp), act: () => { mode = 'comp'; compRecall(L); } }));
    items.push({ label: 'DimZ=' + (S.vars.__dim || 0), act: () => { mode = 'comp'; } });
    openMenu('VAR 変数', items, { numbered: false, back: openMode });
  }

  // ---- 確認画面 ---------------------------------------------------------
  function askConfirm(text, yes, no) { confirmSt = { text, yes, no }; mode = 'confirm'; }
  function renderConfirm() { paint([line(confirmSt.text, { small: true }), line(''), line('[EXE] :Yes', { tap: 'yes' }), line('[EXIT]:No', { tap: 'no' })]); }
  function confirmKey(k) {
    if (k.id === 'EXE' || (k.id === '1' && !alpha)) { const f = confirmSt.yes; confirmSt = null; f(); return; }
    if (k.id === 'EXIT' || k.id === 'AC') { const f = confirmSt.no; confirmSt = null; if (f) f(); else mode = 'comp'; }
  }

  // ---- PROG（プログラム） ------------------------------------------------
  function openProgMenu() {
    openMenu('Program Menu', [
      { label: 'NEW 新規作成', act: startNew },
      { label: 'RUN 実行', act: () => openProgList('RUN') },
      { label: 'EDIT 編集', act: () => openProgList('EDIT') },
      { label: 'DELETE 削除', act: () => openProgList('DELETE') },
      { label: 'IMPORT 読込 txt/ccl/cce', act: () => pickFile('prog') },
      { label: 'EXPORT txt書出', act: () => openProgList('EXPORT') },
      { label: 'BACKUP 全保存', act: backupAll },
      { label: 'RESTORE 全復元', act: () => pickFile('backup') }
    ], { back: () => { mode = 'comp'; } });
  }
  const sortedPrograms = () => S.programs.slice().sort((a, b) => a.name.localeCompare(b.name, 'en'));
  function openProgList(kind, selName) {
    const list = sortedPrograms();
    const title = { RUN: 'Prog List 実行', EDIT: 'Prog Edit 編集', DELETE: 'Delete 削除', EXPORT: 'Export 書出' }[kind];
    const items = list.map(p => ({
      label: p.name + (p.mode === 'Formula' ? ' ·FM' : ''), key: p.name,
      act: () => {
        if (kind === 'RUN') { if (p.mode === 'Formula') startFmla(userFormula(p)); else startRun(p, 'list'); }
        else if (kind === 'EDIT') openEditor(p);
        else if (kind === 'DELETE') askConfirm('「' + p.name + '」を削除しますか', () => { S.programs = S.programs.filter(x => x !== p); save(); toast('削除しました'); openProgList('DELETE'); }, () => openProgList('DELETE'));
        else if (kind === 'EXPORT') { exportProgram(p); }
      }
    }));
    if (kind === 'EXPORT' && list.length) items.unshift({ label: '全部まとめて(txt)', act: () => { for (const p of list) exportProgram(p); } });
    if (kind === 'DELETE' && list.length) items.push({ label: 'All Files 全削除', act: () => askConfirm('全プログラム ' + list.length + ' 本を削除しますか', () => { S.programs = []; save(); toast('全部削除しました'); openProgMenu(); }, () => openProgList('DELETE')) });
    openMenu(title, items, { numbered: false, back: openProgMenu });
    if (selName) { const i = items.findIndex(it => it.key === selName); if (i >= 0) menu.sel = i; }
    lastListKind = kind;
  }
  let lastListKind = 'RUN';

  // 名前の入力（ALPHA-LOCK で始まる）
  function startNew() {
    nameIn = { text: '', step: 'name' };
    alock = true; alpha = false;
    mode = 'name';
  }
  function renderName() {
    if (nameIn.step === 'mode') { paint([line('Mode 動作モード', { small: true }), line(nameIn.text), line('1:COMP', { tap: 'c' }), line('2:Formula 公式', { tap: 'f' })]); return; }
    paint([line('File Name?', { small: true }), line('', { html: esc(nameIn.text) + '<span class="cur">&nbsp;</span>' }), line('12文字以内・EXEで決定', { small: true }), line('⌨で文字キーボード', { small: true })]);
  }
  function nameKey(k) {
    const id = k.id;
    if (nameIn.step === 'mode') {
      if (id === '1' || id === '2') { const p = { name: nameIn.text, mode: id === '1' ? 'COMP' : 'Formula', source: '' }; S.programs.push(p); save(); openEditor(p); }
      if (id === 'EXIT' || id === 'AC') openProgMenu();
      return;
    }
    if (id === 'EXIT' || id === 'AC') { alock = false; openProgMenu(); return; }
    if (id === 'DEL') { nameIn.text = Array.from(nameIn.text).slice(0, -1).join(''); return; }
    if (id === 'EXE') {
      const name = nameIn.text.trim();
      if (!name) return;
      alock = false;
      const exist = S.programs.find(p => p.name === name);
      if (exist) { openEditor(exist); return; }
      nameIn.text = name; nameIn.step = 'mode';
      return;
    }
    let ch = null;
    if (alpha || alock) ch = alphaChar(k);
    else if (/^[0-9]$/.test(id)) ch = id;
    else if (id === 'DOT') ch = '.';
    else if (id === 'SUB' || id === 'NEG') ch = '-';
    if (ch && Array.from(nameIn.text).length < 12) nameIn.text += ch;
  }
  function nameTap(t) { if (nameIn.step === 'mode') nameKey({ id: t === 'c' ? '1' : '2' }); }

  // ---- エディタ ---------------------------------------------------------
  function openEditor(p, gotoLine) {
    edit = { prog: p, original: p.source };
    mode = 'edit';
    const ta = $('editor');
    ta.value = p.source;
    render();
    let pos = ta.value.length;
    if (gotoLine) { const ls = ta.value.split('\n'); pos = ls.slice(0, gotoLine - 1).join('\n').length + (gotoLine > 1 ? 1 : 0); }
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(pos, pos);
  }
  function editInsert(s) {
    const ta = $('editor');
    const a = ta.selectionStart, b = ta.selectionEnd;
    ta.setRangeText(s, a, b, 'end');
    editChanged();
  }
  function editChanged() { if (edit) { edit.prog.source = $('editor').value; save(); } }
  function editMoveLine(dir) {
    const ta = $('editor'), v = ta.value, pos = ta.selectionStart;
    const ls = v.lastIndexOf('\n', pos - 1) + 1, col = pos - ls;
    if (dir < 0) { if (ls === 0) return; const ps = v.lastIndexOf('\n', ls - 2) + 1; const np = Math.min(ps + col, ls - 1); ta.setSelectionRange(np, np); }
    else { const le = v.indexOf('\n', pos); if (le < 0) return; const ne = v.indexOf('\n', le + 1); const np = Math.min(le + 1 + col, ne < 0 ? v.length : ne); ta.setSelectionRange(np, np); }
  }
  function closeEditor() {
    editChanged();
    const p = edit.prog;
    edit = null;
    $('editor').blur();
    try {
      if (p.mode === 'COMP') B.check(p.source);
      toast('保存しました：' + p.name);
      openProgList('EDIT', p.name);
    } catch (e) {
      toast('保存しました。ただし文法エラー：' + (e.line ? e.line + '行 ' : '') + e.message, 6000);
      openProgList('EDIT', p.name);
    }
  }
  function editKey(k) {
    const id = k.id, ta = $('editor');
    if (id === 'EXIT') return closeEditor();
    if (id === 'EXE') { if (shift) return editInsert('◢'); return editInsert('\n'); }
    if (id === 'DEL') {
      const a = ta.selectionStart, b = ta.selectionEnd;
      if (a !== b) ta.setRangeText('', a, b, 'end'); else if (a > 0) { const prev = Array.from(ta.value.slice(0, a)).pop(); ta.setRangeText('', a - prev.length, a, 'end'); }
      editChanged(); return;
    }
    if (id === 'AC') return;
    if (id === 'LEFT' || id === 'RIGHT') { const p = Math.max(0, Math.min(ta.value.length, ta.selectionStart + (id === 'LEFT' ? -1 : 1))); ta.setSelectionRange(p, p); return; }
    if (id === 'UP' || id === 'DOWN') return editMoveLine(id === 'UP' ? -1 : 1);
    if (id === 'MPLUS' && !shift) return; // M+ はプログラムでは使わない
    if (id === 'RCL' && shift) return editInsert('→');
    if (id === 'FILE' && !shift) return;
    if (['CALC', 'SOLVE', 'FMLA', 'SD', 'CPLX'].includes(id) && !shift) return;
    const s = shift ? k.sins : k.ins;
    if (s) editInsert(s);
  }

  // ---- 実行（16桁×4行） ---------------------------------------------------
  function newGrid() { return { rows: Array.from({ length: 4 }, () => Array(16).fill(' ')), row: 0 }; }
  function gridNewLine(g) { if (g.row >= 4) { g.rows.shift(); g.rows.push(Array(16).fill(' ')); g.row = 3; } }
  const io = {
    cls() { run.grid = newGrid(); },
    print(text) {
      const g = run.grid, ch = Array.from(String(text));
      let i = 0;
      do { gridNewLine(g); g.rows[g.row] = Array.from({ length: 16 }, (_, j) => ch[i + j] ?? ' '); g.row++; i += 16; } while (i < ch.length);
    },
    printValue(text) {
      const g = run.grid, ch = Array.from(String(text)).slice(-16);
      gridNewLine(g); g.rows[g.row] = Array.from({ length: 16 }, (_, j) => ch[j - (16 - ch.length)] ?? ' '); g.row++;
    },
    locate(x, y, text) { const g = run.grid; const ch = Array.from(String(text)); for (let i = 0; i < ch.length && x - 1 + i < 16; i++) g.rows[y - 1][x - 1 + i] = ch[i]; }
  };
  function startRun(p, from) {
    if (run && !run.done) run.stopped = true;
    let gen;
    try {
      gen = B.run(p, {
        vars: S.vars, io, library: S.programs, angle: S.angle, disp: S.disp,
        getkey: () => { const c = lastKeyCode; lastKeyCode = 0; return c; },
        onAngle: a => { S.angle = a; }, onDisp: d => { S.disp = d; }
      });
    } catch (e) { showError(e, from === 'comp' ? 'comp' : 'runlist'); return; }
    run = { gen, prog: p, from, grid: newGrid(), wait: null, done: false, stopped: false, inToks: [], inCur: 0 };
    mode = 'run'; lastKeyCode = 0;
    pump();
  }
  function pump(input) {
    const token = run;
    if (!token || token.stopped || token.done) return;
    try {
      for (;;) {
        const st = token.gen.next(input); input = undefined;
        if (token.stopped) return;
        if (st.done) {
          token.done = true; token.wait = null;
          if (st.value && st.value.lastText) io.printValue(st.value.lastText);
          if (st.value && st.value.last) S.vars.Ans = st.value.last.value;
          save(); render();
          return;
        }
        const ev = st.value;
        if (ev.type === 'tick') { render(); setTimeout(() => pump(), 0); return; }
        if (ev.type === 'input') {
          token.wait = ev; token.inToks = []; token.inCur = 0;
          io.print(ev.label + '?');
          if (ev.keep) io.printValue(ev.currentText); else gridNewLine(token.grid);
          token.inRow = Math.min(token.grid.row - (ev.keep ? 1 : 0), 3);
          if (!ev.keep) token.grid.row = Math.min(token.grid.row, 3);
          render(); return;
        }
        if (ev.type === 'pause') { token.wait = ev; render(); return; }
      }
    } catch (e) {
      token.done = true; token.wait = null; save();
      showError(e, token.from === 'comp' ? 'comp' : 'edit');
      errState.prog = S.programs.find(x => x.name === e.prog) || null;
      render();
    }
  }
  function renderRun() {
    const g = run.grid, lines = g.rows.map(r => line(r.join('')));
    if (run.wait && run.wait.type === 'input' && (run.inToks.length || !run.wait.keep)) {
      const t = run.inToks.join(''), cur = run.inToks.slice(0, run.inCur).join('').length;
      lines[run.inRow] = wrapWithCursor(t, cur, 1)[0];
    }
    if (run.done && !run.prog.name.startsWith('(')) lines.forEach(l => { l.html = undefined; });
    paint(lines);
  }
  function runKey(k) {
    const id = k.id;
    if (run.done) {
      if (id === 'EXE') { if (run.from === 'comp') { mode = 'comp'; comp.shown = { value: S.vars.Ans, how: 'norm', label: comp.toks.join('') }; return; } return startRun(run.prog, run.from); }
      if (id === 'EXIT' || id === 'AC') { if (run.from === 'comp') { mode = 'comp'; comp.shown = { value: S.vars.Ans, how: 'norm', label: comp.toks.join('') }; } else openProgList('RUN', run.prog.name); run = null; return; }
      return;
    }
    if (id === 'AC') { run.stopped = true; run.done = true; run.wait = null; io.print('Break'); save(); return; }
    const w = run.wait;
    if (!w) { lastKeyCode = k.code || 0; return; } // 実行中：Getkey 用に記録するだけ
    if (w.type === 'pause') { if (id === 'EXE') { run.wait = null; pump(); } return; }
    // 入力待ち
    if (id === 'EXE') {
      const text = run.inToks.join('');
      if (!text && !w.keep) return;
      try { if (text) E.evaluate(text, ctxComp()); } catch (e) { toast(e.message); return; }
      run.wait = null;
      run.grid.row = Math.min(run.inRow + 1, 4);
      if (text) { run.grid.rows[run.inRow] = Array(16).fill(' '); const ch = Array.from(text).slice(-16); ch.forEach((c, j) => { run.grid.rows[run.inRow][j] = c; }); }
      pump(text);
      return;
    }
    if (id === 'EXIT') { run.stopped = true; run.done = true; run.wait = null; io.print('Break'); return; }
    if (id === 'DEL') { if (run.inCur > 0) { run.inToks.splice(run.inCur - 1, 1); run.inCur--; } return; }
    if (id === 'LEFT' || id === 'RIGHT') { run.inCur = Math.max(0, Math.min(run.inToks.length, run.inCur + (id === 'LEFT' ? -1 : 1))); return; }
    const s = shift ? k.sins : k.ins;
    if (s) { run.inToks.splice(run.inCur, 0, s); run.inCur++; }
  }

  // ---- キーが押されたとき -----------------------------------------------
  function press(id) {
    const k = KEYS[id];
    if (!k) return;
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch { /* 無視 */ } }
    // 実行中（入力待ち・一時停止以外）は Getkey 用にコードを覚えるだけ
    if (mode === 'run' && run && !run.done && !run.wait && id !== 'AC') { lastKeyCode = k.code || 0; return; }
    if (id === 'SHIFT') { if (shift && false) { /* noop */ } shift = !shift; render(); return; }
    if (id === 'ALPHA') {
      if (shift) { alock = !alock; alpha = false; shift = false; }
      else if (alock) { alock = false; alpha = false; }
      else alpha = !alpha;
      render(); return;
    }
    const wasShift = shift, wasAlpha = alpha || alock;
    // STO・RCL の後の文字キー
    if (pending) {
      const ch = alphaChar(k) || (k.id === 'DEL' ? null : null);
      const p = pending; pending = null; shift = false; alpha = false;
      if (ch && /^[A-Z]$/.test(ch)) { if (mode !== 'comp') mode = 'comp'; if (p === 'STO') compStore(ch); else compRecall(ch); }
      render(); return;
    }
    try {
      handle(k, wasShift, wasAlpha);
    } catch (e) { console.error(e); toast('内部エラー：' + e.message); }
    if (id !== 'SHIFT') shift = false;
    if (!alock) alpha = false;
    render();
    if (mode === 'edit') { const ta = $('editor'); if (document.activeElement !== ta) ta.focus({ preventScroll: true }); }
  }
  function handle(k, wasShift, wasAlpha) {
    const id = k.id;
    // ALPHA で文字を入れる
    if (wasAlpha && alphaChar(k) && !['name', 'menu', 'confirm'].includes(mode)) {
      if (mode === 'run' && !(run && run.wait && run.wait.type === 'input')) return;
      return insertText(alphaChar(k));
    }
    if (id === 'MODE') { if (mode === 'edit') closeEditorSilently(); if (mode === 'run' && run) { run.stopped = true; } return wasShift ? openSetup() : openMode(); }
    if (id === 'FUNC') {
      if (['comp', 'edit', 'calc', 'solve'].includes(mode) || (mode === 'fmla' && fm.phase === 'input') || (mode === 'run' && run && run.wait && run.wait.type === 'input')) return openFunction();
      return;
    }
    if (id === 'FILE' && !wasShift && !['edit', 'name'].includes(mode)) { if (mode === 'run' && run) run.stopped = true; return openProgList('RUN'); }
    if (id === 'FMLA' && !['edit', 'name', 'run'].includes(mode)) return openFmlaList();
    if (id === 'RCL' && mode === 'comp') { pending = wasShift ? 'STO' : 'RCL'; return; }
    if (id === 'RCL' && wasShift && (mode === 'calc' || mode === 'solve')) return;
    switch (mode) {
      case 'comp': return compKey(k);
      case 'error': return errorKey(k);
      case 'menu': return menuKey(k);
      case 'calc': return substKey(calc, k, false);
      case 'solve': return substKey(solve, k, true);
      case 'fmla': return fmlaKey(k);
      case 'name': return nameKey(k);
      case 'edit': return editKey(k);
      case 'run': return runKey(k);
      case 'confirm': return confirmKey(k);
    }
  }
  function closeEditorSilently() { editChanged(); edit = null; $('editor').blur(); }

  // ---- ファイルの読み書き -------------------------------------------------
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name.replace(/[<>:"/\\|?*]/g, '_');
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  // CcEditor の txt と同じく UTF-8（BOM付き）・改行 CRLF で書き出す
  function exportProgram(p) { download(p.name + '.txt', '﻿' + p.source.replace(/\r?\n/g, '\r\n')); }
  function backupAll() { download('fx5800p-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ app: 'fx5800p-emu', version: VERSION, data: S }, null, 1), 'application/json'); toast('バックアップを書き出しました'); }
  let filePurpose = 'prog';
  function pickFile(purpose) {
    filePurpose = purpose;
    const f = $('fileIn');
    f.multiple = purpose === 'prog';
    f.accept = purpose === 'prog' ? '.txt,.bas,.ccl,.cce,text/plain' : '.json,application/json';
    f.value = ''; f.click();
  }
  async function readText(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
    catch { return new TextDecoder('shift_jis').decode(buf); }
  }
  async function onFiles(files) {
    if (!files.length) return;
    if (filePurpose === 'backup') {
      try {
        const d = JSON.parse(await readText(files[0]));
        if (!d || d.app !== 'fx5800p-emu' || !d.data) throw Error('この電卓のバックアップではありません');
        askConfirm('今のデータを置き換えますか（' + (d.data.programs || []).length + '本）', () => {
          S = Object.assign(S, d.data); S.vars = Object.assign(blankVars(), d.data.vars || {});
          save(); toast('復元しました'); openProgMenu(); render();
        }, openProgMenu);
        render();
      } catch (e) { toast(e.message); }
      return;
    }
    let got = [];
    const bad = [];
    for (const f of files) {
      if (f.size > 200000) { toast(f.name + ' は大きすぎます'); continue; }
      try {
        // .ccl（電卓から吸い出したファイル）・.cce（CcEditor）は中身を変換して読む
        const dec = await FxImport.decodeFile(f);
        if (dec) {
          got.push({ name: dec.name, mode: dec.mode, source: dec.source, time: f.lastModified, ccl: /\.ccl$/i.test(f.name) });
          if (dec.unknown) bad.push(dec.name + '（読めない記号 ' + dec.unknown + '）');
          continue;
        }
        const name = f.name.replace(/\.[^.]+$/, '').replace(/\s+(COMP|BASE-N|FORMULA)(\s+[0-9A-F]+)?$/i, '').trim();
        got.push({ name, mode: 'COMP', source: (await readText(f)).replace(/\r\n?/g, '\n').replace(/\n+$/, ''), time: f.lastModified });
      } catch (e) { bad.push(f.name + '：' + e.message); }
    }
    // 同じ名前が複数あれば、更新日時の新しい方（同じなら .ccl）を使う
    const pick = new Map();
    for (const g of got) {
      const o = pick.get(g.name);
      if (!o || g.time > o.time || (g.time === o.time && g.ccl && !o.ccl)) pick.set(g.name, g);
    }
    got = [...pick.values()].map(g => ({ name: g.name, mode: g.mode, source: g.source }));
    if (bad.length) toast('注意：' + bad.join('、'), 7000);
    const dup = got.filter(g => S.programs.some(p => p.name === g.name));
    const apply = overwrite => {
      let n = 0;
      for (const g of got) {
        const i = S.programs.findIndex(p => p.name === g.name);
        if (i >= 0) { if (!overwrite) continue; S.programs[i] = g; } else S.programs.push(g);
        n++;
      }
      save(); toast(n + ' 本を読み込みました'); openProgList('RUN'); render();
    };
    if (dup.length) { askConfirm('同じ名前 ' + dup.length + ' 本を上書きしますか（No＝新しい分だけ）', () => apply(true), () => apply(false)); render(); }
    else apply(false);
  }

  // ---- 画面部品 ---------------------------------------------------------
  let toastTimer;
  function toast(t, ms) { const n = $('toast'); n.textContent = t; n.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => n.classList.remove('show'), ms || 3000); }
  function keyHtml(k) {
    return '<button type="button" class="key ' + k.cls + '" data-k="' + k.id + '" aria-label="' + esc(k.label) + '">' +
      '<span class="sub"><i class="sl">' + esc(k.sl || '') + '</i><i class="al">' + esc(k.al || '') + '</i></span>' +
      '<span class="main">' + esc(k.label) + '</span></button>';
  }
  function buildKeys() {
    $('fkeys').innerHTML = ROWS.map(r => r.map(k => keyHtml(KEYS[k[0]])).join('')).join('');
    $('nkeys').innerHTML = NROWS.map(r => r.map(k => keyHtml(KEYS[k[0]])).join('')).join('');
    const bind = el => {
      el.addEventListener('pointerdown', e => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        e.preventDefault();
        b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 120);
        press(b.dataset.k);
      });
    };
    document.querySelectorAll('.keypad, .top').forEach(bind);
  }
  function fitLcd() {
    const scr = $('lcd');
    const w = scr.clientWidth - 16;
    // 16桁がちょうど入る文字の大きさ（等幅の文字幅は約0.6em）
    const probe = document.createElement('span'); probe.className = 'probe'; probe.textContent = '0000000000';
    scr.append(probe);
    const cw = probe.getBoundingClientRect().width / 10 / parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    const fs = Math.min(30, w / 16 / (cw || 0.6));
    document.documentElement.style.setProperty('--lcd-fs', fs.toFixed(2) + 'px');
  }
  function physicalKeys() {
    const map = { Enter: 'EXE', Backspace: 'DEL', Escape: 'AC', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN', '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV', '(': 'LP', ')': 'RP', ',': 'COMMA', '.': 'DOT', '^': 'POW' };
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.activeElement === $('editor') || document.activeElement === $('kbd')) {
        if (e.key === 'Escape') { e.preventDefault(); press('EXIT'); }
        return;
      }
      let id = map[e.key];
      if (!id && /^[0-9]$/.test(e.key)) id = e.key;
      if (!id && /^[a-zA-Z]$/.test(e.key)) {
        const L = e.key.toUpperCase();
        if (mode === 'name') { if (Array.from(nameIn.text).length < 12) nameIn.text += L; render(); e.preventDefault(); return; }
        e.preventDefault(); insertText(L); render(); return;
      }
      if (!id && (e.key === '=' || e.key === '?' || e.key === ':' || e.key === '"')) { e.preventDefault(); insertText(e.key); render(); return; }
      if (id) { e.preventDefault(); press(id); }
    });
  }
  // 液晶の行をタップして選ぶ（メニュー・代入画面）
  function lcdTap(e) {
    const ln = e.target.closest('[data-tap]'); if (!ln) return;
    const t = ln.dataset.tap;
    if (mode === 'menu') {
      if (t === 'back') { menuKey({ id: 'EXIT' }); }
      else { const i = Number(t); if (menu.items[i]) { menu.sel = i; menu.items[i].act(); } }
    }
    else if (mode === 'calc' || mode === 'solve') { const st = mode === 'calc' ? calc : solve; if (substCommit(st, mode)) st.idx = Number(t); }
    else if (mode === 'confirm') { confirmKey({ id: t === 'yes' ? 'EXE' : 'EXIT' }); }
    else if (mode === 'name') nameTap(t);
    render();
  }

  function init() {
    load();
    buildKeys();
    // 液晶のタップは「液晶の上で押して液晶の上で離した」ときだけ受ける。
    // （キーを押した直後にメニューが広がり、離した指が液晶の項目に当たって選ばれてしまうのを防ぐ）
    let downOn = null;
    $('lcd').addEventListener('pointerdown', e => { downOn = e.target.closest('[data-tap],[data-ind]'); });
    $('screen').addEventListener('click', e => { const t = e.target.closest('[data-tap]'); if (!t || t !== downOn) return; downOn = null; lcdTap(e); });
    $('ind').addEventListener('click', e => {
      const t = e.target.closest('[data-ind]'); if (!t || t !== downOn) return; downOn = null;
      if (['run', 'edit', 'name'].includes(mode) || pending) return;
      const k = t.dataset.ind;
      if (k === 'angle') openAngleMenu(); else if (k === 'disp') openDispMenu(); else if (k === 'var') { remember(); openVarList(); menu.back = toComp; }
      render();
    });
    $('editor').addEventListener('input', editChanged);
    $('fileIn').addEventListener('change', e => onFiles([...e.target.files]));
    $('kbdBtn').addEventListener('click', () => {
      if (mode === 'edit') {
        const ta = $('editor'), on = ta.inputMode !== 'text';
        ta.inputMode = on ? 'text' : 'none'; $('kbdBtn').classList.toggle('on', on);
        ta.blur(); ta.focus();
      } else if (mode === 'name') {
        const k = $('kbd'); k.value = ''; k.focus();
      } else toast('文字キーボードは プログラム編集・名前入力 で使えます');
    });
    $('kbd').addEventListener('input', e => {
      if (mode !== 'name') return;
      nameIn.text = (nameIn.text + e.target.value.toUpperCase()).slice(0, 12); e.target.value = ''; render();
    });
    $('kbd').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('kbd').blur(); press('EXE'); } else if (e.key === 'Backspace') { e.preventDefault(); press('DEL'); } });
    $('helpBtn').addEventListener('click', () => { $('help').open = true; $('help').scrollIntoView({ behavior: 'smooth' }); });
    $('ver').textContent = 'v' + VERSION;
    physicalKeys();
    fitLcd();
    window.addEventListener('resize', fitLcd);
    render();
    migrateOld();
    // PC エディターで直したプログラムを、開いている電卓にもすぐ反映する
    window.addEventListener('storage', e => {
      if (e.key !== STORE_KEY || !e.newValue) return;
      try { const d = JSON.parse(e.newValue); if (Array.isArray(d.programs)) { S.programs = d.programs; if (mode === 'menu' && /Prog/.test(menu.title)) openProgList(lastListKind); render(); } } catch { /* 無視 */ }
    });
    // エディターの「電卓で実行」（?run=名前）
    const runName = new URLSearchParams(location.search).get('run');
    if (runName) {
      history.replaceState(null, '', location.pathname);
      const p = S.programs.find(x => x.name === runName);
      if (p) { if (p.mode === 'Formula') startFmla(userFormula(p)); else startRun(p, 'list'); render(); }
      else toast('プログラム「' + runName + '」がありません');
    }
    // localhost（開発中の確認）では古いファイルを掴まないようオフライン用キャッシュを使わない
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
    window.__fx = { press, get S() { return S; }, get mode() { return mode; } }; // 動作確認用
  }
  window.addEventListener('DOMContentLoaded', init);
})();
