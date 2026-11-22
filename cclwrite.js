// 電卓（実機 fx-5800P）へ送れる形で書き出す：.ccl（CcLinker）と .cce（CcEditor）
//   形式は 2026-11-22 に手元の .ccl 11 本で調べた（仕様書_測設.md 10.2）。実機での確認は利用者
//   使い方：
//     const r = FxCcl.toCcl({ name, mode: 'COMP', source });   // → { ok, bytes, size, fileName, problems }
//     const t = FxCcl.toCce({ name, source });                  // → { ok, text, problems }
//     const list = FxCcl.check(programs);                       // → [{ name, size, problems: [{ level, msg }] }]
(function (root) {
  'use strict';
  const IM = root.FxImport;
  const MEMORY = 28500;            // 実機のプログラム領域（おおよそ）
  const NAME_MAX = 12;

  // ---- 文字 → 命令コードの表（import.js の表を逆にする） ----
  let table = null;
  function build() {
    const map = new Map();
    const add = (text, bytes) => { if (!map.has(text)) map.set(text, bytes); };
    // 同じ表記が 2 つあるもの：° は 0x8C、θ・- は場所で決める（encode の中）
    add('°', [0x8C]);
    for (const [k, v] of Object.entries(IM.T1)) { if (v === '-' || v === 'θ') continue; add(v, [Number(k)]); }
    for (const [a, sub] of Object.entries(IM.T2)) for (const [b, v] of Object.entries(sub)) { if (v === 'θ') continue; add(v, [Number(a), Number(b)]); }
    // 行の終わりで後ろの空白が消えた命令（Then・Else・Lbl など）と、前後の空白なしで書いた To・Step・And・Or・Xor
    const extra = [];
    for (const [t, b] of map) {
      const trimmed = t.trim();
      if (trimmed !== t && trimmed && !map.has(trimmed)) extra.push([trimmed, b, t]);
    }
    table = {
      map,
      list: [...map.entries()].map(([t, b]) => ({ t, b, exact: true })).concat(extra.map(([t, b, full]) => ({ t, b, exact: false, full })))
        .sort((p, q) => q.t.length - p.t.length || (q.exact ? 1 : 0) - (p.exact ? 1 : 0))
    };
    return table;
  }

  // 文字列の中で使える記号（命令のコードになる文字）
  const QUOTE_SYM = { '→': 0x0E, '⇒': 0x13, '◢': 0x0C, 'θ': [0xE6, 0x47], '-': 0x87, '−': 0x87, '×': 0xA9, '÷': 0xB9, '+': 0x89, '²': 0x8B, 'π': 0xD0, '≤': 0x10, '≠': 0x11, '≥': 0x12, '°': 0x8C };

  // 前の命令から見て「-」が負の記号（(−)）になる場所か
  function unaryAt(prev) {
    if (prev == null) return true;
    // 数・変数・閉じかっこ・² などの後なら引き算
    if ((prev >= 0x30 && prev <= 0x39) || (prev >= 0x41 && prev <= 0x5A) || prev === 0x29 || prev === 0x2E || prev === 0x5D || prev === 0x7D) return false;
    if ([0x8B, 0x9B, 0xAB, 0x8C, 0x9C, 0xCE, 0xC0, 0xC1, 0xD0, 0x0F].includes(prev)) return false;   // ² ⁻¹ ! ° θ Ans Ran# π ᴇ の後
    return true;
  }

  // プログラムの文字 → 命令コードのバイト列（終わりの 0x00 は付けない）
  function encode(source) {
    const T = table || build();
    const src = String(source || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    const out = [], problems = [];
    let q = false, i = 0, line = 1;
    const prev = () => out.length ? out[out.length - 1] : null;
    const bad = (msg) => { if (problems.length < 50) problems.push({ level: 'error', line, msg }); };
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\n') { out.push(0x0D); i++; line++; continue; }
      if (ch === '"') { out.push(0x22); q = !q; i++; continue; }
      if (q) {
        const sym = QUOTE_SYM[ch];
        if (sym !== undefined) { out.push(...[].concat(sym)); i++; continue; }
        const c = ch.charCodeAt(0);
        if (c >= 0x20 && c < 0x7F && ch !== '\\') { out.push(c); i++; continue; }
        bad('文字列の中の「' + ch + '」は電卓では使えません（半角の英数字と記号だけ）');
        out.push(0x3F); i++; continue;
      }
      // 文字列の外
      if (ch === '-' || ch === '−') { out.push(unaryAt(prev()) ? 0x87 : 0x99); i++; continue; }
      if (ch === 'θ') { out.push(0xCE); i++; continue; }
      let hit = null;
      for (const tk of T.list) {
        if (!src.startsWith(tk.t, i)) continue;
        if (!tk.exact) {
          // 空白を省いた書き方は、行の終わり・: の前（Then など）か、前後が空白・数・変数のとき（To など）だけ
          const after = src[i + tk.t.length];
          const lead = tk.full.startsWith(' '), tail = tk.full.endsWith(' ');
          if (tail && !lead && !(after === undefined || after === '\n' || after === ':' || after === ' ')) continue;
          if (lead && /[A-Za-z]/.test(src[i - 1] || '') && /[a-z]/.test(src[i - 1] || '')) continue;
        }
        hit = tk; break;
      }
      if (hit) {
        out.push(...hit.b); i += hit.t.length;
        // 空白を省いた To などの後ろの空白は 1 つ読み飛ばす（命令の中に含まれるため）
        if (!hit.exact && hit.full.endsWith(' ') && src[i] === ' ') i++;
        continue;
      }
      const c = ch.charCodeAt(0);
      // 大文字で始まり小文字が続く英単語（DimZ・Println など）は、表にない命令
      const word = src.slice(i).match(/^[A-Z][A-Za-z]*[a-z][A-Za-z]*/);
      if (word) {
        bad('「' + word[0] + '」は電卓の命令として書き出せません（アプリだけの命令か、まだ表にない命令）');
        i += word[0].length; out.push(0x3F); continue;
      }
      // 半角の英大文字（変数）・数字・記号
      if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || '.,:()[]{}=<>?!&\'%$#@ '.includes(ch)) {
        out.push(c); i++; continue;
      }
      if (/[a-z]/.test(ch)) {
        const m = src.slice(i).match(/^[A-Za-z]+/);
        bad('「' + (m ? m[0] : ch) + '」は電卓の命令として書き出せません（アプリだけの命令か、まだ表にない命令）');
        i += m ? m[0].length : 1; out.push(0x3F); continue;
      }
      bad('「' + ch + '」は電卓では使えない文字です');
      out.push(0x3F); i++;
    }
    // 英大文字が 2 つ以上続くのは、命令の打ち間違いかアプリだけの命令の可能性（変数は 1 文字）
    return { bytes: out, problems };
  }

  // ---- .ccl ----
  const hex = (n, w) => n.toString(16).toUpperCase().padStart(w, '0');
  const ascii = s => Array.from(s, c => c.charCodeAt(0));
  function checksum(arr) { let s = 0; for (const b of arr) s = (s + b) & 0xFF; return hex((0x100 - s) & 0xFF, 2); }
  // まとまり（先頭の種類バイト＋中身＋検査値）を 63 バイトずつの区切りにする
  function chunks(rec) {
    const out = [];
    for (let i = 0; i < rec.length; i += 63) {
      const part = rec.slice(i, i + 63), more = i + 63 < rec.length;
      out.push(part.length | (more ? 0x80 : 0), ...part);
    }
    return out;
  }
  function checkName(name) {
    const p = [];
    if (!name) p.push({ level: 'error', msg: '名前がありません' });
    if (name.length > NAME_MAX) p.push({ level: 'error', msg: '名前は ' + NAME_MAX + ' 文字までです' });
    if (/[^A-Z0-9 .~+\-×÷{}'"[\]θ_]/.test(name)) p.push({ level: 'error', msg: '名前に電卓で使えない文字があります（英大文字・数字・一部の記号だけ）' });
    return p;
  }
  function toCcl(prog) {
    const name = String(prog.name || '').trim(), mode = 'COMP';
    const problems = checkName(name);
    if (prog.mode && prog.mode !== 'COMP') problems.push({ level: 'error', msg: '公式（Formula）のプログラムは、まだ .ccl に書き出せません（形式が分からないため）' });
    const enc = encode(prog.source);
    problems.push(...enc.problems);
    // prog.tail：最後に付ける空の改行の数（電卓から読んだプログラムを元の形のまま書き出すため）
    const raw = enc.bytes.concat(new Array(Math.max(0, prog.tail | 0)).fill(0x0D), [0x00]);
    const size = raw.length;
    if (size > MEMORY) problems.push({ level: 'error', msg: '大きすぎます（' + size + ' バイト。電卓は全体で約 ' + MEMORY + ' バイト）' });
    // 中身：0x20 より小さいコードは \ ＋（コード＋0x20）
    const esc = [];
    for (const b of raw) { if (b < 0x20) esc.push(0x5C, b + 0x20); else esc.push(b); }
    const nm = ascii(name);
    const headText = ascii('2510' + hex(0x18 + nm.length + mode.length, 3) + '000B' + hex(size, 8) + hex(nm.length, 4) + '00000400').concat(nm, ascii(mode));
    const head = [0x01].concat(headText, ascii(checksum(headText)));
    const dataBody = ascii('2510' + hex(esc.length + 8, 3) + '00010001').concat(esc);
    const data = [0x02].concat(dataBody, ascii(checksum(dataBody)));
    const bytes = new Uint8Array(chunks(head).concat(chunks(data)));
    return { ok: !problems.some(x => x.level === 'error'), bytes, size, fileName: name + ' ' + mode + ' ' + hex(size, 4) + '.ccl', problems };
  }

  // ---- .cce（CcEditor の RTF） ----
  //   Shift_JIS にある文字は \'xx、ない記号（◢ など）は \uNNNN? で書く
  function toCce(prog) {
    const problems = encode(prog.source).problems;
    const sj = root.FxPoints && root.FxPoints.encodeSjis;
    let body = '';
    for (const ch of String(prog.source || '').replace(/\r\n?/g, '\n')) {
      if (ch === '\n') { body += '\\par\r\n'; continue; }
      const c = ch.charCodeAt(0);
      if (ch === '\\' || ch === '{' || ch === '}') { body += '\\' + ch; continue; }
      if (c >= 0x20 && c < 0x7F) { body += ch; continue; }
      const r = sj ? sj(ch) : { lost: 1 };
      if (!r.lost) { for (const b of r.bytes) body += "\\'" + b.toString(16).padStart(2, '0'); continue; }
      body += '\\u' + (c > 0x7FFF ? c - 0x10000 : c) + '?';
    }
    const text = '{\\rtf1\\ansi\\ansicpg932\\deff0\\deflang1033\\deflangfe1041{\\fonttbl{\\f0\\fnil\\fcharset128 MS UI Gothic;}}\r\n'
      + '\\viewkind4\\uc1\\pard\\lang1041\\f0\\fs20 ' + body + '\\par\r\n}\r\n';
    return { ok: !problems.some(x => x.level === 'error'), text, problems };
  }

  // ---- 書き出す前の点検 ----
  function check(programs) {
    const names = new Set(programs.map(p => p.name));
    let total = 0;
    const out = programs.map(p => {
      const r = toCcl(p);
      total += r.size + 16;
      const problems = r.problems.slice();
      // Prog "名前" の呼び出し先が一緒にあるか
      for (const m of String(p.source || '').matchAll(/Prog\s*"([^"]*)"/g)) {
        if (!names.has(m[1])) problems.push({ level: 'warn', msg: 'Prog "' + m[1] + '" を呼んでいますが、一緒に書き出す中にありません' });
      }
      return { name: p.name, size: r.size, ok: r.ok, problems };
    });
    return { list: out, total, memory: MEMORY, over: total > MEMORY };
  }

  root.FxCcl = { encode, toCcl, toCce, check, checksum, MEMORY };
})(typeof globalThis !== 'undefined' ? globalThis : window);
