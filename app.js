// fx-5800P 風 プログラム関数電卓 — 画面と操作
(function () {
  'use strict';
  const E = FxEngine, B = FxBasic, MEM = FxMemory, FORMULAS = FxFormulas;
  const $ = id => document.getElementById(id);
  const LETTERS = E.LETTERS;
  const STORE_KEY = 'fx5800p-emu-v1';
  const VERSION = '1.4.23';

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
    [['CPLX', 'あ', 'i', 'A', 51, null, null, 'k-fn'], ['FRAC', '▭⁄▭', '', 'B', 52, '⌟', null, 'k-fn'], ['DMS', '°′″', '▸DMS', 'C', 53, '°', '▸DMS', 'k-fn'], ['SIN', 'sin', 'sin⁻¹', 'D', 54, 'sin(', 'sin⁻¹(', 'k-fn'], ['COS', 'cos', 'cos⁻¹', 'E', 55, 'cos(', 'cos⁻¹(', 'k-fn'], ['TAN', 'tan', 'tan⁻¹', 'F', 56, 'tan(', 'tan⁻¹(', 'k-fn']],
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
  let mode = 'comp';           // comp / error / menu / calc / solve / fmla / name / edit / run / confirm / curve
  let shift = false, alpha = false, alock = false, pending = null, flick = false; // pending: 'STO' | 'RCL'
  let comp = { toks: [], cur: 0, shown: null, histIdx: -1 };
  let errState = null, menu = null, calc = null, solve = null, fm = null, nameIn = null, edit = null, run = null, confirmSt = null;
  let lastKeyCode = 0;
  const ctxComp = () => ({ vars: S.vars, angle: S.angle, disp: S.disp, getkey: () => 0 });

  // ---- 液晶の描画 ------------------------------------------------------
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function line(text, opt = {}) { return { text: text ?? '', ...opt }; }
  // 液晶の行数（見やすい表示では、ディスプレイを高くすると増える）
  let LCD_ROWS = 4;
  // 液晶の桁数と「見やすい表示」（▦ 配置 → ディスプレイの表示）
  let LCD_COLS = 16, LCD_WIDE = false;
  // 増えた行に出す、直前の計算と答え（新しい順に最大 20 件）
  const scrollback = [];
  function paint(lines) {
    const out = [];
    for (let i = 0; i < LCD_ROWS; i++) {
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
    // 編集中は「◀EXIT」も出す（スマホのキーボードで電卓のキーが隠れていても戻れるように）
    if (mode === 'edit' && edit) ind.unshift('<span class="tapind ed-exit" data-ind="exit" title="保存して Program Menu へ戻る">◀EXIT</span><span class="ed">' + esc(edit.prog.name) + (edit.prog.mode === 'Formula' ? ' FM' : '') + '</span>');
    // 実行中に値を聞かれたとき：その変数の日本語の名前（'変数 の行から）を右側に出す
    if (mode === 'run' && hintName && !(run && run.grid && run.grid.wide)) ind.push('<span class="ihint" title="' + esc(hintName) + '">' + esc(hintName) + '</span>');
    if (extra) ind.push(extra);
    $('ind').innerHTML = ind.join(' ');
  }
  // 式を16桁で折り返し、カーソルを含む行を表示する
  function wrapWithCursor(text, curIdx, maxLines) {
    const W = LCD_COLS;
    const chars = Array.from(text), curChar = Array.from(text.slice(0, curIdx)).length;
    const rows = [];
    for (let i = 0; i <= chars.length; i += W) rows.push(i);
    if (chars.length && chars.length % W === 0 && curChar === chars.length) { /* カーソルは次の行 */ } else if (rows.length > 1 && rows[rows.length - 1] === chars.length) rows.pop();
    const curRow = Math.min(Math.floor(curChar / W), rows.length - 1);
    const first = Math.max(0, curRow - maxLines + 1);
    const lines = [];
    for (let r = first; r < Math.min(rows.length, first + maxLines); r++) {
      const seg = chars.slice(r * W, r * W + W);
      let html = '';
      for (let j = 0; j <= seg.length; j++) {
        const pos = r * W + j;
        if (pos === curChar && curIdx >= 0) html += j < seg.length ? '<span class="cur">' + esc(seg[j]) + '</span>' : '<span class="cur">&nbsp;</span>';
        else if (j < seg.length) html += esc(seg[j]);
      }
      lines.push(line('', { html }));
    }
    return lines;
  }
  const fmtVal = (v, how) => how === 'dms' ? E.formatDMS(v) : how === 'frac' ? (E.toFraction(v) || E.formatNumber(v, S.disp)) : E.formatNumber(v, S.disp);

  function render() {
    // タブの画面の「変数」「履歴」は、計算のたびに描き直す
    queueMicrotask(() => { if (tab === 'var' || tab === 'hist') renderTabs(); });
    if (mode !== 'run') setHint('');
    const kbdBtn = $('kbdBtn');
    kbdBtn.hidden = mode !== 'edit' && !(mode === 'name' && nameIn.step === 'name');
    if (!kbdBtn.hidden) kbdBtn.textContent = mode === 'name' ? '名前をキーボードで入力'
      : $('editor').inputMode === 'text' ? 'キーボードを閉じる' : 'キーボードで編集';
    const resultBtn = $('resultBtn');
    if (resultBtn) resultBtn.hidden = !currentResult();
    const lcd = $('lcd');
    lcd.classList.toggle('editing', mode === 'edit');
    document.querySelector('.calc').classList.toggle('menu-open', mode === 'menu' || mode === 'curve');
    document.querySelector('.calc').classList.toggle('curve-open', mode === 'curve');
    if (window.FxLayout && FxLayout.setMenu) FxLayout.setMenu(mode === 'menu' || mode === 'curve');
    updateKeyFaces();
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
    if (mode === 'curve') return FxCurveApp.render($('screen'));
    if (mode === 'edit') return indicators();
  }

  // ---- COMP（通常計算） ------------------------------------------------
  const compText = () => comp.toks.join('');
  function currentResult() {
    if (mode === 'run' && run?.results.length) {
      const lines = [];
      run.results.forEach(({ text, value }, i) => {
        if (value && i > 0 && !run.results[i - 1].value) lines[lines.length - 1] += '  ' + text;
        else lines.push(text);
      });
      return [run.prog.name, ...lines].join('\n');
    }
    if (mode === 'comp' && comp.shown) {
      const r = comp.shown;
      const values = r.pair ? [
        r.pair.a[0] + ' = ' + E.formatNumber(r.pair.a[1], S.disp),
        r.pair.b[0] + ' = ' + fmtVal(r.pair.b[1], r.pair.angleB && r.how === 'dms' ? 'dms' : 'norm')
      ] : [r.text ?? fmtVal(r.value, r.how)];
      return [r.label ?? compText(), ...values].filter(Boolean).join('\n');
    }
    if (mode === 'calc' && calc.phase === 'result') {
      return [calc.text, (calc.resultVar ? calc.resultVar + ' = ' : '') + fmtVal(calc.result.value, calc.result.how)].join('\n');
    }
    if (mode === 'solve' && solve.phase === 'result') {
      const name = solve.vars[solve.idx];
      return [solve.text, name + ' = ' + E.formatNumber(S.vars[name], S.disp),
        'L-R = ' + E.formatNumber(solve.result.res, S.disp)].join('\n');
    }
    if (mode === 'fmla' && fm.phase === 'out' && fm.outs.length) {
      return [fm.f.name, ...fm.outs.map(o => o.name + ' = ' + fmtVal(o.value, o.how))].join('\n');
    }
    return '';
  }

  function openResult() {
    const text = currentResult();
    if (!text) return;
    const D = FxDialog, h = D.h;
    const field = h('textarea', { class: 'result-text', readonly: true, 'aria-label': '計算結果のテキスト' });
    field.value = text;
    field.rows = Math.min(12, Math.max(3, text.split('\n').length));
    const status = h('p', { class: 'result-status', role: 'status', hidden: true });
    const say = message => { status.hidden = false; status.textContent = message; };
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(text);
        say('計算結果をコピーしました。');
      } catch {
        field.focus();
        field.select();
        field.setSelectionRange(0, field.value.length);
        say('選択したテキストを端末の「コピー」でコピーできます。');
      }
      return false;
    };
    const share = async () => {
      try {
        await navigator.share({ text });
      } catch (error) {
        if (error.name !== 'AbortError') say('共有を開けませんでした。「コピー」で結果を渡せます。');
      }
      return false;
    };
    const buttons = [{ label: '閉じる' }, { label: 'コピー', kind: 'primary', onClick: copy }];
    if (navigator.share) buttons.splice(1, 0, { label: '共有', onClick: share });
    D.open({ title: '計算結果', width: 480, body: [field, status], buttons });
  }
  function renderComp() {
    const text = compText();
    const curIdx = comp.shown ? -1 : comp.toks.slice(0, comp.cur).join('').length;
    const r = comp.shown;
    // 行が 4 より多いときは、上に直前の計算と答えを出す（今の計算は下の 4 行）
    const extra = Math.max(0, LCD_ROWS - 4);
    const older = () => {
      if (!extra) return [];
      const past = scrollback.filter(x => x.obj !== r).slice(0, Math.ceil(extra / 2)).reverse();
      const ls = [];
      for (const x of past) ls.push(line(Array.from(x.label).slice(0, LCD_COLS).join(''), { small: false }), line(x.value, { right: true }));
      while (ls.length < extra) ls.unshift(line(''));
      return ls.slice(-extra);
    };
    if (!r) { paint(older().concat(wrapWithCursor(text, curIdx, 4))); return; }
    const lines = wrapWithCursor(r.label ?? text, -1, r.pair ? 2 : 3);
    while (lines.length < (r.pair ? 2 : 3)) lines.push(line(''));
    if (r.pair) {
      lines.push(line(r.pair.a[0] + '=' + E.formatNumber(r.pair.a[1], S.disp)), line(r.pair.b[0] + '=' + (r.pair.angleB && r.how === 'dms' ? E.formatDMS(r.pair.b[1]) : E.formatNumber(r.pair.b[1], S.disp))));
    } else lines.push(line(r.text ?? fmtVal(r.value, r.how), { right: true }));
    if (!scrollback.length || scrollback[0].obj !== r) {
      scrollback.unshift({ obj: r, label: String(r.label ?? text), value: r.pair ? r.pair.a[0] + '=' + E.formatNumber(r.pair.a[1], S.disp) : (r.text ?? fmtVal(r.value, r.how)) });
      scrollback.length = Math.min(scrollback.length, 20);
    }
    paint(older().concat(lines));
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
    if (m.view) {
      // 説明を見る画面
      $('screen').innerHTML = '<div class="menu-head"><button type="button" class="mback" data-tap="back">◀ 戻る</button><b>' + esc(m.view.title) + '</b></div>'
        + '<div class="menu-help">' + esc(m.view.text) + '</div>';
      indicators(); return;
    }
    const hasDesc = m.items.some(it => it.desc || it.help || it.title);
    const showDesc = hasDesc && S.showDesc !== false;
    const short = !showDesc && m.items.length > 6 && m.items.every(it => Array.from(it.label).length <= 9 && !it.head);
    // it.head：その項目の前に出す見出し（アプリ版／電卓実機併用 の区切り）
    const items = m.items.map((it, i) => (it.head ? '<div class="mgroup' + (it.headClass ? ' ' + it.headClass : '') + '"><b>' + esc(it.head) + '</b>'
      + (it.headNote ? '<span>' + esc(it.headNote) + '</span>' : '') + '</div>' : '') +
      '<div class="mrow' + (showDesc ? ' desc' : '') + '"><button type="button" class="mi' + (i === m.sel ? ' sel' : '') + '" data-tap="' + i + '">' +
      (m.numbered && i < 9 ? '<span class="no">' + (i + 1) + '</span>' : '') + '<span class="lbw">'
      + (showDesc && it.title ? '<span class="tt">' + esc(it.title) + '</span><span class="lb sub">' + esc(it.label) + '</span>' : '<span class="lb">' + esc(it.label) + '</span>')
      + (showDesc && it.desc ? '<span class="ds">' + esc(it.desc) + '</span>' : '') + '</span></button>'
      + (showDesc && it.help ? '<button type="button" class="mhelp" data-tap="h' + i + '" aria-label="' + esc(it.label) + ' の解説">？</button>' : '') + '</div>').join('');
    $('screen').innerHTML =
      '<div class="menu-head"><button type="button" class="mback" data-tap="back">◀ 戻る</button><b>' + esc(m.title) + '</b>'
      + (hasDesc ? '<button type="button" class="mdesc' + (showDesc ? ' on' : '') + '" data-tap="desc" title="説明を出す・隠す">説明 ' + (showDesc ? '表示' : '隠す') + '</button>' : '')
      + '<span class="mcount">' + m.items.length + '件</span></div>' +
      '<div class="menu-list' + (short ? ' grid' : '') + '">' + (items || '<div class="empty">（なし）</div>') + '</div>';
    const sel = $('screen').querySelector('.mi.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
    indicators();
  }
  function menuKey(k) {
    const m = menu, id = k.id;
    if (m.view) { if (['EXIT', 'AC', 'EXE'].includes(id)) m.view = null; return; }
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
  // FUNCTION の説明：[何をするか（一覧に出す 1 行）, 使い方と例（？で開く）]
  const FN_HELP = {
    // 数学
    'Abs(': ['絶対値（マイナスを取る）', 'Abs(数)\n例：Abs(-3.5) → 3.5\n使いどころ：ずれの大きさだけを出すとき（Abs(N)）'],
    'Int(': ['整数部分（0 の方へ切り捨て）', 'Int(数)\n例：Int(2.7) → 2、Int(-2.7) → -2'],
    'Intg(': ['その数を超えない最大の整数', 'Intg(数)\n例：Intg(2.7) → 2、Intg(-2.7) → -3（Int と負の数で違う）'],
    'Frac(': ['小数部分', 'Frac(数)\n例：Frac(12.345) → 0.345'],
    'Rnd(': ['表示の桁（Fix・Sci）で丸めた値', 'Rnd(数)\n例：Fix 3 のとき Rnd(1.23456) → 1.235\n使いどころ：画面と同じ値で次の計算をしたいとき'],
    'x⁻¹': ['逆数（1÷x）', '数⁻¹\n例：4⁻¹ → 0.25'],
    'x!': ['階乗', '整数!\n例：5! → 120'],
    'x³': ['3 乗', '数³\n例：2³ → 8'],
    '∛(': ['立方根', '∛(数)\n例：∛(27) → 3'],
    'ˣ√(': ['x 乗根', 'x ˣ√(数)\n例：4ˣ√(81) → 3'],
    'nPr': ['順列（n 個から r 個を並べる数）', 'nℙr\n例：5ℙ2 → 20'],
    'nCr': ['組合せ（n 個から r 個を選ぶ数）', 'nℂr\n例：5ℂ2 → 10'],
    'Ran#': ['0 以上 1 未満の乱数', 'Ran#\n例：Ran# → 0.734 など（毎回変わる）'],
    'RanInt#(': ['整数の乱数', 'RanInt#(最小,最大)\n例：RanInt#(1,6) → 1〜6 のどれか'],
    'Pol(': ['直交座標 → 距離と角度（I・J に入る）', 'Pol(X の差,Y の差)\nI＝距離、J＝方向角（−180〜180°）\n例：Pol(3,4) → I＝5、J＝53.13…\n測量：Pol(X2-X1,Y2-Y1) で 2 点間の距離と方向角\n注意：I と J は書き換わる'],
    'Rec(': ['距離と角度 → 直交座標（I・J に入る）', 'Rec(距離,角度)\nI＝X の差、J＝Y の差\n例：Rec(10,45) → I＝7.071、J＝7.071\n測量：Rec(L,H+J) で観測から座標の差\n注意：I と J は書き換わる'],
    'GCD(': ['最大公約数', 'GCD(整数,整数)\n例：GCD(12,18) → 6'],
    'LCM(': ['最小公倍数', 'LCM(整数,整数)\n例：LCM(4,6) → 12'],
    '%': ['百分率（÷100）', '数%\n例：200×5% → 10'],
    'π': ['円周率', 'π ＝ 3.14159…\n例：2πR で円周、R×IA×π÷180 で曲線長'],
    'e': ['自然対数の底', 'e ＝ 2.71828…'],
    'sinh(': ['双曲線正弦', 'sinh(数)'], 'cosh(': ['双曲線余弦', 'cosh(数)'], 'tanh(': ['双曲線正接', 'tanh(数)'],
    'sinh⁻¹(': ['sinh の逆関数', 'sinh⁻¹(数)'], 'cosh⁻¹(': ['cosh の逆関数', 'cosh⁻¹(数)'], 'tanh⁻¹(': ['tanh の逆関数', 'tanh⁻¹(数)'],
    'log(a,b)': ['a を底とする b の対数', 'log(底,数)\n例：log(2,8) → 3'],
    // 命令
    '?': ['値を入れてもらう（入力）', '"表示"?→変数\n例："KYORI"?→L（KYORI? と出て、打った値が L に入る）\n"BX"?A のように → を付けないと、今の値が出ていて EXE だけで前のままにできる'],
    '→': ['値を変数に入れる（代入）', '式→変数\n例：A+B→C、0→Z[1]'],
    '◢': ['答えを表示して止まる（EXE で続く）', '式◢\n例："X=":X◢（X= と値を出して止まる）'],
    ':': ['文の区切り（1 行に何文も書ける）', '文:文\n例：1→A:2→B'],
    '"': ['文字を表示する（文字列）', '"文字"\n例："MIGI"（MIGI と表示）、"HA":K◢'],
    '⇒': ['条件が成り立つときだけ次の 1 文をする', '条件⇒文\n例：K=0⇒Prog "SUB2"（K が 0 なら SUB2 を呼ぶ）'],
    '=': ['等しい（比べる）', '例：If A=0:Then …'], '≠': ['等しくない', '例：A≠0⇒…'],
    '>': ['より大きい', '例：If N>0:Then "MIGI"'], '≥': ['以上', '例：If T≥0:Then …'],
    '<': ['より小さい', '例：If N<0:Then "HIDARI"'], '≤': ['以下', '例：T≤L⇒…'],
    'If': ['もし…なら（If・Then・Else・IfEnd）', 'If 条件:Then 成り立つとき:Else 成り立たないとき:IfEnd\n例：If N<0:Then "HIDARI":Else "MIGI":IfEnd'],
    'Then': ['If が成り立つときにすること', 'If の説明を見てください'], 'Else': ['If が成り立たないときにすること', 'If の説明を見てください'], 'IfEnd': ['If の終わり', 'If の説明を見てください'],
    'For →I To': ['回数を決めて繰り返す（For・To・Step・Next）', 'For 始め→変数 To 終わり Step 増やし方 … Next\n例：For 1→K To N … Next（K を 1 から N まで）\nStep を省くと 1 ずつ'],
    'To': ['For の終わりの値', 'For の説明を見てください'], 'Step': ['For の増やし方', '例：For 0→I To 10 Step 2'], 'Next': ['For の繰り返しの終わり', 'For の説明を見てください'],
    'While': ['条件の間くり返す（初めに調べる）', 'While 条件 … WhileEnd\n例：While A<10:A+1→A:WhileEnd'], 'WhileEnd': ['While の終わり', 'While の説明を見てください'],
    'Do': ['くり返す（終わりで調べる）', 'Do … LpWhile 条件\n例：Do:"A"?→A:LpWhile A<0（0 以上が入るまで聞き直す）'], 'LpWhile': ['Do の終わり（条件の間もどる）', 'Do の説明を見てください'],
    'Lbl': ['飛び先の目印（0〜9・A〜Z）', 'Lbl 1 … Goto 1\n例：Lbl 1:"PX"?→X:…:Goto 1（測点を何度も入れる）'], 'Goto': ['Lbl へ飛ぶ', 'Lbl の説明を見てください'],
    'Prog "': ['ほかのプログラム（SUB）を呼ぶ', 'Prog "名前"\n例：Prog "SUB1"（SUB1 を動かして、終わったら戻る）\n同じ計算を SUB にまとめると、バイト数を節約できる'],
    'Return': ['SUB から呼んだ元へ戻る', 'SUB の途中で戻りたいときに使う'], 'Stop': ['プログラムを終わる', '例：If Q>9:Then "ERR":Stop:IfEnd'], 'Break': ['For・While・Do のくり返しをぬける', '例：If A=0:Then Break:IfEnd'],
    'Isz': ['変数を 1 増やし、0 になったら次の文をとばす', 'Isz 変数\n例：Isz A:Goto 1'], 'Dsz': ['変数を 1 減らし、0 になったら次の文をとばす', 'Dsz 変数\n例：Dsz N:Goto 1（N 回くり返す）'],
    'Locate': ['画面の決まった場所に表示', 'Locate 桁,行,値\n桁 1〜16、行 1〜4\n例：Locate 1,1,"X=":Locate 4,1,X'],
    'Cls': ['画面を消す', 'Cls'], 'Getkey': ['押しているキーの番号', 'Getkey → キーの番号（押していなければ 0）\n例：Do:LpWhile Getkey=0（キーを押すまで待つ）'],
    'And': ['かつ（両方成り立つ）', '例：If T≥0 And T≤L:Then …'], 'Or': ['または', '例：If A<0 Or A>9:Then …'], 'Xor': ['どちらか一方だけ', '例：A Xor B'], 'Not(': ['成り立たない', '例：Not(A=0)'],
    'Z[': ['拡張変数（Z の先の変数）', 'Z[番号]\n先に DimZ で数を決める。例：20→DimZ:5→Z[1]\n座標や線形のように数の多い値をしまうのに使う'], ']': ['Z[ の閉じかっこ', 'Z[ の説明を見てください'],
    'DimZ': ['拡張変数 Z[ ] の数を決める', '数→DimZ\n例：50→DimZ（Z[1]〜Z[50] が使える）\nDimZ だけを書くと今の数'],
    'ClrMemory': ['変数を全部 0 にする', 'ClrMemory\n注意：ほかのプログラムが使っている値も消える'],
    // 角度
    '°': ['度分秒で入れる', '度°分°秒°\n例：45°30°15°（45 度 30 分 15 秒）'],
    '▸DMS': ['答えを度分秒で表示', '値▸DMS\n例：45.5041▸DMS → 45°30′15″'],
    'Deg': ['角度の単位を度にする', 'Deg（プログラムの初めに書くとよい）'], 'Rad': ['角度の単位をラジアンにする', 'Rad'], 'Gra': ['角度の単位をグラードにする', 'Gra'],
    // 表示
    'Fix': ['小数点以下の桁数を決める', 'Fix 桁\n例：Fix 3（1.235 のように 3 桁）'],
    'Sci': ['有効数字の桁数を決める', 'Sci 桁\n例：Sci 4（1.235×10² のように）'],
    'Norm': ['ふつうの表示に戻す', 'Norm 1 か Norm 2\nNorm 2 は小さい数も小数で出す']
  };
  function openFunction() {
    const ins = s => { mode = menuBackMode; insertText(s); };
    const menuBackMode = mode === 'menu' ? 'comp' : mode;
    const back = () => { mode = menuBackMode; };
    openMenu('FUNCTION', FN_GROUPS.map(([g, list]) => ({
      label: g, act: () => openMenu(g, list.map(x => {
        const [lab, val] = x.includes('|') ? x.split('|') : [x, x];
        const name = lab.trim() || lab, h = FN_HELP[name] || [];
        return { label: name, desc: h[0], help: h[1] ? name + '\n' + h[0] + '\n\n' + h[1] : '', act: () => ins(val) };
      }), { back: () => openFunction() })
    })), { back });
  }
  // 説明を見る画面（メニューの上に出す。EXE・EXIT・戻るで閉じる）
  function openHelpView(title, text) { menu.view = { title, text }; }

  // ---- タブの画面（自由配置のとき：関数・プログラム・変数・履歴） ----------
  let tab = 'fn';
  function tabsVisible() { const el = document.querySelector('.blk-tabs'); return el && !el.hidden; }
  function renderTabs() {
    if (!tabsVisible()) return;
    const body = $('tabsBody'); if (!body) return;
    document.querySelectorAll('.tabs-head [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const showDesc = S.showDesc !== false;
    let html = '';
    if (tab === 'fn') {
      for (const [g, list] of FN_GROUPS) {
        html += '<div class="tb-h">' + esc(g) + '</div><div class="tb-grid">';
        list.forEach((x, i) => {
          const [lab, val] = x.includes('|') ? x.split('|') : [x, x];
          const name = lab.trim() || lab, hh = FN_HELP[name] || [];
          html += '<button type="button" class="tb-it" data-ins="' + esc(val) + '" title="' + esc((hh[0] || '') + (hh[1] ? '\n' + hh[1] : '')) + '"><b>' + esc(name) + '</b>' + (showDesc && hh[0] ? '<small>' + esc(hh[0]) + '</small>' : '') + '</button>';
        });
        html += '</div>';
      }
    } else if (tab === 'prog') {
      const list = sortedPrograms();
      if (!list.length) html = '<div class="tb-empty">プログラムがありません</div>';
      for (const p of list) {
        const md = B.meta(p.source), hasHelp = md.help || md.usage.length || Object.keys(md.vars).length;
        html += '<div class="tb-row"><span class="nm">' + (md.title ? '<span class="ttl">' + esc(md.title) + '</span>' : '') + esc(p.name) + '</span><span class="ds">' + esc(md.summary || p.title || '') + '</span><span style="margin-left:auto;display:flex;gap:4px">'
          + (hasHelp ? '<button type="button" data-phelp="' + esc(p.name) + '">？</button>' : '')
          + '<button type="button" data-run="' + esc(p.name) + '">▶ 実行</button></span></div>';
      }
    } else if (tab === 'var') {
      const vs = ['Ans'].concat(LETTERS.split ? LETTERS.split('') : Array.from(LETTERS));
      // 最後に動かしたプログラムの '変数 の名前を出す
      const lp = S.programs.find(x => x.name === S.lastProg), names = lp ? B.meta(lp.source).vars : {};
      if (lp && Object.keys(names).length) html += '<div class="tb-h">変数の名前：' + esc(B.meta(lp.source).title || lp.name) + '</div>';
      for (const v of vs) html += '<div class="tb-row" data-ins="' + v + '" style="cursor:pointer"><span class="nm">' + v + '</span><span class="ds">' + esc(names[v] || '') + '</span><span class="vl">' + esc(E.formatNumber(S.vars[v] || 0, S.disp)) + '</span></div>';
      html += '<div class="tb-row"><span class="nm">Z[ ]</span><span class="vl">' + (S.vars.__dim || 0) + ' 個</span></div>';
    } else if (tab === 'hist') {
      if (!S.history.length) html = '<div class="tb-empty">まだ計算の履歴がありません</div>';
      S.history.forEach((t, i) => { html += '<div class="tb-row" data-hist="' + i + '" style="cursor:pointer"><span class="nm">' + esc(t.join('')) + '</span></div>'; });
    }
    body.innerHTML = html;
  }
  function bindTabs() {
    document.querySelectorAll('.tabs-head [data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; renderTabs(); }));
    $('tabsBody').addEventListener('click', e => {
      const ins = e.target.closest('[data-ins]'), run1 = e.target.closest('[data-run]'), ph = e.target.closest('[data-phelp]'), hi = e.target.closest('[data-hist]');
      if (ins) {
        if (mode === 'menu') mode = 'comp';
        insertText(ins.dataset.ins);
      } else if (run1) {
        const p = S.programs.find(x => x.name === run1.dataset.run); if (!p) return;
        if (p.mode === 'Formula') startFmla(userFormula(p)); else startRun(p, 'list');
      } else if (ph) {
        const p = S.programs.find(x => x.name === ph.dataset.phelp); if (!p) return;
        const md = B.meta(p.source), txt = B.helpText(p.name, p.source);
        openMenu('プログラム', [{ label: p.name, title: md.title, desc: md.summary, help: txt, act: () => {} }], { back: () => { mode = 'comp'; } });
        openHelpView(md.title || p.name, txt);
      } else if (hi) {
        mode = 'comp'; comp.toks = S.history[Number(hi.dataset.hist)].slice(); comp.cur = comp.toks.length; comp.shown = null;
      } else return;
      render();
    });
  }
  // 入力中の場所へ文字を入れる（COMP・代入画面・名前・エディタ・プログラム入力）
  function insertText(s) {
    if (mode === 'comp') return compInsert(s);
    if (mode === 'edit') return editInsert(s);
    if (mode === 'calc' || mode === 'solve') return substInsert(mode === 'calc' ? calc : solve, s);
    if (mode === 'fmla' && fm.phase === 'input') return substInsert(fm, s);
    if (mode === 'run' && run && run.wait && run.wait.type === 'input') {
      if (!run.dms) { run.inToks.splice(run.inCur, 0, s); run.inCur++; }
      return;
    }
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
      { label: 'VAR 変数一覧', act: openVarList },
      { label: 'GENBA 測設・現場の座標', act: () => { mode = 'comp'; location.href = 'genba.html'; } }
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
    openMenu('SETUP 設定', [
      ...angleItems(),
      ...dispItems(self),
      { label: 'ClrMemory 変数を0に', act: () => askConfirm('A〜Z・Z[ ]・M を0にしますか', () => { const keep = S.vars.Ans; S.vars = blankVars(); S.vars.Ans = keep; save(); toComp(); toast('変数をクリアしました'); }, self) },
      { label: '配置', act: () => { toComp(); FxLayout.openSettings(); } },
      { label: '使い方（別タブ）', act: () => window.open('help.html', '_blank', 'noopener') }
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
      { label: 'NEW 新規作成' + (bigScreen() ? '（エディター）' : ''), act: () => bigScreen() ? openPcEditor('new=1') : startNew() },
      { label: 'RUN 実行', act: () => openProgList('RUN') },
      { label: 'EDIT 編集', act: () => openProgList('EDIT') },
      { label: 'DELETE 削除', act: () => openProgList('DELETE') },
      { label: 'IMPORT 読込 txt/ccl/cce', act: () => pickFile('prog') },
      { label: 'EXPORT txt書出', act: () => openProgList('EXPORT') },
      { label: 'CCL 電卓用に書出', act: () => openProgList('CCL') },
      { label: 'INFO 手持ちに説明を付ける', act: () => {
        // KAIHOU・SUB1・SUB2・KYOKUSEN・実機用の一式に、日本語の名前・使い方・変数の名前を付ける（中身が元と同じときだけ）。説明の .txt ごと取り込んだものは本文だけに直す
        if (!window.FxProgInfo) { toast('説明の部品を読めませんでした'); return; }
        const r = FxProgInfo.addToKnown(S.programs);
        if (r.done.length || r.fixed.length) save();
        toast(FxProgInfo.report(r), 9000);
        openProgList('RUN');
      } },
      { label: 'APP アプリ版プログラム', act: () => openProgList('RUN', APP_PROGRAMS[0].key) },
      { label: 'BACKUP 全保存', act: backupAll },
      { label: 'RESTORE 全復元', act: () => pickFile('backup') }
    ], { back: () => { mode = 'comp'; } });
  }
  const sortedPrograms = () => S.programs.slice().sort((a, b) => a.name.localeCompare(b.name, 'en'));
  function openProgList(kind, selName) {
    const list = sortedPrograms();
    const title = { RUN: 'Prog List 実行', EDIT: 'Prog Edit 編集', DELETE: 'Delete 削除', EXPORT: 'Export 書出', CCL: 'CCL 電卓用（.ccl）' }[kind];
    const items = list.map(p => ({
      label: p.name + (p.mode === 'Formula' ? ' ·FM' : ''), key: p.name,
      // プログラムの中の '説明 と '解説 の行（アプリだけが読む）
      // '名前（日本語の名前）・'説明・'使い方・'変数・'解説 の行（アプリだけが読む）
      ...(md => ({ title: md.title, desc: md.summary || p.title || '', help: (md.summary || md.help || md.usage.length || Object.keys(md.vars).length) ? B.helpText(p.name, p.source) : '' }))(B.meta(p.source)),
      act: () => {
        if (kind === 'RUN') { if (p.mode === 'Formula') startFmla(userFormula(p)); else startRun(p, 'list'); }
        else if (kind === 'EDIT') { if (bigScreen()) openPcEditor('p=' + encodeURIComponent(p.name)); else openEditor(p); }
        else if (kind === 'DELETE') askConfirm('「' + p.name + '」を削除しますか', () => { S.programs = S.programs.filter(x => x !== p); save(); toast('削除しました'); openProgList('DELETE'); }, () => openProgList('DELETE'));
        else if (kind === 'EXPORT') { exportProgram(p); }
        else if (kind === 'CCL') { exportCcl(p); }
      }
    }));
    // 実行の一覧は、アプリ版プログラム（このアプリだけ）と電卓実機併用プログラムを分けて並べる
    if (kind === 'RUN') {
      if (items.length) Object.assign(items[0], { head: '電卓実機併用プログラム', headNote: 'fx-5800P の実機でも動く（CCL で実機へ送れる）', headClass: 'mg-calc' });
      items.unshift(...APP_PROGRAMS.map((a, i) => ({ label: a.label + '（アプリ版）', key: a.key, title: a.title, desc: a.desc,
        ...(i === 0 ? { head: 'アプリ版プログラム', headNote: 'このアプリだけで動く。実機・電卓の変数・ほかのプログラムとは別', headClass: 'mg-app' } : {}),
        act: () => a.open(() => openProgList('RUN', a.key)) })));
    }
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
    // 実機と同じく、書いた所までをそのまま残して Program Menu（1:NEW 2:RUN 3:EDIT 4:DELETE）へ戻る
    try {
      if (p.mode === 'COMP') B.check(p.source);
      toast('保存しました：' + p.name);
    } catch (e) {
      toast('保存しました。ただし文法エラー：' + (e.line ? e.line + '行 ' : '') + e.message, 6000);
    }
    openProgMenu();
  }
  function editKey(k) {
    const id = k.id, ta = $('editor');
    if (id === 'EXIT') return closeEditor();
    if (id === 'EXE') { if (shift) return editInsert('◢'); return editInsert('\n'); }
    if (id === 'DEL') {
      const a = ta.selectionStart, b = ta.selectionEnd;
      if (a !== b) ta.setRangeText('', a, b, 'end');
      else if (a > 0) {
        // 直前が命令（Prog 、sin( など）なら丸ごと消す（実機の DEL と同じ）
        const n = FxComplete.tokenBefore(ta.value.slice(0, a)) || Array.from(ta.value.slice(0, a)).pop().length;
        ta.setRangeText('', a - n, a, 'end');
      }
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
  //   実機と同じ（wide でない）：16 桁×4 行。見やすい表示（wide）：桁は LCD_COLS、行は 80 行まで残して下から LCD_ROWS 行を出す
  //   right[i]：右寄せの行（答え）。hints[i]：その行の右に小さく出す変数の名前
  const GRID_KEEP = 80;
  function recordResult(text, value = false) {
    text = String(text).trim();
    if (!text) return;
    run.results.push({ text, value });
    if (run.results.length > GRID_KEEP) run.results.shift();
  }
  const blankRow = n => Array(n).fill(' ');
  function newGrid() {
    const wide = LCD_WIDE;
    return { wide, cap: wide ? GRID_KEEP : 4, rows: wide ? [] : Array.from({ length: 4 }, () => blankRow(16)), right: wide ? [] : [false, false, false, false], hints: wide ? [] : ['', '', '', ''], row: 0, maxRow: 0 };
  }
  const gridW = g => g.wide ? Math.max(16, LCD_COLS) : 16;
  function gridEnsure(g, i) { while (g.rows.length <= i) { g.rows.push(blankRow(gridW(g))); g.right.push(false); g.hints.push(''); } }
  function gridNewLine(g) {
    if (g.row >= g.cap) { g.rows.shift(); g.right.shift(); g.hints.shift(); g.rows.push(blankRow(gridW(g))); g.right.push(false); g.hints.push(''); g.row = g.cap - 1; g.maxRow = Math.max(0, g.maxRow - 1); }
    gridEnsure(g, g.row);
  }
  const io = {
    cls() { run.grid = newGrid(); },
    print(text, record = true) {
      if (record) recordResult(text);
      const g = run.grid, ch = Array.from(String(text)), W = gridW(g);
      let i = 0;
      do { gridNewLine(g); g.rows[g.row] = Array.from({ length: W }, (_, j) => ch[i + j] ?? ' '); g.right[g.row] = false; g.hints[g.row] = ''; g.row++; i += W; } while (i < ch.length);
    },
    printValue(text, record = true) {
      if (record) recordResult(text, true);
      const g = run.grid;
      if (g.wide) { gridNewLine(g); g.rows[g.row] = Array.from(String(text)); g.right[g.row] = true; g.hints[g.row] = ''; g.row++; return; }
      const ch = Array.from(String(text)).slice(-16);
      gridNewLine(g); g.rows[g.row] = Array.from({ length: 16 }, (_, j) => ch[j - (16 - ch.length)] ?? ' '); g.row++;
    },
    locate(x, y, text) {
      recordResult(text);
      const g = run.grid, W = gridW(g), ch = Array.from(String(text));
      gridEnsure(g, y - 1);
      if (g.right[y - 1]) { const r = g.rows[y - 1]; g.rows[y - 1] = Array.from({ length: W }, (_, j) => r[j - (W - r.length)] ?? ' '); g.right[y - 1] = false; }
      const r = g.rows[y - 1]; while (r.length < W) r.push(' ');
      for (let i = 0; i < ch.length && x - 1 + i < W; i++) r[x - 1 + i] = ch[i];
      g.maxRow = Math.max(g.maxRow, y);
    }
  };
  // ---- SENTEI（線形を入れる）：現場名で保存・呼び出し（アプリだけ。実機にはない） --------
  //   S.senteiSites：[{ name, inputs: [{ label, text, deg, shown }], savedAt }]、S.senteiLast：前回の入力
  //   呼び出すと、聞かれた順（同じ名前は何回目か）で値を合わせる。「入れる」は全部そのまま、「確かめる」は 1 つずつ EXE
  const isSentei = p => !!p && p.name === 'SENTEI';
  const senteiKey = s => String(s || '').normalize('NFKC').trim().toLowerCase();
  function senteiSites() { if (!Array.isArray(S.senteiSites)) S.senteiSites = []; return S.senteiSites; }
  function senteiSummary(inputs) {
    const pick = l => inputs.filter(e => e.label === l);
    const num = e => e ? String(e.shown || e.text) : '―';
    const parts = [];
    const n = pick('N')[0];
    parts.push('曲線 ' + num(n) + '　BP(' + num(pick('BP-X')[0]) + ', ' + num(pick('BP-Y')[0]) + ')　BP〜IP ' + num(pick('BP-IP')[0]));
    const R = pick('R'), IA = pick('IA'), MK = pick('MUKI R=1 L=-1');
    R.forEach((r, i) => parts.push('第' + (i + 1) + '曲線 R ' + num(r) + '　IA ' + num(IA[i]) + '　' + (MK[i] && Number(MK[i].text) < 0 ? '左' : '右')));
    const ep = pick('IP-EP')[0];
    if (ep) parts.push('IP〜EP ' + num(ep));
    return parts;
  }
  const senteiDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  function chooseSentei(p, from) {
    const D = window.FxDialog, h = D.h;
    const rows = [];
    if (S.senteiLast && Array.isArray(S.senteiLast.inputs) && S.senteiLast.inputs.length) rows.push({ name: '前回の入力', last: true, inputs: S.senteiLast.inputs, savedAt: S.senteiLast.savedAt });
    senteiSites().slice().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))).forEach(e => rows.push(e));
    let dlg = null;
    const go = (row, auto) => { dlg.close(); startRun(p, from, { preset: row.inputs, auto, name: row.last ? '' : row.name }); };
    const list = h('ul', { class: 'sl-list' }, rows.map(row => h('li', {}, [
      h('div', { class: 'sl-info' }, [h('b', { text: row.name + (row.savedAt ? '　' + senteiDate(row.savedAt) : '') }), ...senteiSummary(row.inputs).map(t => h('span', { text: t }))]),
      h('div', { class: 'sl-btns' }, [
        h('button', { type: 'button', class: 'dlg-btn primary', text: '入れる', title: '保存した値を全部そのまま入れる', onclick: () => go(row, true) }),
        h('button', { type: 'button', class: 'dlg-btn', text: '確かめる', title: '保存した値を出し、1 つずつ EXE で入れる（直すこともできる）', onclick: () => go(row, false) }),
        row.last ? null : h('button', { type: 'button', class: 'dlg-btn danger', text: '消す', onclick: async () => {
          if (!await D.confirm('線形を消す', '「' + row.name + '」の線形を消します。元に戻せません。', '消す', 'danger')) return;
          S.senteiSites = senteiSites().filter(e => e !== row); save();
          dlg.close(); chooseSentei(p, from);
        } })
      ])
    ])));
    dlg = D.open({
      title: '線形を入れる（SENTEI）', width: 560,
      body: h('div', {}, [
        h('p', { class: 'dlg-msg', text: rows.length
          ? '保存した現場の線形を呼び出せます。「入れる」は全部そのまま、「確かめる」は値を出して 1 つずつ EXE（直すこともできます）。\n※ 保存・呼び出しはアプリだけ。実機では毎回入れます。'
          : '保存した線形はまだありません。入れ終わると、現場名を付けて保存できます。\n※ 保存・呼び出しはアプリだけ。実機では毎回入れます。' }),
        rows.length ? list : null
      ]),
      buttons: [{ label: 'やめる' }, { label: '新しく入れる', kind: rows.length ? '' : 'primary', onClick: () => { setTimeout(() => startRun(p, from, {}), 0); } }]
    });
  }
  // 何回目の同じ名前か（R・IA などは曲線の数だけ聞かれる）で、呼び出した値を探す
  function senteiPreset(token, label) {
    if (!token.preset) return null;
    const k = token.seen[label] || 0;
    return token.preset.filter(e => e.label === label)[k] || null;
  }
  function noteInput(token, label, entry) {
    token.seen[label] = (token.seen[label] || 0) + 1;
    if (token.record) token.record.push({ label, text: String(entry.text), deg: entry.deg, shown: entry.shown });
  }
  function afterSentei(token) {
    const inputs = token.record;
    if (!inputs || !inputs.length) return;
    S.senteiLast = { inputs, savedAt: new Date().toISOString() };
    save();
    const same = token.preset && token.preset.length === inputs.length
      && token.preset.every((e, i) => e.label === inputs[i].label && Number(e.text) === Number(inputs[i].text));
    if (same && token.presetName) { toast('「' + token.presetName + '」の線形を入れました'); return; }
    const D = window.FxDialog; if (!D) return;
    const h = D.h;
    const name = h('input', { class: 'sl-name', type: 'text', value: token.presetName || '', placeholder: '例：館町下水 1〜2', maxlength: 40, autocomplete: 'off', 'aria-label': '現場名' });
    D.open({
      title: '線形を保存', width: 480,
      body: h('div', {}, [
        h('p', { class: 'dlg-msg', text: '入れた線形に現場名を付けて保存すると、次から SENTEI で呼び出せます。' }),
        h('div', { class: 'sl-info' }, senteiSummary(inputs).map(t => h('span', { text: t }))),
        name
      ]),
      buttons: [{ label: '保存しない' }, { label: '保存', kind: 'primary', onClick: async () => {
        const nm = name.value.trim();
        if (!nm) { toast('現場名を入れてください'); name.focus(); return false; }
        const list = senteiSites(), old = list.find(e => senteiKey(e.name) === senteiKey(nm));
        if (old && senteiKey(old.name) !== senteiKey(token.presetName)
          && !await D.confirm('上書き', '「' + old.name + '」はもうあります。上書きしますか。', '上書き')) return false;
        const entry = { name: nm, inputs, savedAt: new Date().toISOString() };
        S.senteiSites = list.filter(e => e !== old).concat(entry);
        save(); toast('「' + nm + '」の線形を保存しました');
      } }]
    });
    setTimeout(() => name.focus(), 50);
  }

  // ---- アプリ版プログラム（このアプリだけで動く。電卓実機・電卓の変数・ほかのプログラムとは絡まない） ----
  //   曲線の測量（curveapp.js）。データは S.curveApp だけに置く（BACKUP に入る）
  const APP_PROGRAMS = [
    { key: '(曲線の測量)', label: '曲線の測量', title: '曲線の測量（推進管）',
      desc: '線形を入れ、トランシット・ターゲットを測って左右誤差、図、推進管の次回予測、記録。電卓の変数は使わない',
      open: back => openCurveApp(back) }
  ];
  function curveAppState() {
    if (!S.curveApp || typeof S.curveApp !== 'object') S.curveApp = {};
    const st = S.curveApp;
    if (!Array.isArray(st.aligns)) st.aligns = [];
    if (!Array.isArray(st.records)) st.records = [];
    // v1.4.20 で S.surveyRecords に保存した記録は、こちらへ移す
    if (Array.isArray(S.surveyRecords) && S.surveyRecords.length) { st.records = st.records.concat(S.surveyRecords); delete S.surveyRecords; save(); }
    return st;
  }
  function openCurveApp(back) {
    if (!window.FxCurveApp) { toast('曲線の測量を読めませんでした'); return; }
    flick = false;
    mode = 'curve';
    FxCurveApp.enter({
      state: curveAppState, save, toast,
      download: (name, text) => { download(name, '﻿' + text, 'text/csv'); toast('CSV を書き出しました'); },
      // SENTEI で保存した線形を写して使えるようにする（写すだけ。あとは別々）
      senteiAligns: () => senteiSites().map(e => ({ name: e.name, align: alignFromInputs(e.inputs) })),
      setFlick: on => { flick = !!on; render(); },
      isFlick: () => flick,
      redraw: render,
      onClose: () => { flick = false; back(); render(); }
    });
    render();
  }
  // SENTEI で入れた値（聞かれた順）から、線形（senkei.js の形）を作る
  function alignFromInputs(inputs) {
    const nums = l => inputs.filter(e => e.label === l).map(e => Number(e.text));
    const degs = l => inputs.filter(e => e.label === l).map(e => e.deg != null ? e.deg : Number(e.text));
    const N = Math.max(0, Math.round(nums('N')[0] || 0)), R = nums('R'), IA = degs('IA'), MK = nums('MUKI R=1 L=-1'), IPIP = nums('IP-IP');
    const curves = [];
    for (let i = 0; i < N && i < R.length; i++) {
      const sign = (IA[i] || 0) * (MK[i] == null ? 1 : MK[i]);
      curves.push({ R: R[i], ia: Math.abs(IA[i] || 0), dir: sign < 0 ? 'L' : 'R', L: i ? (IPIP[i - 1] || 0) : 0 });
    }
    return { bp: { x: nums('BP-X')[0] || 0, y: nums('BP-Y')[0] || 0 }, az: degs('HOUKOU')[0] || 0, L0: nums('BP-IP')[0] || 0, curves, Lf: nums('IP-EP')[0] || 0 };
  }

  function startRun(p, from, opt) {
    // SENTEI は、保存した線形を呼び出すか選んでから始める（選んだら opt 付きでここへ戻る）
    if (isSentei(p) && !opt && window.FxDialog) { chooseSentei(p, from); return; }
    if (run && !run.done) run.stopped = true;
    let gen;
    try {
      gen = B.run(p, {
        vars: S.vars, io, library: S.programs, angle: S.angle, disp: S.disp,
        getkey: () => { const c = lastKeyCode; lastKeyCode = 0; return c; },
        onAngle: a => { S.angle = a; }, onDisp: d => { S.disp = d; }
      });
    } catch (e) { showError(e, from === 'comp' ? 'comp' : 'runlist'); return; }
    run = { gen, prog: p, from, grid: newGrid(), results: [], wait: null, done: false, stopped: false, inToks: [], inCur: 0,
      preset: opt && Array.isArray(opt.preset) ? opt.preset : null, auto: !!(opt && opt.auto), presetName: (opt && opt.name) || '',
      presetText: '', seen: {}, record: isSentei(p) ? [] : null };
    if (!p.name.startsWith('(')) S.lastProg = p.name;   // 変数のタブで、このプログラムの変数の名前を出す
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
          if (token.record && !token.stopped) setTimeout(() => afterSentei(token), 50);
          return;
        }
        const ev = st.value;
        if (ev.type === 'tick') { render(); setTimeout(() => pump(), 0); return; }
        if (ev.type === 'input') {
          // 呼び出した線形：「入れる」なら聞かずにそのまま入れる。合う値がない所からは 1 つずつ聞く
          const pre = senteiPreset(token, ev.label);
          if (pre && token.auto) {
            io.print(ev.label + '? ' + (pre.shown || pre.text), false);
            noteInput(token, ev.label, pre);
            input = pre.text;
            continue;
          }
          token.auto = false;
          token.wait = ev; token.inToks = []; token.inCur = 0; token.dms = startDms(ev);
          token.presetText = '';
          if (pre) {
            if (token.dms) token.dms.previous = pre.deg != null ? pre.deg : Number(pre.text) * token.dms.scale;
            else token.presetText = String(pre.text);
          }
          token.coordinate = token.dms ? null : coordinateField(ev);
          if (token.grid.wide || token.coordinate) {
            // 見やすい表示：聞かれた行の「?」の右に入力し、変数の名前を右に小さく出す。前の入力・答えは上に残す
            io.print(ev.label + '?', false);
            const g = token.grid;
            token.inRow = g.row - 1;
            token.inPrefix = g.rows[token.inRow].join('').replace(/\s+$/, '') + ' ';
            token.keepText = ev.keep ? ev.currentText : token.presetText;
            if (g.wide) g.hints[token.inRow] = runHint();
            render(); return;
          }
          io.print(ev.label + '?', false);
          const hasValue = ev.keep || token.dms || token.presetText;
          if (hasValue) io.printValue(token.dms ? dmsDisplay(token.dms) : ev.keep ? ev.currentText : token.presetText, false);
          else gridNewLine(token.grid);
          token.inRow = Math.min(token.grid.row - (hasValue ? 1 : 0), 3);
          if (!hasValue) token.grid.row = Math.min(token.grid.row, 3);
          render(); return;
        }
        if (ev.type === 'pause') {
          if (token.auto) continue;   // 呼び出した線形を全部そのまま入れるときは、途中の ◢ で止めない
          token.wait = ev; render(); return;
        }
      }
    } catch (e) {
      token.done = true; token.wait = null; save();
      showError(e, token.from === 'comp' ? 'comp' : 'edit');
      errState.prog = S.programs.find(x => x.name === e.prog) || null;
      render();
    }
  }
  // 実行中に値を聞かれたとき、その変数の日本語の名前（'変数 の行から）。液晶のいちばん上の行の右に出す
  let hintName = '';
  function runHint() {
    const w = run && run.wait;
    if (!w || w.type !== 'input' || !w.target) return '';
    const p = S.programs.find(x => x.name === w.prog) || (run.prog && run.prog.name === w.prog ? run.prog : null);
    if (!p) return '';
    return B.meta(p.source).vars[w.target] || '';
  }
  function setHint(text) { hintName = text || ''; }
  const DMS_WIDTH = [3, 2, 2];
  const DMS_LABELS = ['度', '分', '秒'];
  function startDms(input) {
    if (!window.FxAngle) return null;
    const label = input.label.normalize('NFKC').toUpperCase().replace(/^[\s-]+|[\s-]+$/g, '');
    const isAngle = /^(?:KAKUDO|KAKU(?:-[ABC])?|HA|VA|IA|AZ|AZIMUTH|ANGLE|HORIZONTAL ANGLE|VERTICAL ANGLE|HOUKOU|HOKO|THETA|Θ)$/.test(label)
      || /角度|水平角|鉛直角|天頂角|高度角|方向角|方位角|交角/.test(label)
      || ((!label || label === input.target) && /^(?:既知点の)?(?:水平角|鉛直角|方向角|方位角|交角|角度)/.test(runHint()));
    if (!isAngle) return null;
    const key = JSON.stringify([input.prog, input.label, input.target]);
    const unit = input.angle || S.angle;
    const scale = unit === 'Rad' ? 180 / Math.PI : unit === 'Gra' ? 0.9 : 1;
    const saved = S.dmsInputs?.[key];
    const previous = Number.isFinite(saved) ? saved : input.keep && Number.isFinite(input.current) ? input.current * scale : 0;
    return { key, scale, previous, part: 0, parts: null, negative: false };
  }
  function dmsParts(dms) {
    if (dms.parts) {
      return dms.parts.map((value, i) => {
        const [whole, fraction] = value.split('.');
        return (i === 0 && dms.negative ? '-' : '') + whole.padStart(DMS_WIDTH[i], '0')
          + (fraction === undefined ? '' : '.' + fraction);
      });
    }
    const { sign, d, m, s } = FxAngle.toDMS(dms.previous, 3);
    const [seconds, fraction] = String(s).split('.');
    return [(sign < 0 ? '-' : '') + String(d).padStart(3, '0'), String(m).padStart(2, '0'),
      seconds.padStart(2, '0') + (fraction ? '.' + fraction : '')];
  }
  const dmsDisplay = dms => dmsParts(dms).join('-');
  function dmsControls(dms) {
    return dmsParts(dms).map((value, i) => '<button type="button" class="dms-part" tabindex="-1" data-tap="dms' + i
      + '" aria-label="' + DMS_LABELS[i] + ' ' + esc(value) + '" aria-pressed="' + (i === dms.part) + '">'
      + esc(value) + '</button>').join('-');
  }
  function editDms(dms, id) {
    if (id === 'LEFT' || id === 'RIGHT' || id === 'DMS') {
      dms.part = Math.min(2, Math.max(0, dms.part + (id === 'LEFT' ? -1 : 1)));
    } else if (id === 'DEL') {
      if (dms.parts) dms.parts[dms.part] = dms.parts[dms.part].slice(0, -1);
    } else if (id === 'NEG' || id === 'SUB') {
      if (!dms.parts) dms.parts = ['', '', ''];
      dms.negative = !dms.negative;
    } else if (/^\d$/.test(id) || (id === 'DOT' && dms.part === 2)) {
      if (!dms.parts) dms.parts = ['', '', ''];
      const i = dms.part, current = dms.parts[i];
      if (id === 'DOT') {
        if (!current.includes('.')) dms.parts[i] = (current || '0') + '.';
      } else if (i === 2 && current.includes('.')) {
        if (current.split('.')[1].length < 3) dms.parts[i] += id;
      } else if (i === 0 && current.length === 2 && Number(current + id) >= 360) {
        // 「563120」と続けて打ったとき：563° ではなく 56° とみて、3 は分の 1 桁目にする
        dms.parts[1] = id; dms.part = 1;
      } else {
        dms.parts[i] = current.length >= DMS_WIDTH[i] ? id : current + id;
        if (i < 2 && dms.parts[i].length === DMS_WIDTH[i]) dms.part++;
      }
    }
  }
  function coordinateField(input) {
    const label = input.label.normalize('NFKC').toUpperCase().trim().replace(/^-+|-+$/g, '');
    const named = label.match(/^(?:(B|O|K|P|F|S|T|I|BP|EP|IP|BC|EC|RO|SP|TYUUSIN)[\s_-]?)?([XYZ])(\d*)$/);
    if (named && (named[1] || named[3] || named[2] !== 'Z')) return { axis: named[2].toLowerCase(), group: (named[1] || '') + ':' + named[3] };
    const hint = /座標|標高/.test(label) ? label : runHint().normalize('NFKC').toUpperCase();
    const axis = /^(.*?)(?:座標\s*|の\s*)([XY])(?:$|\W)/.exec(hint);
    if (axis) return { axis: axis[2].toLowerCase(), group: axis[1].trim() };
    if (/^(?:標高|計画高)|の標高/.test(hint)) return { axis: 'z', group: '' };
    return null;
  }
  function pointName(field, value) {
    const x = run.lastCoordX;
    if (field?.axis !== 'y' || x?.group !== field.group || !Number.isFinite(value)) return '';
    const points = Array.isArray(S.pickedPoints) ? S.pickedPoints : [];
    const p = points.find(point => point && Math.abs(point.x - x.value) < 1e-9 && Math.abs(point.y - value) < 1e-9);
    return typeof p?.name === 'string' ? '（' + p.name + '）' : '';
  }
  const runHintHtml = t => t ? '<span class="lhint" title="' + esc(t).replace(/"/g, '&quot;') + '">' + esc(t) + '</span>' : '';
  const coordinatePicker = () => line('', {
    html: '<button type="button" class="lcd-pick" data-tap="pickxy">座標一覧から</button>'
  });
  function coordinateInputLine() {
    const text = run.inToks.join('');
    const value = text ? Number(text) : run.wait.keep ? run.wait.current : NaN;
    const hint = pointName(run.coordinate, value) || (run.grid.wide ? runHint() : '');
    const before = run.inToks.slice(0, run.inCur).join('');
    const at = run.inToks[run.inCur];
    const after = run.inToks.slice(run.inCur + 1).join('');
    const input = text || !run.keepText
      ? esc(before) + '<span class="cur">' + (at === undefined ? '&nbsp;' : esc(at)) + '</span>' + esc(after)
      : esc(run.keepText);
    return line('', { html: esc(run.inPrefix) + input + runHintHtml(hint) });
  }
  // 選択した点は、同じ組の X・Y・標高にだけ順に入れる。
  function fillRunInputs(vals, point, axes, token, first) {
    if (run !== token || run.wait !== first) return;
    const p = { name: point.name, x: Number(FxPickXY.text(point.x)), y: Number(FxPickXY.text(point.y)) };
    if (p.name && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      const prev = Array.isArray(S.pickedPoints) ? S.pickedPoints : [];
      S.pickedPoints = [p, ...prev.filter(other => other && (other.x !== p.x || other.y !== p.y))].slice(0, 100);
      save();
    }
    let index = 0;
    const group = token.coordinate.group;
    let tries = 0;
    const step = () => {
      if (run !== token || run.done || index >= vals.length) { render(); return; }
      const w = run.wait;
      if (!w) {   // 計算の途中（tick）：少し待って続ける
        if (tries++ < 100) { setTimeout(step, 20); return; }
        render(); return;
      }
      const field = run.coordinate;
      if (w.type !== 'input' || field?.axis !== axes[index] || (field.group !== group && axes[index] !== 'z')) {
        toast('次の入力に使わない座標は入りませんでした'); render(); return;
      }
      tries = 0;
      run.inToks = Array.from(vals[index]); run.inCur = run.inToks.length;
      runKey({ id: 'EXE' });
      render();
      if (run.wait !== w) { index++; step(); }
    };
    step();
  }
  function pickFromList() {
    if (!(mode === 'run' && run && !run.done && run.wait?.type === 'input' && run.coordinate)) return;
    if (!window.FxPickXY) { toast('座標一覧の部品を読めませんでした'); return; }
    const token = run, first = run.wait;
    FxPickXY.open({ axis: run.coordinate.axis, hint: runHint() || first.label, toast,
      onPick: (vals, point, axes) => fillRunInputs(vals, point, axes, token, first) });
  }
  function renderRun() {
    setHint(runHint());
    if (run.grid.wide) return renderRunWide();
    const g = run.grid, lines = g.rows.map((r, i) => g.hints[i]
      ? line('', { html: esc(r.join('').trimEnd()) + runHintHtml(g.hints[i]) }) : line(r.join('')));
    if (!run.done && run.wait?.type === 'input' && run.coordinate) {
      lines[run.inRow] = coordinateInputLine();
      lines.splice(run.inRow + 1, 0, coordinatePicker());
      if (run.inRow + 1 >= LCD_ROWS) lines.shift();
      paint(lines);
      return;
    }
    if (run.wait && run.wait.type === 'input' && run.dms) {
      lines[run.inRow] = line('', { html: dmsControls(run.dms) });
    } else if (run.wait && run.wait.type === 'input' && (run.inToks.length || (!run.wait.keep && !run.presetText))) {
      const t = run.inToks.join(''), cur = run.inToks.slice(0, run.inCur).join('').length;
      lines[run.inRow] = wrapWithCursor(t, cur, 1)[0];
    }
    paint(lines);
  }
  // 見やすい表示の実行画面：下から LCD_ROWS 行。聞かれている行は「KX? 100.123▮　既知点の X」
  function renderRunWide() {
    const g = run.grid, w = run.wait, asking = !run.done && w && w.type === 'input';
    const pick = asking && run.coordinate;
    let used = Math.max(g.row, g.maxRow);
    // 止まっている・終わったときは、いちばん下にどうすればよいかを出す
    const status = run.done ? (run.stopped ? '' : '― 終わり　EXE：もう一度　EXIT：一覧 ―') : (w && w.type === 'pause' ? '◢ EXE で続き' : '');
    const total = used + (status || pick ? 1 : 0);
    const start = Math.max(0, total - LCD_ROWS);
    const lines = [];
    for (let i = start; i < used; i++) {
      const text = (g.rows[i] || []).join('');
      if (asking && i === run.inRow) {
        if (pick) { lines.push(coordinateInputLine()); continue; }
        const before = run.inToks.slice(0, run.inCur).join(''), at = run.inToks[run.inCur], after = run.inToks.slice(run.inCur + 1).join('');
        let body;
        if (run.dms) body = dmsControls(run.dms);
        else if (!run.inToks.length && run.keepText) body = '<span class="cur">' + esc(Array.from(run.keepText)[0] || ' ') + '</span>' + esc(Array.from(run.keepText).slice(1).join(''));
        else body = esc(before) + '<span class="cur">' + (at === undefined ? '&nbsp;' : esc(at)) + '</span>' + esc(after);
        lines.push(line('', { html: esc(run.inPrefix) + body + runHintHtml(g.hints[i]) }));
      } else if (g.right[i]) lines.push(line(text, { right: true }));
      else lines.push(line('', { html: esc(text.replace(/\s+$/, '')) + runHintHtml(g.hints[i]) }));
    }
    if (status) lines.push(line(status, { small: true }));
    if (pick) lines.push(coordinatePicker());
    if (LCD_ROWS > 4 && lines.length < LCD_ROWS && !run.prog.name.startsWith('(')) {
      const title = B.meta(run.prog.source).title;
      lines.unshift(line(title ? title + '　' + run.prog.name : run.prog.name, { small: true }));
    }
    paint(lines);
  }
  function runKey(k) {
    const id = k.id;
    if (run.done) {
      if (id === 'EXE') {
        if (run.from === 'comp') { mode = 'comp'; comp.shown = { value: S.vars.Ans, how: 'norm', label: comp.toks.join('') }; return; } return startRun(run.prog, run.from);
      }
      if (id === 'EXIT' || id === 'AC') { if (run.from === 'comp') { mode = 'comp'; comp.shown = { value: S.vars.Ans, how: 'norm', label: comp.toks.join('') }; } else openProgList('RUN', run.prog.name); run = null; return; }
      return;
    }
    if (id === 'AC') { run.stopped = true; run.done = true; run.wait = null; io.print('Break', false); save(); return; }
    const w = run.wait;
    if (!w) { lastKeyCode = k.code || 0; return; } // 実行中：Getkey 用に記録するだけ
    if (w.type === 'pause') { if (id === 'EXE') { run.wait = null; pump(); } return; }
    // 入力待ち
    const dms = run.dms;
    if (dms && id !== 'EXE' && id !== 'EXIT') { editDms(dms, id); return; }
    if (id === 'EXE') {
      let text = run.inToks.join(''), shown = text || run.keepText || '', degrees;
      // 呼び出した線形の値が出ている所で、何も打たずに EXE ならその値
      if (!text && !dms && run.presetText) { text = run.presetText; shown = text; }
      if (dms) {
        const invalid = dms.parts?.findIndex((value, i) => i > 0 && Number(value) >= 60);
        if (invalid > 0) { dms.part = invalid; toast(DMS_LABELS[invalid] + 'は 00〜59 の範囲で入力してください'); return; }
        degrees = dms.parts ? FxAngle.parse(dmsDisplay(dms).replace(/\.$/, '')) : dms.previous;
        text = (degrees / dms.scale).toFixed(14);
        shown = dmsDisplay(dms).replace(/\.$/, '');
        if (!S.dmsInputs || typeof S.dmsInputs !== 'object' || Array.isArray(S.dmsInputs)) S.dmsInputs = {};
        S.dmsInputs[dms.key] = degrees;
        run.dms = null;
        save();
      }
      if (!text && !w.keep) return;
      try { if (text) E.evaluate(text, ctxComp()); } catch (e) { toast(e.message); return; }
      if (run.record || run.preset) {
        let saveText = text || String(w.current);
        try { saveText = String(E.evaluate(saveText, ctxComp()).value); } catch (e) { /* そのまま */ }
        noteInput(run, w.label, { text: saveText, deg: degrees, shown: degrees != null ? shown : String(+Number(saveText).toFixed(6)) });
      }
      run.presetText = '';
      const field = run.coordinate;
      const value = text ? Number(text) : w.current;
      const name = pointName(field, value);
      if (name) run.grid.hints[run.inRow] = name;
      run.lastCoordX = field?.axis === 'x' && Number.isFinite(value) ? { group: field.group, value } : null;
      run.wait = null;
      if (run.grid.wide || field) {
        // 聞かれた行を「KX? 100.123」にして残す（変数の名前もそのまま）
        const g = run.grid;
        g.rows[run.inRow] = Array.from(run.inPrefix + shown);
        pump(text);
        return;
      }
      run.grid.row = Math.min(run.inRow + 1, 4);
      if (text) { run.grid.rows[run.inRow] = Array(16).fill(' '); const ch = Array.from(shown).slice(-16); ch.forEach((c, j) => { run.grid.rows[run.inRow][j] = c; }); }
      pump(text);
      return;
    }
    if (id === 'EXIT') { run.stopped = true; run.done = true; run.wait = null; io.print('Break', false); return; }
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
    updateCands();
  }

  // ---- 入力候補（英字を打つと候補を出し、Tab かタップで決める / フリック漢字変換候補も表示） ----
  let cand = { list: [], sel: 0, kind: null, len: 0 };
  let flickCand = null; // { list, sel, pick }
  function updateCands() {
    let word = '';
    if (mode === 'edit') {
      const ta = $('editor'), a = ta.selectionStart;
      if (a === ta.selectionEnd) {
        const v = ta.value, before = v.slice(v.lastIndexOf('\n', a - 1) + 1, a);
        if ((before.match(/"/g) || []).length % 2 === 0) { const m = before.match(/[A-Za-z#]+$/); if (m) word = m[0]; }
      }
    } else if (mode === 'comp' && !comp.shown) {
      let i = comp.cur;
      while (i > 0 && /^[A-Za-z]$/.test(comp.toks[i - 1])) i--;
      word = comp.toks.slice(i, comp.cur).join('');
    }
    const list = word ? FxComplete.match(word, { oneLine: mode === 'comp' }) : [];
    cand = { list, sel: 0, kind: mode, len: word.length };
    renderCands();
  }
  function renderCands() {
    const box = $('cands');
    if (flickCand && flickCand.list.length && flick) {
      box.hidden = false; $('ver').hidden = true;
      box.innerHTML = flickCand.list.map((w, i) => '<button type="button" class="cd' + (i === flickCand.sel ? ' sel' : '') + '" data-c="' + i + '">' + esc(w) + '</button>').join('');
      const sel = box.querySelector('.sel'); if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    const show = cand.list.length && cand.kind === mode;
    box.hidden = !show; $('ver').hidden = !!show;
    if (!show) { box.innerHTML = ''; return; }
    box.innerHTML = cand.list.map((x, i) => '<button type="button" class="cd' + (i === cand.sel ? ' sel' : '') + '" data-c="' + i + '" title="' + esc(x[2] || '') + '">' + esc(x[0]) + '</button>').join('');
    const sel = box.querySelector('.sel'); if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function acceptCand(i) {
    if (flickCand && flickCand.list.length && flick) {
      const pick = flickCand.pick;
      if (pick) pick(i ?? flickCand.sel);
      return;
    }
    const x = cand.list[i ?? cand.sel]; if (!x) return;
    if (cand.kind === 'edit' && mode === 'edit') {
      const ta = $('editor'), a = ta.selectionStart, k = x[1].indexOf('|'), plain = x[1].replace('|', '');
      ta.setRangeText(plain, a - cand.len, a, 'end');
      if (k >= 0) { const p = a - cand.len + k; ta.setSelectionRange(p, p); }
      editChanged(); ta.focus({ preventScroll: true });
    } else if (cand.kind === 'comp' && mode === 'comp') {
      comp.toks.splice(comp.cur - cand.len, cand.len); comp.cur -= cand.len;
      // 計算画面では命令の部分だけを1つの塊として入れる（Pol(|) → Pol(、Prog "|" → Prog "）
      comp.toks.splice(comp.cur, 0, x[1].split('|')[0]); comp.cur++;
    }
    cand = { list: [], sel: 0, kind: null, len: 0 };
    renderCands(); render();
  }
  function handle(k, wasShift, wasAlpha) {
    const id = k.id;
    if (id === 'CPLX' && !wasShift && !wasAlpha && ['name', 'curve', 'edit', 'comp'].includes(mode)) {
      if (window.FxFlick) { flick = !flick; render(); return; }
    }
    // ALPHA で文字を入れる
    if (wasAlpha && alphaChar(k) && !['name', 'menu', 'confirm', 'curve'].includes(mode)) {
      if (mode === 'run' && !(run && run.wait && run.wait.type === 'input')) return;
      return insertText(alphaChar(k));
    }
    if (id === 'MODE') { flick = false; if (mode === 'edit') closeEditorSilently(); if (mode === 'run' && run) { run.stopped = true; } return wasShift ? openSetup() : openMode(); }
    if (id === 'FUNC') {
      if (['comp', 'edit', 'calc', 'solve'].includes(mode) || (mode === 'fmla' && fm.phase === 'input') || (mode === 'run' && run && run.wait && run.wait.type === 'input')) return openFunction();
      return;
    }
    if (id === 'FILE' && !wasShift && !['edit', 'name'].includes(mode)) { flick = false; if (mode === 'run' && run) run.stopped = true; return openProgList('RUN'); }
    if (id === 'FMLA' && !['edit', 'name', 'run', 'curve'].includes(mode)) return openFmlaList();
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
      case 'curve': return wasAlpha && alphaChar(k) ? FxCurveApp.onChar(alphaChar(k)) : FxCurveApp.onKey(k, wasShift, wasAlpha);
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
  // 電卓（実機）へ CcLinker で送れる .ccl。書き出せない所があれば知らせて止める
  function exportCcl(p) {
    const r = FxCcl.toCcl(p);
    if (!r.ok) { toast('書き出せません：' + r.problems.filter(x => x.level === 'error').map(x => (x.line ? x.line + '行 ' : '') + x.msg).slice(0, 3).join('／'), 8000); return; }
    download(r.fileName, r.bytes, 'application/octet-stream');
    toast(r.fileName + '（' + r.size + ' バイト）を書き出しました');
  }
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
    const bad = [], skipped = [];
    for (const f of files) {
      if (f.size > 200000) { toast(f.name + ' は大きすぎます'); continue; }
      try {
        // .ccl（電卓から吸い出したファイル）・.cce（CcEditor）は中身を変換して読む
        const dec = await FxImport.decodeFile(f);
        if (dec) {
          if (window.FxProgInfo && !dec.unknown) dec.source = FxProgInfo.tidy(dec.name, dec.source);
          got.push({ name: dec.name, mode: dec.mode, source: dec.source, tail: dec.tail || 0, time: f.lastModified, ccl: /\.ccl$/i.test(f.name) });
          if (dec.unknown) bad.push(dec.name + '（読めない記号 ' + dec.unknown + '）');
          continue;
        }
        const name = f.name.replace(/\.[^.]+$/, '').replace(/\s+(COMP|BASE-N|FORMULA)(\s+[0-9A-F]+)?$/i, '').trim();
        let text = (await readText(f)).replace(/\r\n?/g, '\n').replace(/\n+$/, '');
        // 「実機用プログラム」フォルダの読み物は飛ばし、説明の .txt は本文だけにする（元と同じなら日本語の名前などを付ける）
        if (window.FxProgInfo) {
          if (FxProgInfo.isReadme(name, text)) { skipped.push(f.name); continue; }
          text = FxProgInfo.tidy(name, text);
        }
        got.push({ name, mode: 'COMP', source: text, time: f.lastModified });
      } catch (e) { bad.push(f.name + '：' + e.message); }
    }
    // 同じ名前が複数あれば、更新日時の新しい方（同じなら .ccl）を使う
    const pick = new Map();
    for (const g of got) {
      const o = pick.get(g.name);
      if (!o || g.time > o.time || (g.time === o.time && g.ccl && !o.ccl)) pick.set(g.name, g);
    }
    // tail：電卓から読んだときの最後の空の改行の数（.ccl に書き出し直すと元と同じになる）
    got = [...pick.values()].map(g => g.tail ? { name: g.name, mode: g.mode, source: g.source, tail: g.tail } : { name: g.name, mode: g.mode, source: g.source });
    if (bad.length) toast('注意：' + bad.join('、'), 7000);
    else if (skipped.length) toast(skipped.join('・') + ' はプログラムではないので読みませんでした', 5000);
    if (!got.length) { render(); return; }
    const dup = got.filter(g => S.programs.some(p => p.name === g.name));
    const apply = overwrite => {
      let n = 0;
      for (const g of got) {
        const i = S.programs.findIndex(p => p.name === g.name);
        if (i >= 0) { if (!overwrite) continue; S.programs[i] = g; } else S.programs.push(g);
        n++;
      }
      save(); toast(n + ' 本を読み込みました' + (skipped.length ? '（' + skipped.join('・') + ' はプログラムではないので読みませんでした）' : ''), skipped.length ? 6000 : 3000); openProgList('RUN'); render();
    };
    if (dup.length) { askConfirm('同じ名前 ' + dup.length + ' 本を上書きしますか（No＝新しい分だけ）', () => apply(true), () => apply(false)); render(); }
    else apply(false);
  }

  // ---- 画面部品 ---------------------------------------------------------
  let toastTimer;
  function toast(t, ms) { const n = $('toast'); n.textContent = t; n.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => n.classList.remove('show'), ms || 3000); }
  // PC・タブレット（画面の短い辺が600px以上）では、プログラムの作成・編集を PC 用エディターで開く
  function bigScreen() { return Math.min(screen.width, screen.height) >= 600; }
  function openPcEditor(query) {
    save();
    const w = window.open('editor.html?' + query, 'fx5800p-editor');
    if (!w) { location.href = 'editor.html?' + query; return; } // 新しい画面を開けないときは同じ画面で
    toast('エディターで開きました。保存すると電卓にもすぐ反映されます');
  }
  // SHIFT・ALPHA が有効な間は、キーの表記をその機能に切り替える
  let renderedFlick = false, renderedFlickMode = null;
  function flickTarget() {
    const onModeChange = () => { render(); };
    const onCands = (list, idx, pick) => {
      flickCand = list && list.length ? { list, sel: idx, pick } : null;
      renderCands();
    };
    if (mode === 'curve') return {
      onChar: s => { FxCurveApp.onChar(s); render(); },
      getText: () => FxCurveApp.getText(),
      replaceTail: (n, s) => { FxCurveApp.replaceTail(n, s); render(); },
      onDel: () => press('DEL'), onAc: () => press('AC'), onExe: () => press('EXE'),
      onClose: () => { flick = false; render(); }, onModeChange, onCands
    };
    if (mode === 'name') return {
      onChar: s => { if (Array.from(nameIn.text).length < 12) { nameIn.text += s; render(); } },
      getText: () => nameIn.text,
      replaceTail: (n, s) => { const a = Array.from(nameIn.text); nameIn.text = a.slice(0, Math.max(0, a.length - n)).join('') + s; render(); },
      onDel: () => press('DEL'), onAc: () => press('AC'), onExe: () => press('EXE'),
      onClose: () => { flick = false; render(); }, onModeChange, onCands
    };
    if (mode === 'edit') return {
      onChar: s => { editInsert(s); render(); },
      getText: () => { const ta = $('editor'); return ta.value.slice(0, ta.selectionStart); },
      replaceTail: (n, s) => {
        const ta = $('editor'), p = ta.selectionStart;
        const cut = Array.from(ta.value.slice(0, p)).slice(-n).join('').length;
        ta.setRangeText(s, p - cut, p, 'end'); editChanged(); render();
      },
      onDel: () => press('DEL'), onAc: () => press('AC'), onExe: () => press('EXE'),
      onClose: () => { flick = false; render(); }, onModeChange, onCands
    };
    return {
      onChar: s => { insertText(s); render(); },
      getText: () => comp.toks.slice(0, comp.cur).join(''),
      replaceTail: (n, s) => {
        const cs = Array.from(s), pos = Math.max(0, comp.cur - n);
        comp.toks.splice(pos, n, ...cs); comp.cur = pos + cs.length; render();
      },
      onDel: () => press('DEL'), onAc: () => press('AC'), onExe: () => press('EXE'),
      onClose: () => { flick = false; render(); }, onModeChange, onCands
    };
  }
  function updateKeyFaces() {
    const canFlick = flick && window.FxFlick && ['name', 'curve', 'edit', 'comp'].includes(mode);
    if (!canFlick && flick) flick = false;
    if (!canFlick && flickCand) { flickCand = null; renderCands(); }
    const flickMode = canFlick ? window.FxFlick.getMode() : null;
    if (canFlick !== renderedFlick || flickMode !== renderedFlickMode) {
      renderedFlick = canFlick;
      renderedFlickMode = flickMode;
      const nk = $('nkeys');
      if (canFlick) window.FxFlick.render(nk, flickTarget());
      else { if (window.FxFlick) window.FxFlick.clearHandlers(nk); nk.innerHTML = NROWS.map(r => r.map(k => keyHtml(KEYS[k[0]])).join('')).join(''); }
    }
    const ib = $('inputBar');
    if (ib) {
      const showBar = !!(window.FxFlick && (mode === 'name' || (mode === 'curve' && window.FxCurveApp && FxCurveApp.canFlick())));
      ib.hidden = !showBar;
      if (showBar) {
        const cur = !canFlick ? 'num' : flickMode;
        ib.querySelectorAll('[data-im]').forEach(b => {
          if (b.dataset.im !== 'next') b.classList.toggle('on', b.dataset.im === cur);
        });
      }
    }
    const a = alpha || alock;
    document.querySelectorAll('.keypad .key').forEach(b => {
      if (!b.dataset.k) return;
      const k = KEYS[b.dataset.k]; if (!k || k.id === 'SHIFT' || k.id === 'ALPHA') return;
      const main = b.querySelector('.main');
      let text = k.label, cls = '';
      if (k.id === 'CPLX' && canFlick && !shift && !a) { text = '数字'; }
      else if (k.id === 'EXP' && mode === 'curve' && window.FxCurveApp && FxCurveApp.isAngleField && FxCurveApp.isAngleField() && !shift && !a) { text = '°′″'; }
      else if (shift) { if (k.sl) { text = k.sl; cls = 'face-s'; } else cls = 'face-off'; }
      else if (a) { if (k.al) { text = k.al; cls = 'face-a'; } else cls = 'face-off'; }
      if (main.textContent !== text) main.textContent = text;
      b.classList.toggle('face-s', cls === 'face-s');
      b.classList.toggle('face-a', cls === 'face-a');
      b.classList.toggle('face-off', cls === 'face-off');
    });
    document.querySelector('.calc').classList.toggle('shift-on', shift);
    document.querySelector('.calc').classList.toggle('alpha-on', a && !shift);
    document.querySelector('.calc').classList.toggle('flick-on', canFlick);
  }
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
  // 見やすい表示のディスプレイの文字の大きさ（ポイント数 → px：1pt = 4/3px）
  function fitLcd() {
    const lcd = $('lcd'), calc = $('calc');
    const handle = $('lcdResize');
    const layout = FxLayout.state, { free, orient } = FxLayout.info;
    if (!free && mode === 'menu') return;
    const style = getComputedStyle(lcd);
    const w = lcd.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // 16桁がちょうど入る文字の大きさ（等幅の文字幅は約0.6em）
    const probe = document.createElement('span'); probe.className = 'probe'; probe.textContent = '0000000000';
    lcd.append(probe);
    const cw = probe.getBoundingClientRect().width / 10 / parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    const wide = layout.lcd === 'wide';
    const glyphWidth = cw || 0.6;
    const pt = Number(layout.lcdFontPt) || 14;
    const ptPx = pt * (96 / 72);
    document.documentElement.style.setProperty('--ca-fs', ptPx.toFixed(2) + 'px');
    let fs = wide ? Math.max(8, ptPx) : Math.max(8, Math.min(30, w / (16 * glyphWidth)));
    const rowHeight = 1.22, indicatorHeight = 0.72;
    const padding = el => {
      const css = getComputedStyle(el);
      return parseFloat(css.paddingTop) + parseFloat(css.paddingBottom);
    };
    let available = lcd.clientHeight - padding(lcd);
    if (free) {
      if (!wide) fs = Math.max(8, Math.min(fs, available / (4 * rowHeight + indicatorHeight)));
    } else {
      const bezel = lcd.parentElement;
      const barHeight = calc.querySelector('.bar').offsetHeight;
      const fixed = padding(calc) + (barHeight ? 4 : 3) * parseFloat(getComputedStyle(calc).rowGap) + padding(bezel) + padding(lcd)
        + calc.querySelector('.top').offsetHeight + barHeight;
      // 4 段ずつの関数キーとテンキーが押せる高さを残す。
      const keypadHeight = 300;
      const base = wide
        ? Math.min(fs * (4 * rowHeight + indicatorHeight), Math.max(fs * (rowHeight + indicatorHeight), calc.clientHeight - fixed - keypadHeight))
        : fs * (4 * rowHeight + indicatorHeight);
      const max = Math.max(0, Math.floor(Math.min(36 * rowHeight * fs, calc.clientHeight - fixed - base - keypadHeight)));
      const extra = Math.max(0, Math.min(max, Number(layout[orient].lcdExtra) || 0));
      calc.style.setProperty('--lcd-extra', extra + 'px');
      if (handle) {
        handle.setAttribute('aria-valuemin', '0');
        handle.setAttribute('aria-valuemax', String(max));
        handle.setAttribute('aria-valuenow', String(extra));
      }
      available = base + extra;
    }
    const rows = wide ? Math.max(1, Math.min(40, Math.floor((available / fs - indicatorHeight) / rowHeight + 0.001))) : 4;
    const cols = wide ? Math.min(48, Math.max(1, Math.floor(w / (fs * glyphWidth)))) : 16;
    if (handle) handle.setAttribute('aria-valuetext', rows + ' 行');
    document.documentElement.style.setProperty('--lcd-fs', fs.toFixed(2) + 'px');
    document.documentElement.style.setProperty('--rows', String(rows));
    LCD_ROWS = rows; LCD_COLS = cols; LCD_WIDE = wide;
  }
  function physicalKeys() {
    const map = { Enter: 'EXE', Backspace: 'DEL', Escape: 'AC', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN', '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV', '(': 'LP', ')': 'RP', ',': 'COMMA', '.': 'DOT', '^': 'POW' };
    // PC の Shift だけを押して離したら、電卓の SHIFT と同じ（Shift＋文字は今までどおり文字）
    let shiftAlone = false;
    document.addEventListener('keydown', e => { if (e.key === 'Shift') { if (!e.repeat) shiftAlone = true; } else shiftAlone = false; }, true);
    document.addEventListener('keyup', e => {
      if (e.key !== 'Shift' || !shiftAlone) return;
      shiftAlone = false;
      if (e.ctrlKey || e.altKey || e.metaKey || mode === 'name' || document.documentElement.classList.contains('dlg-open')) return;
      press('SHIFT');
    });
    window.addEventListener('blur', () => { shiftAlone = false; });
    $('lcd').addEventListener('pointerdown', () => { shiftAlone = false; });
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Shift') return;
      // ダイアログ（配置・座標一覧から など）を開いている間は、電卓のキーにしない
      if (document.documentElement.classList.contains('dlg-open')) return;
      // 候補が出ているとき：Tab で決定、↑↓ で選ぶ、Esc で閉じる
      if (cand.list.length && cand.kind === mode) {
        if (e.key === 'Tab') { e.preventDefault(); acceptCand(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); cand.sel = (cand.sel + (e.key === 'ArrowDown' ? 1 : -1) + cand.list.length) % cand.list.length; renderCands(); return; }
        if (e.key === 'Escape') { e.preventDefault(); cand.list = []; renderCands(); return; }
      }
      if (document.activeElement === $('editor') || document.activeElement === $('kbd')) {
        if (e.key === 'Escape') { e.preventDefault(); press('EXIT'); }
        if (e.key === 'Backspace' && document.activeElement === $('editor')) { e.preventDefault(); press('DEL'); }
        if (e.key === 'Tab') e.preventDefault();
        return;
      }
      let id = map[e.key];
      if (!id && /^[0-9]$/.test(e.key)) id = e.key;
      if (!id && /^[a-zA-Z]$/.test(e.key)) {
        const L = e.key.toUpperCase();
        if (mode === 'name') { if (Array.from(nameIn.text).length < 12) nameIn.text += L; render(); e.preventDefault(); return; }
        e.preventDefault(); insertText(L); render(); updateCands(); return;
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
      else if (t === 'desc') { S.showDesc = S.showDesc === false; save(); }
      else if (t[0] === 'h') { const it = menu.items[Number(t.slice(1))]; if (it && it.help) { menu.sel = Number(t.slice(1)); openHelpView(it.title || it.label, it.help); } }
      else { const i = Number(t); if (menu.items[i]) { menu.sel = i; menu.items[i].act(); } }
    }
    else if (mode === 'calc' || mode === 'solve') { const st = mode === 'calc' ? calc : solve; if (substCommit(st, mode)) st.idx = Number(t); }
    else if (mode === 'confirm') { confirmKey({ id: t === 'yes' ? 'EXE' : 'EXIT' }); }
    else if (mode === 'name') nameTap(t);
    else if (mode === 'curve') FxCurveApp.onTap(t);
    else if (mode === 'run' && t === 'pickxy') pickFromList();
    else if (mode === 'run' && run?.dms && /^dms[0-2]$/.test(t)) run.dms.part = Number(t[3]);
    render();
  }

  function init() {
    document.documentElement.classList.add('calculator-page');
    load();
    buildKeys();
    // 液晶のタップは「液晶の上で押して液晶の上で離した」ときだけ受ける。
    // （キーを押した直後にメニューが広がり、離した指が液晶の項目に当たって選ばれてしまうのを防ぐ）
    let downOn = null;
    $('lcd').addEventListener('pointerdown', e => { downOn = e.target.closest('[data-tap],[data-ind]'); });
    $('screen').addEventListener('click', e => { const t = e.target.closest('[data-tap]'); if (!t || t !== downOn) return; downOn = null; lcdTap(e); });
    $('ind').addEventListener('click', e => {
      const t = e.target.closest('[data-ind]'); if (!t || t !== downOn) return; downOn = null;
      if (t.dataset.ind === 'exit') { if (mode === 'edit') press('EXIT'); return; }
      if (['run', 'edit', 'name'].includes(mode) || pending) return;
      const k = t.dataset.ind;
      if (k === 'angle') openAngleMenu(); else if (k === 'disp') openDispMenu(); else if (k === 'var') { remember(); openVarList(); menu.back = toComp; }
      render();
    });
    $('editor').addEventListener('input', () => { editChanged(); updateCands(); });
    $('editor').addEventListener('click', updateCands);
    $('cands').addEventListener('pointerdown', e => e.preventDefault()); // 編集欄のカーソルを保つ
    $('cands').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) acceptCand(Number(b.dataset.c)); });
    $('fileIn').addEventListener('change', e => onFiles([...e.target.files]));
    $('xyBtn')?.remove();
    $('kbdBtn').addEventListener('click', () => {
      if (mode === 'edit') {
        const ta = $('editor'), on = ta.inputMode !== 'text';
        ta.inputMode = on ? 'text' : 'none'; $('kbdBtn').classList.toggle('on', on);
        ta.blur(); if (on) ta.focus();
        render();
      } else if (mode === 'name' && nameIn.step === 'name') {
        const k = $('kbd'); k.value = ''; k.focus();
      }
    });
    $('kbd').addEventListener('input', e => {
      if (mode !== 'name') return;
      nameIn.text = (nameIn.text + e.target.value.toUpperCase()).slice(0, 12); e.target.value = ''; render();
    });
    $('kbd').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('kbd').blur(); press('EXE'); } else if (e.key === 'Backspace') { e.preventDefault(); press('DEL'); } });
    $('ver').textContent = 'v' + VERSION;
    $('lcd').after($('ver'));
    // 「実機用プログラム」の説明の .txt ごと取り込まれたプログラム（先頭が「■ NINI：…」）は、開いたときに本文だけに直す
    if (window.FxProgInfo) {
      const result = FxProgInfo.addToKnown(S.programs);
      if (result.done.length || result.fixed.length) save();
      if (result.fixed.length) setTimeout(() => toast(result.fixed.join('・') + ' は説明の文ごと取り込まれていたので、プログラムの文だけに直しました', 8000), 300);
    }
    physicalKeys();
    // 古い画面に新しいスクリプトが読み込まれても、配置の初期化より先につまみを用意する。
    if (!$('lcdResize')) {
      $('lcd').parentElement.insertAdjacentHTML('beforeend', '<div id="lcdResize" class="lcd-resize" role="separator" tabindex="0"'
        + ' aria-orientation="horizontal" aria-label="ディスプレイの高さ" aria-controls="screen"'
        + ' title="ドラッグまたは上下キーでディスプレイの高さを変更"></div>');
    }
    // 配置（▦ 配置）：縦横・ブロックの位置と大きさ・文字の大きさ。保存は S.layout
    FxLayout.init({
      calc: $('calc'),
      load: () => S.layout,
      save: s => { S.layout = s; save(); },
      toast,
      onApply: () => { fitLcd(); render(); renderTabs(); }
    });
    // 更新前の画面が使われたときも、旧ボタンと下部の説明を取り除く。
    $('layoutBtn')?.remove();
    $('helpBtn')?.remove();
    $('help')?.remove();
    const resultBtn = document.createElement('button');
    resultBtn.id = 'resultBtn'; resultBtn.type = 'button'; resultBtn.className = 'mini';
    resultBtn.textContent = '結果'; resultBtn.hidden = true;
    resultBtn.setAttribute('aria-label', '計算結果をコピー・共有');
    resultBtn.addEventListener('click', openResult);
    document.querySelector('.blk-lcd .bar').prepend(resultBtn);
    const ib = $('inputBar');
    if (ib) {
      ib.addEventListener('pointerdown', e => e.preventDefault());
      ib.addEventListener('click', e => {
        const b = e.target.closest('[data-im]');
        if (!b || !window.FxFlick) return;
        const im = b.dataset.im;
        const cur = !flick ? 'num' : FxFlick.getMode();
        const order = ['kana', 'alnum', 'num'];
        const target = (im === 'next' || im === cur) ? order[(order.indexOf(cur) + 1) % order.length] : im;
        if (target === 'num') { flick = false; }
        else { FxFlick.setMode(target); flick = true; }
        render();
      });
    }
    bindTabs();
    fitLcd();
    window.addEventListener('resize', fitLcd);
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        const r0 = LCD_ROWS, c0 = LCD_COLS;
        fitLcd();
        if (LCD_ROWS !== r0 || LCD_COLS !== c0) render();
      });
      observer.observe(document.querySelector('.blk-lcd'));
      observer.observe(resultBtn.parentElement);
    }
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
