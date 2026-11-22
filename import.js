// CcLinker の .ccl（電卓から吸い出したバイナリ）と CcEditor の .cce（書式付きテキスト）を読む
(function (root) {
  'use strict';

  // fx-5800P の命令コード（1バイト）
  const T1 = {
    0x0C: '◢', 0x0D: '\n', 0x0E: '→', 0x0F: 'ᴇ', 0x10: '≤', 0x11: '≠', 0x12: '≥', 0x13: '⇒',
    0x80: 'Pol(', 0x81: 'sin(', 0x82: 'cos(', 0x83: 'tan(', 0x85: 'ln(', 0x86: '√(', 0x87: '-', 0x88: 'ℙ', 0x89: '+',
    0x8B: '²', 0x8C: '°', 0x91: 'sin⁻¹(', 0x92: 'cos⁻¹(', 0x93: 'tan⁻¹(', 0x95: 'log(', 0x96: '∛(', 0x97: 'Abs(',
    0x98: 'ℂ', 0x99: '-', 0x9B: '⁻¹', 0x9C: '°',
    0xA0: 'Rec(', 0xA1: 'sinh(', 0xA2: 'cosh(', 0xA3: 'tanh(', 0xA5: 'e^(', 0xA6: 'Int(', 0xA7: 'Not ', 0xA8: '^(', 0xA9: '×', 0xAB: '!',
    0xB1: 'sinh⁻¹(', 0xB2: 'cosh⁻¹(', 0xB3: 'tanh⁻¹(', 0xB5: '10^(', 0xB6: 'Frac(', 0xB7: 'Neg(', 0xB8: 'ˣ√(', 0xB9: '÷', 0xBB: '⌟',
    0xC0: 'Ans', 0xC1: 'Ran#', 0xCE: 'θ', 0xD0: 'π', 0xD1: 'Cls', 0xD3: 'Rnd(', 0xD9: 'Norm ', 0xDA: 'Deg', 0xDB: 'Rad', 0xDC: 'Gra',
    0xDE: 'Intg(', 0xE2: 'Lbl ', 0xE3: 'Fix ', 0xE4: 'Sci ', 0xE8: 'Dsz ', 0xE9: 'Isz ', 0xEC: 'Goto ', 0xED: 'Prog '
  };
  // 2バイトの命令（先頭バイト → 2バイト目）
  const T2 = {
    0xF7: { 0x00: 'If ', 0x01: 'Then ', 0x02: 'Else ', 0x03: 'IfEnd', 0x04: 'For ', 0x05: ' To ', 0x06: ' Step ', 0x07: 'Next',
      0x08: 'While ', 0x09: 'WhileEnd', 0x0A: 'Do', 0x0B: 'LpWhile ', 0x0C: 'Return', 0x0D: 'Break', 0x0E: 'Stop', 0x10: 'Locate ' },
    0xF9: { 0x05: '▸DMS' },
    0x7F: { 0x87: 'RanInt#(', 0x8F: 'Getkey', 0xB0: ' And ', 0xB1: ' Or ', 0xB3: 'Not(', 0xB4: ' Xor ' },
    0xE6: { 0x47: 'θ' }
  };

  function records(bytes) {
    const recs = []; let cur = [], i = 0;
    while (i < bytes.length) {
      const L = bytes[i++], n = L & 0x7f;
      for (let k = 0; k < n && i < bytes.length; k++) cur.push(bytes[i++]);
      if (!(L & 0x80)) { recs.push(cur); cur = []; }
    }
    if (cur.length) recs.push(cur);
    return recs;
  }
  const ascii = a => String.fromCharCode(...a);

  function decodeCcl(buf) {
    const b = new Uint8Array(buf);
    const recs = records(b);
    if (recs.length < 2 || recs[0][0] !== 0x01) throw Error('.ccl の形式ではありません');
    const head = ascii(recs[0].slice(1));
    const nameLen = parseInt(head.slice(19, 23), 16);
    if (!Number.isFinite(nameLen)) throw Error('.ccl の見出しを読めません');
    const name = head.slice(31, 31 + nameLen);
    const modeText = head.slice(31 + nameLen, head.length - 2);
    const data = [];
    for (const r of recs.slice(1)) {
      if (r[0] !== 0x02) continue;
      const p = r.slice(16, r.length - 2);
      for (let i = 0; i < p.length; i++) {
        if (p[i] === 0x5c && i + 1 < p.length) { const c = p[++i]; data.push(c < 0x40 ? c - 0x20 : c); }
        else data.push(p[i]);
      }
    }
    let s = '', unknown = 0;
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      if (c === 0x00) break;
      if (T2[c]) { const t = T2[c][data[i + 1]]; i++; if (t !== undefined) s += t; else { s += '{' + hex(c) + hex(data[i]) + '}'; unknown++; } continue; }
      if (T1[c] !== undefined) { s += T1[c]; continue; }
      if (c >= 0x20 && c < 0x7f) { s += String.fromCharCode(c); continue; }
      s += '{' + hex(c) + '}'; unknown++;
    }
    // 最後の空の改行の数（読むと消えるので、書き出し直すときのために覚えておく）
    const tail = (s.match(/\n+$/) || [''])[0].length;
    return { name, mode: /FORM|FMLA/i.test(modeText) ? 'Formula' : 'COMP', source: tidy(s), unknown, modeText, tail };
  }
  const hex = n => n.toString(16).toUpperCase().padStart(2, '0');
  // 命令の後ろの余分な空白を整える
  function tidy(s) {
    return s.split('\n').map(l => {
      let q = false, out = '';
      for (const ch of l) { if (ch === '"') q = !q; out += ch; }
      return out.replace(/ +$/, '').replace(/^(Then|Else) $/, '$1');
    }).join('\n').replace(/\n+$/, '');
  }

  // ---- .cce（RTF） ----
  const CHARSET = { 0: 'windows-1252', 128: 'shift_jis', 129: 'euc-kr', 134: 'gbk', 136: 'big5', 161: 'windows-1253', 162: 'windows-1254', 204: 'windows-1251' };
  // CcEditor が記号の代わりに使う文字 → 電卓の表記
  const GLYPH = { '」': '⌟', '\u0000': '', '－': '-', '−': '-', '＋': '+', '×': '×', 'ｘ': '×', '÷': '÷', '／': '⌟', '→': '→', '⇒': '⇒', '◢': '◢', '▲': '◢', '≠': '≠', '≦': '≤', '≧': '≥', '≤': '≤', '≥': '≥', 'π': 'π', 'θ': 'θ', '√': '√', '²': '²', '³': '³', '°': '°', '↵': '', '↵': '' };
  function decodeCce(buf, fileName) {
    const t = new TextDecoder('latin1').decode(new Uint8Array(buf));
    const fonts = {};
    for (const m of t.matchAll(/\{\\f(\d+)[^;{}]*?\\fcharset(\d+)/g)) fonts[m[1]] = Number(m[2]);
    const start = t.indexOf('\\viewkind');
    if (!t.startsWith('{\\rtf') || start < 0) throw Error('.cce の形式ではありません');
    const body = t.slice(start);
    let font = '0', bytes = [], out = '';
    const flush = () => {
      if (!bytes.length) return;
      let enc = CHARSET[fonts[font]] || 'shift_jis';
      try { out += new TextDecoder(enc).decode(new Uint8Array(bytes)); } catch { out += new TextDecoder('shift_jis').decode(new Uint8Array(bytes)); }
      bytes = [];
    };
    for (let i = 0; i < body.length;) {
      const c = body[i];
      if (c === '\\') {
        if (body[i + 1] === "'") { bytes.push(parseInt(body.substr(i + 2, 2), 16)); i += 4; continue; }
        const m = body.slice(i).match(/^\\([a-z]+)(-?\d+)? ?/);
        if (m) {
          i += m[0].length;
          if (m[1] === 'f') { flush(); font = m[2]; }
          else if (m[1] === 'par') { flush(); out += '\n'; }
          else if (m[1] === 'u') { flush(); out += String.fromCharCode(((Number(m[2]) % 65536) + 65536) % 65536); if (body[i] === '?') i++; }
          continue;
        }
        flush(); out += body[i + 1]; i += 2; continue;
      }
      if (c === '{' || c === '}' || c === '\r' || c === '\n') { i++; continue; }
      flush(); out += c; i++;
    }
    flush();
    return { name: (fileName || '').replace(/\.[^.]+$/, ''), mode: 'COMP', source: normalizeGlyphs(out), unknown: 0 };
  }
  function normalizeGlyphs(s) {
    s = s.replace(/[↵]/g, '');
    // 上付きの「-1」を ⁻¹ に（cos-¹( などの崩れも含む）
    s = s.replace(/(sinh|cosh|tanh|sin|cos|tan)\s*[-－−]\s*[¹1₁]?\s*\(/g, '$1⁻¹(').replace(/(sinh|cosh|tanh|sin|cos|tan)⁻\s*[¹1]?\s*\(/g, '$1⁻¹(');
    let r = '';
    for (const ch of s) r += GLYPH[ch] !== undefined ? GLYPH[ch] : ch;
    return tidy(r.replace(/[ \t]+\n/g, '\n').replace(/\s+$/, ''));
  }

  // 拡張子で振り分ける
  async function decodeFile(file) {
    const buf = await file.arrayBuffer();
    const low = file.name.toLowerCase();
    if (low.endsWith('.ccl')) return decodeCcl(buf);
    if (low.endsWith('.cce')) return decodeCce(buf, file.name);
    return null;
  }

  root.FxImport = { decodeCcl, decodeCce, decodeFile, normalizeGlyphs, T1, T2 };   // T1・T2 は書き出し（cclwrite.js）でも使う
})(typeof globalThis !== 'undefined' ? globalThis : window);
