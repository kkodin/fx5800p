// 座標一覧：取り込み（CSV・TSV・貼り付け・SIMA）、絞り込み、並べ替え
//   点は { id, name, x, y, z, kind, memo, src, updated } の形
(function (root) {
  'use strict';

  const KINDS = ['基準点', '既知点', '測点', '逃げ', 'その他'];
  const NAME_MAX = 40;

  // ---- 文字の揃え方（絞り込み用） ----
  // 全角→半角、大文字→小文字、カタカナ→ひらがな、丸数字→数字、空白を除く
  function normKey(s) {
    let t = String(s == null ? '' : s).normalize('NFKC').toLowerCase();
    t = t.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
    return t.replace(/\s+/g, '');
  }
  // 点名の中の数字のかたまり（"BM-12a" → ["12"]）
  function digitRuns(s) { return String(s).normalize('NFKC').match(/\d+/g) || []; }

  // 名前の比べ方：数字は数として比べる（No.2 < No.10）
  const collator = typeof Intl !== 'undefined' ? new Intl.Collator('ja', { numeric: true, sensitivity: 'base' }) : null;
  function compareName(a, b) { return collator ? collator.compare(a, b) : (a < b ? -1 : a > b ? 1 : 0); }

  // ---- 絞り込み ----
  //   opt.kind：種類で絞る（空なら全部）
  //   opt.recent：最近使った点の id の配列（新しい順）。query が空のとき上に出す
  //   opt.sort：'order'（登録順）／'name'／'near'（opt.from からの距離）
  function search(points, query, opt) {
    opt = opt || {};
    const q = normKey(query);
    let list = opt.kind ? points.filter(p => p.kind === opt.kind) : points.slice();
    const rank = new Map();
    if (q) {
      const onlyDigits = /^\d+$/.test(q);
      list = list.filter(p => {
        const key = normKey(p.name);
        let r = -1;
        if (key === q) r = 0;
        else if (onlyDigits) {
          // 数字だけ：点名の中の数字のかたまりで探す（12 → No.12 を No.120 より上に）
          const runs = digitRuns(p.name).map(d => d.replace(/^0+(?=\d)/, ''));
          const qq = q.replace(/^0+(?=\d)/, '');
          if (runs.includes(qq)) r = 1;
          else if (runs.some(d => d.startsWith(qq))) r = 3;
          else if (key.includes(q)) r = 4;
        } else if (key.startsWith(q)) r = 1;
        else if (key.includes(q)) r = 2;
        else if (p.memo && normKey(p.memo).includes(q)) r = 5;
        if (r >= 0) rank.set(p, r);
        return r >= 0;
      });
    }
    const order = new Map(points.map((p, i) => [p, i]));
    const by = opt.sort === 'name' ? (a, b) => compareName(a.name, b.name)
      : opt.sort === 'near' && opt.from ? (a, b) => d2(a, opt.from) - d2(b, opt.from)
        : (a, b) => order.get(a) - order.get(b);
    list.sort((a, b) => (q ? rank.get(a) - rank.get(b) : 0) || by(a, b));
    if (!q && opt.recent && opt.recent.length) {
      const top = [];
      for (const id of opt.recent) { const i = list.findIndex(p => p.id === id); if (i >= 0) top.push(list.splice(i, 1)[0]); if (top.length >= 5) break; }
      list = top.concat(list);
    }
    return list;
  }
  const d2 = (p, o) => (p.x - o.x) ** 2 + (p.y - o.y) ** 2;

  // 範囲で選ぶ（並び順で from から to まで。逆順でもよい）
  function range(list, fromName, toName) {
    const i = list.findIndex(p => p.name === fromName), j = list.findIndex(p => p.name === toName);
    if (i < 0 || j < 0) return [];
    return i <= j ? list.slice(i, j + 1) : list.slice(j, i + 1).reverse();
  }

  // ---- 文字コード ----
  function decode(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^﻿/, ''); }
    catch { return new TextDecoder('shift_jis').decode(b); }
  }

  // ---- 取り込み ----
  const NUMRE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
  function num(s) {
    const t = String(s == null ? '' : s).normalize('NFKC').replace(/[−‐–]/g, '-').replace(/,/g, '').trim();
    return NUMRE.test(t) ? Number(t) : NaN;
  }
  function splitLine(line) {
    if (line.includes('\t')) return line.split('\t').map(s => s.trim());
    if (line.includes(',')) return splitCsv(line);
    return line.trim().split(/\s+/);
  }
  // "" で囲んだ欄に , を含む CSV にも対応
  function splitCsv(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  }
  function isSima(text) { return /^\s*(G00|Z00|A00|A01)\s*,/m.test(text); }

  // 1 行を点にする。読めなければ理由の文字列を返す
  //   点名,X,Y[,Z][,メモ] ／ 番号,点名,X,Y[,Z] ／ X,Y だけは不可（点名がない）
  function rowFromFields(f) {
    f = f.filter((s, i) => s !== '' || i < 4);
    while (f.length && f[f.length - 1] === '') f.pop();
    if (f.length < 3) return '欄が足りません（点名・X・Y が要ります）';
    const n = f.map(num);
    let name, x, y, z = null, memo = '';
    if (!Number.isFinite(n[0]) && Number.isFinite(n[1]) && Number.isFinite(n[2])) {
      name = f[0]; x = n[1]; y = n[2];
      if (f.length > 3) { if (Number.isFinite(n[3])) { z = n[3]; memo = f.slice(4).join(' '); } else memo = f.slice(3).join(' '); }
    } else if (Number.isFinite(n[0]) && !Number.isFinite(n[1]) && f[1] !== '' && Number.isFinite(n[2]) && Number.isFinite(n[3])) {
      name = f[1]; x = n[2]; y = n[3];
      if (f.length > 4) { if (Number.isFinite(n[4])) { z = n[4]; memo = f.slice(5).join(' '); } else memo = f.slice(4).join(' '); }
    } else if (Number.isFinite(n[0]) && Number.isFinite(n[1]) && Number.isFinite(n[2])) {
      name = f[0]; x = n[1]; y = n[2];
      if (f.length > 3) { if (Number.isFinite(n[3])) { z = n[3]; memo = f.slice(4).join(' '); } else memo = f.slice(3).join(' '); }
    } else {
      // 点名に空白が入っているとき（"境界杭 No.3 100.0 200.0"）：最初に数字が 2 つ続く所までを点名にする
      let k = -1;
      for (let i = 1; i + 1 < f.length; i++) if (Number.isFinite(n[i]) && Number.isFinite(n[i + 1]) && f.slice(0, i).some((s, j) => !Number.isFinite(n[j]))) { k = i; break; }
      if (k < 0) return 'X・Y が数字ではありません';
      const from = Number.isFinite(n[0]) && k >= 2 ? 1 : 0;   // 先頭の番号は点名に入れない
      name = f.slice(from, k).join(' '); x = n[k]; y = n[k + 1];
      if (f.length > k + 2) { if (Number.isFinite(n[k + 2])) { z = n[k + 2]; memo = f.slice(k + 3).join(' '); } else memo = f.slice(k + 2).join(' '); }
    }
    name = String(name).trim();
    if (!name) return '点名がありません';
    if (name.length > NAME_MAX) return '点名が長すぎます（' + NAME_MAX + ' 文字まで）';
    return { name, x, y, z, memo: memo.trim() };
  }

  // 文字列を読んで { rows, errors, format } を返す
  function parseText(text) {
    const lines = String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/);
    const rows = [], errors = [];
    const sima = isSima(text);
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      if (sima) {
        // SIMA：A01,番号,点名,X,Y,Z,
        if (!/^A01\s*,/.test(line)) return;
        const f = splitCsv(line);
        const r = rowFromFields([f[2] || f[1], f[3], f[4], f[5]].map(s => s == null ? '' : s));
        if (typeof r === 'string') errors.push({ line: i + 1, text: raw, reason: r }); else rows.push(Object.assign(r, { line: i + 1 }));
        return;
      }
      if (/^(#|\/\/)/.test(line)) return;
      const r = rowFromFields(splitLine(line));
      if (typeof r === 'string') {
        // 先頭の行で数字がなければ見出しとして読み飛ばす
        if (!rows.length && !errors.length && !/\d+\.\d|\d{3,}/.test(line.replace(/^[^,\t ]*[,\t ]/, ''))) return;
        errors.push({ line: i + 1, text: raw, reason: r });
      } else rows.push(Object.assign(r, { line: i + 1 }));
    });
    return { rows, errors, format: sima ? 'SIMA' : 'CSV' };
  }

  // 取り込みの計画：既にある点と同じ名前をどうするか
  //   policy：'replace'（置き換える）／'rename'（別名で残す）／'skip'（飛ばす）
  function plan(existing, rows, policy, swapXY) {
    const names = new Set(existing.map(p => p.name));
    const seen = new Set();
    return rows.map(r => {
      const row = swapXY ? Object.assign({}, r, { x: r.y, y: r.x }) : Object.assign({}, r);
      let name = row.name, action = 'add';
      if (names.has(name) || seen.has(name)) {
        if (policy === 'skip') action = 'skip';
        else if (policy === 'rename') { let k = 2; while (names.has(name + ' (' + k + ')') || seen.has(name + ' (' + k + ')')) k++; name = name + ' (' + k + ')'; action = 'rename'; }
        else action = seen.has(name) ? 'replace-dup' : 'replace';
      }
      seen.add(name);
      return Object.assign(row, { name, action });
    });
  }

  // ---- 書き出し ----
  function csvCell(s) { s = String(s == null ? '' : s); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCsv(points) {
    const head = '点名,X,Y,Z,種類,メモ';
    return [head].concat(points.map(p => [p.name, fix(p.x), fix(p.y), p.z == null ? '' : fix(p.z), p.kind || '', p.memo || ''].map(csvCell).join(','))).join('\r\n') + '\r\n';
  }
  const fix = v => Number(v).toFixed(4).replace(/0$/, '');

  root.FxPoints = { KINDS, NAME_MAX, normKey, digitRuns, compareName, search, range, decode, parseText, plan, toCsv, num };
})(typeof globalThis !== 'undefined' ? globalThis : window);
