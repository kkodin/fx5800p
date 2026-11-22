// PC 用プログラム エディター（電卓と同じ保存場所を使う）
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'fx5800p-emu-v1';
  const B = FxBasic, E = FxEngine;
  let programs = [], cur = null, saveTimer = null, errLine = 0;

  // ---- 保存場所（電卓と共通） ----
  function readStore() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch { return {}; } }
  function load() {
    const d = readStore();
    programs = Array.isArray(d.programs) ? d.programs : [];
  }
  function writePrograms() {
    const d = readStore();
    d.programs = programs;
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch { toast('保存できませんでした（ブラウザの保存領域がいっぱいかもしれません）'); return false; }
  }
  function saveNow(msg) {
    clearTimeout(saveTimer);
    if (!cur) return;
    cur.p.source = $('src').value;
    if (writePrograms()) { $('dirty').hidden = true; if (msg) toast(msg); }
    renderList();
  }
  function scheduleSave() { $('dirty').hidden = false; clearTimeout(saveTimer); saveTimer = setTimeout(() => saveNow(), 700); }

  // ---- 一覧 ----
  function renderList() {
    const q = $('search').value.trim().toUpperCase();
    const list = programs.slice().sort((a, b) => a.name.localeCompare(b.name, 'en')).filter(p => !q || p.name.toUpperCase().includes(q));
    $('list').innerHTML = '';
    for (const p of list) {
      const li = document.createElement('li');
      li.textContent = p.name;
      if (p.mode === 'Formula') { const s = document.createElement('span'); s.className = 'fm'; s.textContent = 'FM'; li.append(s); }
      if (p.mode !== 'Formula') { try { B.check(p.source); } catch { const s = document.createElement('span'); s.className = 'ng'; s.textContent = '⚠'; s.title = '文法エラーあり'; li.append(s); } }
      if (cur && cur.p === p) li.className = 'on';
      li.onclick = () => openProgram(p);
      $('list').append(li);
    }
    $('count').textContent = programs.length + ' 本';
  }
  function openProgram(p) {
    if (cur) saveNow();
    cur = { p };
    $('pName').value = p.name;
    $('pMode').textContent = p.mode === 'Formula' ? '公式（Formula）' : '通常（COMP）';
    $('src').value = p.source;
    $('dirty').hidden = true; $('delBox').hidden = true;
    errLine = 0;
    renderList(); refresh(); check(true);
    $('src').focus(); $('src').setSelectionRange(0, 0); $('src').scrollTop = 0;
    try { localStorage.setItem(KEY + '-editor-last', p.name); } catch { /* 無視 */ }
  }

  // ---- 色分け ----
  const CMD = /^(If|Then|Else|IfEnd|For|To|Step|Next|While|WhileEnd|Do|LpWhile|Lbl|Goto|Prog|Return|Stop|Break|Isz|Dsz|Locate|Cls|Getkey|Fix|Sci|Norm|Deg|Rad|Gra|ClrMemory|DimZ|And|Or|Xor|Not)\b/;
  const FN = /^(sinh⁻¹\(|cosh⁻¹\(|tanh⁻¹\(|sin⁻¹\(|cos⁻¹\(|tan⁻¹\(|sinh\(|cosh\(|tanh\(|sin\(|cos\(|tan\(|log\(|ln\(|√\(|∛\(|Abs\(|Int\(|Intg\(|Frac\(|Rnd\(|Pol\(|Rec\(|RanInt#\(|Ran#|GCD\(|LCM\(|Not\(|Neg\(|e\^\(|10\^\(|ˣ√\(|▸DMS|Ans)/;
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function highlightLine(line) {
    let out = '', i = 0;
    while (i < line.length) {
      const rest = line.slice(i);
      let m;
      if (rest[0] === '"') { const j = line.indexOf('"', i + 1); const end = j < 0 ? line.length : j + 1; out += '<span class="t-str">' + esc(line.slice(i, end)) + '</span>'; i = end; continue; }
      if ((m = rest.match(CMD))) { out += '<span class="t-cmd">' + m[0] + '</span>'; i += m[0].length; continue; }
      if ((m = rest.match(FN))) { out += '<span class="t-fn">' + esc(m[0]) + '</span>'; i += m[0].length; continue; }
      if ((m = rest.match(/^(\d+\.?\d*|\.\d+)(ᴇ-?\d+)?/))) { out += '<span class="t-num">' + m[0] + '</span>'; i += m[0].length; continue; }
      if ('→⇒◢?'.includes(rest[0])) { out += '<span class="t-op">' + esc(rest[0]) + '</span>'; i++; continue; }
      if (rest[0] === ':') { out += '<span class="t-sep">:</span>'; i++; continue; }
      out += esc(rest[0]); i++;
    }
    return out;
  }
  function refresh() {
    const lines = $('src').value.split('\n');
    $('hl').innerHTML = lines.map((l, k) => '<span class="ln' + (k + 1 === errLine ? ' err' : '') + '">' + (highlightLine(l) || ' ') + '</span>').join('');
    $('gutter').innerHTML = lines.map((_, k) => '<div' + (k + 1 === errLine ? ' class="e"' : '') + '>' + (k + 1) + '</div>').join('');
    syncScroll(); updatePos();
    $('size').textContent = lines.length + '行・' + Array.from($('src').value).length + '文字';
  }
  function syncScroll() { const t = $('src'); $('hl').scrollTop = t.scrollTop; $('hl').scrollLeft = t.scrollLeft; $('gutter').scrollTop = t.scrollTop; }
  function updatePos() {
    const t = $('src'), before = t.value.slice(0, t.selectionStart), line = before.split('\n').length, col = before.length - before.lastIndexOf('\n');
    $('pos').textContent = line + '行 ' + col + '桁';
  }

  // ---- 文法チェック ----
  function check(quiet) {
    if (!cur) return true;
    const src = $('src').value, msg = $('msg');
    errLine = 0;
    try {
      if (cur.p.mode === 'Formula') { msg.textContent = '公式（Formula）は CALC と同じ書き方です'; msg.className = 'msg'; refresh(); return true; }
      const code = B.compile(src, true);
      for (const c of code) {
        for (const k of ['expr', 'from', 'to', 'step', 'x', 'y']) if (c[k]) tok(c[k], c.line);
        if (c.val && !/^"/.test(c.val)) tok(c.val, c.line);
        if (c.target && c.target.index) tok(c.target.index, c.line);
      }
      const missing = [...new Set(code.filter(c => c.type === 'prog' && !programs.some(p => p.name === c.name)).map(c => c.name))];
      if (missing.length) { msg.textContent = '⚠ 呼び出し先がありません：' + missing.join('、'); msg.className = 'msg ng'; }
      else { msg.textContent = quiet ? '' : '✔ 文法エラーはありません'; msg.className = 'msg ok'; }
      refresh(); return true;
    } catch (e) {
      errLine = e.line || 0;
      msg.textContent = '✖ ' + (e.line ? e.line + '行：' : '') + e.message + (e.stmt ? '「' + e.stmt + '」' : '');
      msg.className = 'msg ng';
      refresh(); return false;
    }
  }
  // 式として読めるか確かめる（変数は0で試算。0で割る等の計算エラーは無視し、書き方の誤りだけ知らせる）
  function tok(s, line) {
    const vars = { Ans: 0, __z: [], __dim: 9999 };
    for (const L of E.LETTERS) vars[L] = 1;
    try { E.evaluate(s, { vars, angle: 'Deg', disp: { mode: 'Norm', n: 1 }, getkey: () => 0 }); }
    catch (e) { if (e.kind === 'Syntax ERROR' || !e.kind) { e.line = line; throw e; } }
  }
  function gotoLine(n) {
    const t = $('src'), ls = t.value.split('\n');
    const pos = ls.slice(0, n - 1).join('\n').length + (n > 1 ? 1 : 0);
    t.focus(); t.setSelectionRange(pos, pos + (ls[n - 1] || '').length);
    t.scrollTop = Math.max(0, (n - 5) * parseFloat(getComputedStyle(t).lineHeight));
    updatePos();
  }

  // ---- 入力の手助け ----
  // 文字を入れる（Ctrl+Z で戻せるよう execCommand を使う）。| はカーソル位置。
  function insert(text) {
    const t = $('src');
    t.focus();
    const k = text.indexOf('|'); const plain = text.replace('|', '');
    const start = t.selectionStart;
    if (!document.execCommand('insertText', false, plain)) t.setRangeText(plain, t.selectionStart, t.selectionEnd, 'end');
    if (k >= 0) { t.setSelectionRange(start + k, start + k); }
    onEdit();
  }
  const SNIP = {
    if: 'If |\nThen \nIfEnd', ife: 'If |\nThen \nElse \nIfEnd', for: 'For 1→I To |\n\nNext', while: 'While |\n\nWhileEnd', do: 'Do\n|\nLpWhile ',
    lbl: 'Lbl |', goto: 'Goto |', prog: 'Prog "|"', loc: 'Locate 1,1,|', cls: 'Cls', ret: 'Return', inp: '"|"?→', key: 'Lbl 1:Getkey→K\nK=0⇒Goto 1', dms: '▸DMS'
  };
  function expandSnippet() {
    const t = $('src'), a = t.selectionStart, before = t.value.slice(0, a);
    const m = before.match(/([a-z]+)$/i);
    if (!m || !SNIP[m[1].toLowerCase()]) return false;
    t.setSelectionRange(a - m[1].length, a);
    insert(SNIP[m[1].toLowerCase()]);
    return true;
  }
  // 打った2文字を記号へ（文字列の中は変えない）
  const PAIR = { '->': '→', '=>': '⇒', '>=': '≥', '<=': '≤', '<>': '≠', '!=': '≠' };
  const SINGLE = { '*': '×', '/': '÷' };
  function autoReplace(e) {
    if (!$('optAuto').checked || e.inputType !== 'insertText' || !e.data) return;
    const t = $('src'), a = t.selectionStart, v = t.value;
    const lineStart = v.lastIndexOf('\n', a - 1) + 1;
    if ((v.slice(lineStart, a).match(/"/g) || []).length % 2) return; // 文字列の中
    const two = v.slice(a - 2, a);
    if (PAIR[two]) { t.setSelectionRange(a - 2, a); insert(PAIR[two]); return; }
    const one = v.slice(a - 1, a);
    if (SINGLE[one]) { t.setSelectionRange(a - 1, a); insert(SINGLE[one]); }
  }

  // ショートカット（Alt＋キー）。e.code で判定するので日本語キーボードでも同じ。
  const ALT = {
    KeyR: ['→', '代入'], KeyD: ['◢', '表示して止める'], KeyT: ['⇒', '条件が真なら次を実行'], KeyQ: ['?→', '入力'],
    KeyN: ['≠', ''], Comma: ['≤', ''], Period: ['≥', ''], KeyX: ['×', ''], Slash: ['÷', ''],
    KeyP: ['π', ''], KeyS: ['√(', ''], Digit2: ['²', ''], Digit3: ['³', ''], Minus: ['⁻¹', ''],
    KeyM: ['▸DMS', '度分秒で表示'], KeyO: ['°', '度分秒の入力'], KeyE: ['ᴇ', '×10ⁿ'], KeyF: ['⌟', '分数'],
    KeyZ: ['Z[|]', '配列'], KeyI: ['If |\nThen \nElse \nIfEnd', 'If ブロック'], KeyL: ['For 1→I To |\n\nNext', 'For ブロック'],
    KeyW: ['While |\n\nWhileEnd', 'While ブロック'], KeyG: ['Goto ', ''], KeyB: ['Lbl ', ''], KeyC: ['Locate 1,1,|', ''],
    KeyK: ['Getkey', ''], KeyJ: ['Prog "|"', 'サブルーチン'], KeyA: [' And ', ''], KeyU: [' Or ', '']
  };
  const keyLabel = code => 'Alt+' + (code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : { Comma: ',', Period: '.', Slash: '/', Minus: '-' }[code] || code);

  function onEdit() { if (errLine) { errLine = 0; $('msg').textContent = ''; } refresh(); scheduleSave(); }

  // ---- パレット ----
  const PAL = {
    cmd: [
      ['入力・代入・表示', 'g2', [['?→', '入力 ?→A', 'KeyQ'], ['"|"?→', '"文字"?→A 入力'], ['→', '代入', 'KeyR'], ['◢', '表示して止める', 'KeyD'], ['"|"', '文字を表示'], [':', '区切り'], ['Cls', '画面を消す'], ['Locate 1,1,|', '位置を決めて表示', 'KeyC']]],
      ['条件', 'g2', [['If |\nThen \nIfEnd', 'If〜Then〜IfEnd'], ['If |\nThen \nElse \nIfEnd', 'If〜Else〜IfEnd', 'KeyI'], ['⇒', '真なら次を実行', 'KeyT'], ['Then ', 'Then'], ['Else ', 'Else'], ['IfEnd', 'IfEnd']]],
      ['繰り返し', 'g2', [['For 1→I To |\n\nNext', 'For〜Next', 'KeyL'], [' Step ', 'Step'], ['While |\n\nWhileEnd', 'While〜WhileEnd', 'KeyW'], ['Do\n|\nLpWhile ', 'Do〜LpWhile'], ['Break', 'ループを抜ける'], ['Isz |', '1足して0ならとばす'], ['Dsz |', '1引いて0ならとばす']]],
      ['ジャンプ・サブルーチン', 'g2', [['Lbl |', 'ラベル', 'KeyB'], ['Goto |', 'ラベルへ', 'KeyG'], ['Prog "|"', 'サブルーチン', 'KeyJ'], ['Return', '戻る'], ['Stop', '終了'], ['Getkey', '押したキー', 'KeyK']]],
      ['比較・論理', 'g4', [['=', '等しい'], ['≠', '', 'KeyN'], ['>', ''], ['≥', '', 'Period'], ['<', ''], ['≤', '', 'Comma'], [' And ', 'And', 'KeyA'], [' Or ', 'Or', 'KeyU'], [' Xor ', 'Xor'], ['Not(', 'Not']]],
      ['設定・メモリー', 'g3', [['Deg', '度'], ['Rad', 'ラジアン'], ['Gra', 'グラード'], ['Fix |', '小数桁'], ['Sci |', '有効桁'], ['Norm 1', '通常'], ['Z[|]', '配列', 'KeyZ'], ['|→DimZ', '配列確保'], ['ClrMemory', '変数0']]]
    ],
    fn: [
      ['三角・指数・対数', 'g3', [['sin(', ''], ['cos(', ''], ['tan(', ''], ['sin⁻¹(', ''], ['cos⁻¹(', ''], ['tan⁻¹(', ''], ['log(', ''], ['ln(', ''], ['e^(', ''], ['10^(', ''], ['√(', '', 'KeyS'], ['∛(', ''], ['²', '', 'Digit2'], ['³', '', 'Digit3'], ['^(', ''], ['⁻¹', '逆数', 'Minus'], ['ˣ√(', ''], ['!', '階乗']]],
      ['座標・角度', 'g3', [['Pol(', '直→極'], ['Rec(', '極→直'], ['▸DMS', '度分秒で', 'KeyM'], ['°', '度分秒', 'KeyO'], ['π', '', 'KeyP'], ['ᴇ', '×10ⁿ', 'KeyE']]],
      ['数値', 'g3', [['Abs(', '絶対値'], ['Int(', '整数部'], ['Intg(', '以下の整数'], ['Frac(', '小数部'], ['Rnd(', '表示桁で丸め'], ['Ran#', '乱数'], ['RanInt#(', '整数乱数'], ['ℙ', 'nPr'], ['ℂ', 'nCr'], ['⌟', '分数', 'KeyF'], ['Ans', '直前の答'], ['GCD(', '']]],
      ['四則', 'g4', [['×', '', 'KeyX'], ['÷', '', 'Slash'], ['+', ''], ['-', '']]]
    ]
  };
  function renderPalette(kind) {
    document.querySelectorAll('[data-pal]').forEach(b => b.classList.toggle('on', b.dataset.pal === kind));
    const box = $('pal');
    if (kind === 'keys') { box.innerHTML = keysHelp(); return; }
    box.innerHTML = '';
    for (const [title, cls, items] of PAL[kind]) {
      const h = document.createElement('h4'); h.textContent = title; box.append(h);
      const g = document.createElement('div'); g.className = 'pal-grid ' + cls;
      for (const [ins, desc, sc] of items) {
        const b = document.createElement('button'); b.type = 'button';
        const shown = ins.replace('|', '').split('\n')[0].trim() || ins.trim();
        b.innerHTML = '<b>' + esc(shown) + '</b>' + (desc && desc !== shown ? '<small>' + esc(desc) + '</small>' : '') + (sc ? '<kbd>' + keyLabel(sc) + '</kbd>' : '');
        b.title = (desc || shown) + (sc ? '（' + keyLabel(sc) + '）' : '');
        b.onmousedown = e => e.preventDefault(); // 編集欄のカーソルを保つ
        b.onclick = () => insert(ins);
        g.append(b);
      }
      box.append(g);
    }
  }
  function keysHelp() {
    const rows = [];
    rows.push('<h4>打つとそのまま記号になる（記号に自動変換 ON のとき）</h4><table class="keys-table">');
    for (const [k, v] of Object.entries(PAIR)) rows.push('<tr><td><kbd class="k">' + esc(k) + '</kbd></td><td class="sym">' + v + '</td></tr>');
    rows.push('<tr><td><kbd class="k">*</kbd> <kbd class="k">/</kbd></td><td class="sym">× ÷</td></tr></table>');
    rows.push('<p class="note">文字列 "…" の中は変換しません。</p>');
    rows.push('<h4>Alt＋キー</h4><table class="keys-table">');
    for (const [code, [ins, desc]] of Object.entries(ALT)) rows.push('<tr><td><kbd class="k">' + keyLabel(code) + '</kbd></td><td><span class="sym">' + esc(ins.replace('|', '').split('\n')[0]) + '</span> ' + esc(desc) + '</td></tr>');
    rows.push('</table><h4>そのほか</h4><table class="keys-table">');
    for (const [k, d] of [['Ctrl+Enter', '◢ を入れて改行'], ['Tab', '短い語をひな形に展開（if ife for while do lbl goto prog loc inp key）'], ['Ctrl+S', '保存（自動でも保存）'], ['Ctrl+Shift+S', 'txt で書き出し'], ['Ctrl+O', 'ファイルを開く'], ['F5', '電卓で実行'], ['F7', '文法チェック'], ['Ctrl+Alt+N', '新規'], ['Ctrl+Z', '元に戻す']]) rows.push('<tr><td><kbd class="k">' + k + '</kbd></td><td>' + d + '</td></tr>');
    rows.push('</table>');
    return rows.join('');
  }

  // ---- 新規・名前・削除 ----
  const validName = n => /^[A-Z0-9 .\-_#&()+]{1,12}$/.test(n);
  function showNew() { $('newBox').hidden = false; $('newName').value = ''; $('newErr').textContent = ''; $('newName').focus(); }
  function createNew() {
    const name = $('newName').value.trim().toUpperCase();
    if (!validName(name)) { $('newErr').textContent = '半角の英大文字・数字・記号で12文字まで'; return; }
    if (programs.some(p => p.name === name)) { $('newErr').textContent = '同じ名前があります'; return; }
    const mode = document.querySelector('[name=newMode]:checked').value;
    const p = { name, mode, source: mode === 'Formula' ? '"' + name + '":S=A×B' : '' };
    programs.push(p); writePrograms();
    $('newBox').hidden = true;
    openProgram(p);
  }
  function rename() {
    if (!cur) return;
    const name = $('pName').value.trim().toUpperCase();
    if (name === cur.p.name) return;
    if (!validName(name)) { toast('名前は半角の英大文字・数字・記号で12文字まで'); $('pName').value = cur.p.name; return; }
    if (programs.some(p => p.name === name)) { toast('同じ名前があります'); $('pName').value = cur.p.name; return; }
    const old = cur.p.name;
    cur.p.name = name; $('pName').value = name;
    saveNow('名前を ' + old + ' → ' + name + ' に変えました（Prog "' + old + '" で呼んでいる所は直してください）');
  }
  function removeCurrent() {
    const p = cur.p;
    programs = programs.filter(x => x !== p);
    cur = null; writePrograms();
    $('delBox').hidden = true;
    toast(p.name + ' を削除しました');
    if (programs.length) openProgram(programs.slice().sort((a, b) => a.name.localeCompare(b.name, 'en'))[0]);
    else { $('src').value = ''; $('pName').value = ''; refresh(); renderList(); }
  }

  // ---- ファイル ----
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = name.replace(/[<>:"/\\|?*]/g, '_');
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  // CcEditor と同じ UTF-8（BOM付き）・CRLF
  const exportOne = p => download(p.name + '.txt', '﻿' + p.source.replace(/\r?\n/g, '\r\n'));
  // 全部を txt にして zip 1 つにまとめる（ファイルがたくさん落ちてこないように）
  function exportAllZip() {
    saveNow();
    if (!programs.length) { toast('プログラムがありません'); return; }
    const used = new Set();
    const files = programs.map(p => {
      let n = p.name.replace(/[<>:"/\|?*]/g, '_') || 'NONAME', k = 2;
      const base = n;
      while (used.has(n.toUpperCase())) n = base + '_' + k++;
      used.add(n.toUpperCase());
      return { name: 'txt/' + n + '.txt', data: '﻿' + p.source.replace(/\r?\n/g, '\r\n') };
    });
    // 電卓用の .ccl も一緒に（書き出せないものは一覧にする）
    const chk = FxCcl.check(programs), ng = [];
    for (const p of programs) {
      const r = FxCcl.toCcl(p);
      if (r.ok) files.push({ name: 'ccl/' + r.fileName, data: r.bytes });
      else ng.push(p.name + '：' + r.problems.filter(x => x.level === 'error').map(x => (x.line ? x.line + '行 ' : '') + x.msg).join('／'));
    }
    const warn = chk.list.flatMap(c => c.problems.filter(x => x.level === 'warn').map(x => c.name + '：' + x.msg));
    if (ng.length || warn.length || chk.over) {
      files.push({ name: 'ccl/書き出しの注意.txt', data: '﻿' + ['電卓用（.ccl）の書き出しの注意', '',
        ...(ng.length ? ['書き出せなかったプログラム：', ...ng, ''] : []),
        ...(warn.length ? ['注意：', ...warn, ''] : []),
        ...(chk.over ? ['全部で約 ' + chk.total + ' バイト。電卓のメモリー（約 ' + chk.memory + ' バイト）に入りきらない可能性があります。'] : [])].join('\r\n') });
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(FxZip.make(files));
    a.download = 'fx5800p-programs-' + new Date().toISOString().slice(0, 10) + '.zip';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast(programs.length + ' 本を zip にまとめて書き出しました（txt と .ccl）' + (ng.length ? '。.ccl にできないもの ' + ng.length + ' 本' : ''));
  }
  // 1 本を電卓用（.ccl）で書き出す。書き出せない所があれば知らせる
  function exportCcl() {
    if (!cur) return;
    saveNow();
    const p = cur.p, r = FxCcl.toCcl(p);
    const errs = r.problems.filter(x => x.level === 'error'), warns = FxCcl.check(programs).list.find(c => c.name === p.name).problems.filter(x => x.level === 'warn');
    if (errs.length) {
      $('msg').textContent = '✖ 電卓用に書き出せません：' + errs.map(x => (x.line ? x.line + '行 ' : '') + x.msg).slice(0, 3).join('／');
      $('msg').className = 'msg ng';
      if (errs[0].line) gotoLine(errs[0].line);
      return;
    }
    $('msg').textContent = ''; $('msg').className = 'msg';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([r.bytes], { type: 'application/octet-stream' }));
    a.download = r.fileName;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast(r.fileName + '（' + r.size + ' バイト）を書き出しました' + (warns.length ? '。注意：' + warns.map(x => x.msg).join('／') : ''));
  }
  async function readText(f) {
    const buf = await f.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
    catch { return new TextDecoder('shift_jis').decode(buf); }
  }
  async function openFiles(files) {
    const got = new Map(), bad = [];
    for (const f of files) {
      try {
        const dec = await FxImport.decodeFile(f);
        const item = dec ? Object.assign({ name: dec.name, mode: dec.mode, source: dec.source }, dec.tail ? { tail: dec.tail } : {})
          : { name: f.name.replace(/\.[^.]+$/, '').replace(/\s+(COMP|BASE-N|FORMULA)(\s+[0-9A-F]+)?$/i, '').trim(), mode: 'COMP', source: (await readText(f)).replace(/\r\n?/g, '\n').replace(/\n+$/, '') };
        if (dec && dec.unknown) bad.push(dec.name + ' に読めない記号 ' + dec.unknown + ' 個');
        const o = got.get(item.name);
        if (!o || f.lastModified > o.t || (f.lastModified === o.t && /\.ccl$/i.test(f.name))) got.set(item.name, { ...item, t: f.lastModified });
      } catch (e) { bad.push(f.name + '：' + e.message); }
    }
    let added = 0, replaced = 0, last = null;
    for (const g of got.values()) {
      const p = { name: g.name, mode: g.mode, source: g.source };
      if (g.tail) p.tail = g.tail;   // 電卓から読んだときの最後の空の改行の数（.ccl を元と同じに書き出すため）
      const i = programs.findIndex(x => x.name === p.name);
      if (i >= 0) { programs[i] = p; replaced++; } else { programs.push(p); added++; }
      last = p;
    }
    writePrograms();
    toast('読み込み：新規 ' + added + ' 本・上書き ' + replaced + ' 本' + (bad.length ? '　注意：' + bad.join('、') : ''), bad.length ? 8000 : 3500);
    if (last) openProgram(last); else renderList();
  }
  function runInCalc() {
    if (!cur) return;
    saveNow();
    window.open('./?run=' + encodeURIComponent(cur.p.name), 'fx5800p-calc');
  }

  let toastTimer;
  function toast(t, ms) { const n = $('toast'); n.textContent = t; n.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => n.classList.remove('show'), ms || 3000); }

  // ---- 入力候補（打ち始めると候補を出し、Tab で決める） ----
  // [表示, 入れる文字（| はカーソル位置）, 説明, 別名]
  let ac = { list: [], sel: 0, start: 0, open: false };
  let charW = 0;
  function measure() {
    const s = document.createElement('span');
    s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' + getComputedStyle($('src')).font;
    s.textContent = 'MMMMMMMMMM'; document.body.append(s); charW = s.getBoundingClientRect().width / 10; s.remove();
  }
  function hideAC() { ac.open = false; $('ac').hidden = true; }
  function updateAC() {
    const t = $('src'), a = t.selectionStart;
    if (a !== t.selectionEnd) return hideAC();
    const v = t.value, ls = v.lastIndexOf('\n', a - 1) + 1, before = v.slice(ls, a);
    if ((before.match(/"/g) || []).length % 2) return hideAC();
    const m = before.match(/[A-Za-z#]+$/);
    if (!m) return hideAC();
    const list = FxComplete.match(m[0]);
    if (!list.length) return hideAC();
    ac = { list, sel: 0, start: a - m[0].length, open: true };
    const box = $('ac');
    box.innerHTML = ac.list.map((x, i) => '<div class="it' + (i ? '' : ' on') + '" data-i="' + i + '"><b>' + esc(x[0]) + '</b><span>' + esc(x[2]) + '</span></div>').join('') +
      '<div class="hint">Tab で決定　↑↓ で選ぶ　Esc で閉じる</div>';
    if (!charW) measure();
    const line = v.slice(0, a).split('\n').length - 1, col = Array.from(before).length - m[0].length;
    const lh = parseFloat(getComputedStyle(t).lineHeight);
    box.style.left = Math.max(0, 14 + col * charW - t.scrollLeft) + 'px';
    box.style.top = (10 + (line + 1) * lh - t.scrollTop + 2) + 'px';
    box.hidden = false;
    // 下にはみ出すなら上に出す
    const area = box.parentElement.getBoundingClientRect(), r = box.getBoundingClientRect();
    if (r.bottom > area.bottom) box.style.top = (10 + line * lh - t.scrollTop - r.height - 2) + 'px';
  }
  function markAC() { $('ac').querySelectorAll('.it').forEach((n, i) => n.classList.toggle('on', i === ac.sel)); }
  function acceptAC(i) {
    const x = ac.list[i ?? ac.sel]; if (!x) return;
    const t = $('src'); t.setSelectionRange(ac.start, t.selectionStart);
    hideAC(); insert(x[1]);
  }

  // ---- キー操作 ----
  function onKey(e) {
    if (ac.open && document.activeElement === $('src')) {
      if (e.key === 'Tab') { e.preventDefault(); acceptAC(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); ac.sel = (ac.sel + 1) % ac.list.length; markAC(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); ac.sel = (ac.sel - 1 + ac.list.length) % ac.list.length; markAC(); return; }
      if (e.key === 'Escape') { e.preventDefault(); hideAC(); return; }
      if (e.key === 'Enter' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') hideAC();
    }
    if (e.key === 'F5') { e.preventDefault(); runInCalc(); return; }
    if (e.key === 'F7') { e.preventDefault(); check(false); return; }
    if (e.key === 'F1') { e.preventDefault(); renderPalette('keys'); return; }
    if (e.ctrlKey && !e.altKey && e.code === 'KeyS') { e.preventDefault(); if (e.shiftKey) { if (cur) { saveNow(); exportOne(cur.p); } } else saveNow('保存しました'); return; }
    if (e.ctrlKey && e.code === 'KeyO') { e.preventDefault(); $('fileIn').click(); return; }
    if (e.ctrlKey && e.altKey && e.code === 'KeyN') { e.preventDefault(); showNew(); return; }
    if (document.activeElement !== $('src')) return;
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); insert('◢\n'); return; }
    // Backspace：直前が命令（Prog 、sin( など）なら丸ごと消す（実機の DEL と同じ）
    if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      const t = $('src'), a = t.selectionStart;
      if (a === t.selectionEnd && a > 0) {
        const n = FxComplete.tokenBefore(t.value.slice(0, a));
        if (n > 1) { e.preventDefault(); t.setSelectionRange(a - n, a); if (!document.execCommand('delete')) t.setRangeText('', a - n, a, 'end'); onEdit(); hideAC(); return; }
      }
    }
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); if (!expandSnippet()) insert(''); return; }
    if (e.altKey && !e.ctrlKey && ALT[e.code]) { e.preventDefault(); insert(ALT[e.code][0]); }
  }

  function init() {
    load();
    renderPalette('cmd');
    document.querySelectorAll('[data-pal]').forEach(b => { b.onclick = () => renderPalette(b.dataset.pal); });
    const t = $('src');
    t.addEventListener('input', e => { autoReplace(e); onEdit(); if (e.inputType && e.inputType.startsWith('insert')) updateAC(); else hideAC(); });
    t.addEventListener('scroll', () => { syncScroll(); hideAC(); });
    t.addEventListener('blur', () => setTimeout(hideAC, 150));
    t.addEventListener('mousedown', hideAC);
    $('ac').addEventListener('mousedown', e => { e.preventDefault(); const it = e.target.closest('.it'); if (it) acceptAC(Number(it.dataset.i)); });
    ['click', 'keyup', 'select'].forEach(ev => t.addEventListener(ev, updatePos));
    document.addEventListener('keydown', onKey);
    $('search').oninput = renderList;
    $('bNew').onclick = showNew; $('newOk').onclick = createNew; $('newCancel').onclick = () => { $('newBox').hidden = true; };
    $('newName').onkeydown = e => { if (e.key === 'Enter') createNew(); if (e.key === 'Escape') $('newBox').hidden = true; };
    $('bOpen').onclick = () => $('fileIn').click();
    $('fileIn').onchange = e => { openFiles([...e.target.files]); e.target.value = ''; };
    $('bSave').onclick = () => saveNow('保存しました');
    $('bCheck').onclick = () => check(false);
    $('bRun').onclick = runInCalc;
    $('bExport').onclick = () => { if (cur) { saveNow(); exportOne(cur.p); } };
    $('bExportAll').onclick = exportAllZip;
    $('bCcl').onclick = exportCcl;
    $('bKeys').onclick = () => renderPalette('keys');
    $('pName').onchange = rename;
    $('pName').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('src').focus(); } };
    $('pMode').onclick = () => { if (!cur) return; cur.p.mode = cur.p.mode === 'Formula' ? 'COMP' : 'Formula'; $('pMode').textContent = cur.p.mode === 'Formula' ? '公式（Formula）' : '通常（COMP）'; saveNow(); check(true); };
    $('pMode').title = 'クリックで COMP ⇔ Formula を切り替え';
    $('bDelete').onclick = () => { if (cur) $('delBox').hidden = false; };
    $('delYes').onclick = removeCurrent; $('delNo').onclick = () => { $('delBox').hidden = true; };
    $('msg').onclick = () => { if (errLine) gotoLine(errLine); };
    // 電卓の画面で変えたときも一覧を合わせる
    window.addEventListener('storage', e => { if (e.key === KEY) { const name = cur && cur.p.name; load(); cur = null; const p = programs.find(x => x.name === name); if (p) openProgram(p); else renderList(); } });
    window.addEventListener('beforeunload', () => saveNow());
    let lastName = null; try { lastName = localStorage.getItem(KEY + '-editor-last'); } catch { /* 無視 */ }
    // 電卓の PROG → EDIT（?p=名前）・NEW（?new=1）から開いたとき
    const q = new URLSearchParams(location.search), want = q.get('p');
    if (want) lastName = want;
    const first = programs.find(p => p.name === lastName) || programs.slice().sort((a, b) => a.name.localeCompare(b.name, 'en'))[0];
    if (first) openProgram(first); else { renderList(); refresh(); }
    if (q.has('new') || !first) showNew();
    // 電卓から何度開いても、このタブで続けて開く
    window.addEventListener('focus', () => {
      const p2 = new URLSearchParams(location.search);
      if (p2.toString()) history.replaceState(null, '', location.pathname);
    });
  }
  // ---- 文字の大きさ（Ctrl＋ホイール・Ctrl＋0） ----
  const FS_DEF = 15, FS_MIN = 10, FS_MAX = 32;
  let fontSize = FS_DEF;
  function setFont(n, quiet) {
    fontSize = Math.min(FS_MAX, Math.max(FS_MIN, Math.round(n)));
    document.documentElement.style.setProperty('--code-size', fontSize + 'px');
    charW = 0; hideAC(); syncScroll();
    $('fsz').textContent = '文字 ' + fontSize + 'px';
    try { localStorage.setItem(KEY + '-editor-font', String(fontSize)); } catch { /* 無視 */ }
    if (!quiet) toast('文字の大きさ ' + fontSize + 'px');
  }
  function bindFont() {
    let saved = NaN; try { saved = Number(localStorage.getItem(KEY + '-editor-font')); } catch { /* 無視 */ }
    setFont(Number.isFinite(saved) && saved ? saved : FS_DEF, true);
    // ブラウザ全体の拡大は止めて、プログラムの欄だけを大きくする
    $('codeWrap').addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setFont(fontSize + (e.deltaY < 0 ? 2 : -2));
    }, { passive: false });
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (!e.target.closest || !e.target.closest('#codeWrap')) return;
      if (e.key === '0') { e.preventDefault(); setFont(FS_DEF); }
      else if (e.key === '+' || e.key === '=' || e.key === ';') { e.preventDefault(); setFont(fontSize + 2); }
      else if (e.key === '-') { e.preventDefault(); setFont(fontSize - 2); }
    }, true);
    $('fsz').addEventListener('click', () => setFont(FS_DEF));
  }
  window.addEventListener('DOMContentLoaded', () => { bindFont(); init(); });
})();
