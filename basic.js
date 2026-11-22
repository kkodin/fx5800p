// fx-5800P 形式プログラムの翻訳と実行
(function (root) {
  'use strict';
  const E = root.FxEngine, M = root.FxMemory, CalcError = E.CalcError;
  const syntax = (d, line) => { const e = new CalcError('Syntax ERROR', d); e.line = line; return e; };

  // 文に分ける。区切り：改行・「:」・「◢」。「"」の中は区切らない。
  function split(source) {
    const src = String(source).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const out = [];
    let buf = '', q = false, line = 1, start = 1;
    const push = () => { const s = buf.trim(); if (s) out.push({ text: s, line: start }); buf = ''; start = line; };
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      // 行の先頭が ' の行は、アプリだけが読む説明・メモ（実行しない。電卓へも送らない）
      if (c === "'" && !q && !buf.trim() && (i === 0 || /\n\s*$/.test(src.slice(Math.max(0, i - 40), i)) || /^\s*$/.test(src.slice(0, i)))) {
        const e = src.indexOf('\n', i); i = (e < 0 ? src.length : e) - 1; continue;
      }
      if (c === '"') { q = !q; buf += c; continue; }
      if (c === '\n') { if (q) q = false; push(); line++; start = line; continue; }
      if (!q && (c === ':' || c === '：')) { push(); continue; }
      if (!q && (c === '◢' || c === '▲')) { push(); out.push({ text: '◢', line }); continue; }
      buf += c;
    }
    push();
    // 1つの文の中の「Then 文」「Else 文」「条件⇒文」をさらに分ける
    const res = [];
    for (const s of out) splitMore(s.text, s.line, res);
    return res;
  }
  function outsideQuoteIndex(s, ch) {
    let q = false;
    for (let i = 0; i < s.length; i++) { if (s[i] === '"') q = !q; else if (!q && s[i] === ch) return i; }
    return -1;
  }
  // 文字列の外だけ表記をそろえる（文字列の中の / や * はそのまま表示する）
  function normalizeOutsideQuotes(src) {
    return String(src).replace(/^﻿/, '').split('"').map((part, i) => i % 2 ? part : E.normalize(part)).join('"');
  }
  function splitMore(text, line, res) {
    let m;
    if ((m = text.match(/^(Then|Else)(?=$|[\s"?(\-0-9.])\s*(.*)$/))) {
      res.push({ text: m[1], line });
      if (m[2].trim()) splitMore(m[2].trim(), line, res);
      return;
    }
    const k = outsideQuoteIndex(text, '⇒');
    if (k >= 0) {
      res.push({ text: '⇒' + text.slice(0, k).trim(), line, guard: true });
      const rest = text.slice(k + 1).trim();
      if (!rest) throw syntax('⇒ の後に文がありません', line);
      splitMore(rest, line, res);
      return;
    }
    res.push({ text, line });
  }
  // 最後の「→」（文字列の外）。実機と同じく、→ の前の閉じカッコ省略も許す。
  function lastArrow(s) {
    let q = false, at = -1;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') q = !q;
      else if (!q && c === '→') at = i;
    }
    return at;
  }
  function parseTarget(t, line) {
    t = t.trim();
    let m;
    if (t === 'DimZ') return { kind: 'dim' };
    if ((m = t.match(/^([A-Z])$/)) || t === 'θ') return { kind: 'var', name: m ? m[1] : 'θ' };
    if ((m = t.match(/^([A-Z])\[(.+)\]?$/))) return { kind: 'arr', letter: m[1], index: m[2].replace(/\]$/, '') };
    throw syntax('代入先「' + t + '」', line);
  }

  // strict=true（編集画面の確認）なら誤りをすぐ知らせる。
  // 実行時は実機と同じく、誤った行に来たときにエラーにする。
  function compile(source, strict) {
    const code = split(normalizeOutsideQuotes(source));
    const stack = [], labels = new Map();
    const err = (i, d) => { throw syntax(d, code[i].line); };
    for (let i = 0; i < code.length; i++) {
      const c = code[i], s = c.text;
      let m;
      if (c.guard) { c.type = 'guard'; c.expr = s.slice(1); continue; }
      if (s === '◢') { c.type = 'pause'; continue; }
      if ((m = s.match(/^If\s*(.+)$/)) && !/^If(End)\b/.test(s)) { c.type = 'if'; c.expr = m[1]; stack.push({ t: 'if', at: i, els: -1 }); continue; }
      if (s === 'Then') { c.type = 'nop'; if (!stack.length || stack[stack.length - 1].t !== 'if') err(i, 'Then に対応する If がない'); continue; }
      if (s === 'Else') {
        c.type = 'else'; const top = stack[stack.length - 1];
        if (!top || top.t !== 'if' || top.els >= 0) err(i, 'Else に対応する If がない');
        top.els = i; code[top.at].jump = i + 1; continue;
      }
      if (s === 'IfEnd') {
        c.type = 'nop'; const top = stack.pop();
        if (!top || top.t !== 'if') err(i, 'IfEnd に対応する If がない');
        if (top.els >= 0) code[top.els].jump = i + 1; else code[top.at].jump = i + 1;
        continue;
      }
      if ((m = s.match(/^For\s*(.+?)→\s*([A-Zθ](?:\[[^\]]+\])?)\s*To\s*(.+?)(?:\s*Step\s*(.+))?$/))) {
        c.type = 'for'; c.from = m[1]; c.target = parseTarget(m[2], c.line); c.to = m[3]; c.step = m[4] || '1';
        stack.push({ t: 'for', at: i }); continue;
      }
      if (s === 'Next') { c.type = 'next'; const top = stack.pop(); if (!top || top.t !== 'for') err(i, 'Next に対応する For がない'); c.start = top.at; code[top.at].end = i; continue; }
      if ((m = s.match(/^While\s*(.+)$/)) && !s.startsWith('WhileEnd')) { c.type = 'while'; c.expr = m[1]; stack.push({ t: 'while', at: i }); continue; }
      if (s === 'WhileEnd') { c.type = 'wend'; const top = stack.pop(); if (!top || top.t !== 'while') err(i, 'WhileEnd に対応する While がない'); c.start = top.at; code[top.at].end = i; continue; }
      if (s === 'Do') { c.type = 'nop'; stack.push({ t: 'do', at: i }); continue; }
      if ((m = s.match(/^LpWhile\s*(.+)$/))) { c.type = 'lpwhile'; c.expr = m[1]; const top = stack.pop(); if (!top || top.t !== 'do') err(i, 'LpWhile に対応する Do がない'); c.start = top.at; code[top.at].end = i; continue; }
      if (s === 'Break') { c.type = 'break'; const loop = [...stack].reverse().find(x => x.t !== 'if'); if (!loop) err(i, 'Break はループの中で使う'); c.loop = loop.at; continue; }
      if ((m = s.match(/^Lbl\s*([0-9A-Zθ])$/))) { c.type = 'nop'; if (labels.has(m[1])) err(i, 'Lbl ' + m[1] + ' が重複'); labels.set(m[1], i); continue; }
      if ((m = s.match(/^Goto\s*([0-9A-Zθ])$/))) { c.type = 'goto'; c.label = m[1]; continue; }
      if ((m = s.match(/^Prog\s*"([^"]*)"?$/))) { c.type = 'prog'; c.name = m[1].trim(); continue; }
      if (s === 'Return') { c.type = 'return'; continue; }
      if (s === 'Stop') { c.type = 'stop'; continue; }
      if ((m = s.match(/^(Isz|Dsz)\s*([A-Zθ](?:\[[^\]]+\])?)$/))) { c.type = m[1].toLowerCase(); c.target = parseTarget(m[2], c.line); continue; }
      if (s === 'Cls') { c.type = 'cls'; continue; }
      if ((m = s.match(/^(Deg|Rad|Gra)$/))) { c.type = 'angle'; c.angle = m[1]; continue; }
      if ((m = s.match(/^(Fix|Sci|Norm)\s*(.+)$/))) { c.type = 'disp'; c.mode = m[1]; c.expr = m[2]; continue; }
      if (s === 'ClrMemory' || s === 'ClrVar') { c.type = 'clrmem'; continue; }
      if (s === 'ClrStat' || s === 'ClrMat' || s === 'ClrList') { c.type = 'nop'; continue; }
      if ((m = s.match(/^Locate\s*(.+)$/))) {
        const parts = splitArgs(m[1]);
        if (parts.length !== 3) { if (strict) err(i, 'Locate 列,行,値'); c.type = 'bad'; c.err = syntax('Locate 列,行,値', c.line); continue; }
        c.type = 'locate'; c.x = parts[0]; c.y = parts[1]; c.val = parts[2]; continue;
      }
      // 入力命令  ?→A  "文字"?→A  ?A  "文字"?A
      if ((m = s.match(/^(?:"([^"]*)"\s*)?\?\s*(→)?\s*([A-Zθ](?:\[[^\]]+\])?)$/))) {
        c.type = 'input'; c.prompt = m[1]; c.keep = !m[2]; c.target = parseTarget(m[3], c.line); continue;
      }
      if ((m = s.match(/^"([^"]*)"?$/))) { c.type = 'text'; c.value = m[1]; continue; }
      // 文字列の後に式が続く書き方（"L=":L など区切り無し）は区切りとみなす
      if ((m = s.match(/^"([^"]*)"\s*(.+)$/))) {
        c.type = 'text'; c.value = m[1];
        code.splice(i + 1, 0, { text: m[2], line: c.line });
        continue;
      }
      const k = lastArrow(s);
      if (k >= 0) { c.type = 'assign'; c.expr = s.slice(0, k); c.target = parseTarget(s.slice(k + 1), c.line); if (!c.expr.trim()) err(i, '→ の左に式がない'); continue; }
      c.type = 'expr'; c.expr = s;
    }
    if (stack.length) { const top = stack[stack.length - 1]; err(top.at, { if: 'IfEnd', for: 'Next', while: 'WhileEnd', do: 'LpWhile' }[top.t] + ' がない'); }
    for (let i = 0; i < code.length; i++) {
      const c = code[i];
      if (c.type === 'goto') {
        if (!labels.has(c.label)) { const e = new CalcError('Go ERROR', 'Lbl ' + c.label + ' がない'); e.line = c.line; if (strict) throw e; c.type = 'bad'; c.err = e; continue; }
        c.jump = labels.get(c.label) + 1;
      }
      if (c.type === 'break') c.jump = code[c.loop].end + 1;
    }
    return code;
  }
  function splitArgs(s) {
    const out = []; let q = false, d = 0, buf = '';
    for (const ch of s) {
      if (ch === '"') q = !q;
      if (!q && (ch === '(' || ch === '[')) d++;
      if (!q && (ch === ')' || ch === ']')) d--;
      if (!q && d === 0 && ch === ',') { out.push(buf.trim()); buf = ''; continue; }
      buf += ch;
    }
    out.push(buf.trim());
    return out;
  }

  // 実行。画面 io は { print(text), printValue(text), locate(x,y,text), cls() }。
  // 入力待ち・一時停止は yield で呼び出し側へ返す。
  function* run(program, opt) {
    const vars = opt.vars, io = opt.io, library = opt.library || [];
    const state = { angle: opt.angle || 'Deg', disp: opt.disp || { mode: 'Norm', n: 1 } };
    const ctx = { vars, get angle() { return state.angle; }, get disp() { return state.disp; }, getkey: opt.getkey };
    const frames = [{ code: compile(program.source), name: program.name, pc: 0, loops: new Map() }];
    let steps = 0, last = null, lastShown = true;
    const calc = s => E.evaluate(s, ctx);
    const assign = (tg, v) => {
      if (tg.kind === 'var') vars[tg.name] = v;
      else if (tg.kind === 'dim') M.setDim(vars, v);
      else M.set(vars, M.indexOf(tg.letter, calc(tg.index).value), v);
    };
    const read = tg => tg.kind === 'var' ? (vars[tg.name] || 0) : M.get(vars, M.indexOf(tg.letter, calc(tg.index).value));
    const fmt = r => r.dms ? E.formatDMS(r.value) : E.formatNumber(r.value, state.disp);
    while (frames.length) {
      const f = frames[frames.length - 1];
      if (f.pc >= f.code.length) { frames.pop(); continue; }
      const c = f.code[f.pc++];
      steps++;
      if (steps % 400 === 0) yield { type: 'tick' };
      try {
        switch (c.type) {
          case 'nop': break;
          case 'bad': throw c.err;
          case 'guard': if (calc(c.expr).value === 0) f.pc++; break;
          case 'if': if (calc(c.expr).value === 0) f.pc = c.jump; break;
          case 'else': f.pc = c.jump; break;
          case 'for': {
            const from = calc(c.from).value, to = calc(c.to).value, step = calc(c.step).value;
            if (step === 0) throw new CalcError('Argument ERROR', 'Step 0');
            assign(c.target, from);
            if (step > 0 ? from > to : from < to) f.pc = c.end + 1; else f.loops.set(f.pc - 1, { to, step });
            break;
          }
          case 'next': {
            const loop = f.loops.get(c.start), fc = f.code[c.start];
            if (!loop) break;
            const v = read(fc.target) + loop.step; assign(fc.target, v);
            if (loop.step > 0 ? v <= loop.to + 1e-12 : v >= loop.to - 1e-12) f.pc = c.start + 1; else f.loops.delete(c.start);
            break;
          }
          case 'while': if (calc(c.expr).value === 0) f.pc = c.end + 1; break;
          case 'wend': f.pc = c.start; break;
          case 'lpwhile': if (calc(c.expr).value !== 0) f.pc = c.start + 1; break;
          case 'break': f.loops.delete(c.loop); f.pc = c.jump; break;
          case 'goto': f.pc = c.jump; break;
          case 'isz': case 'dsz': {
            const v = read(c.target) + (c.type === 'isz' ? 1 : -1); assign(c.target, v); vars.Ans = v;
            if (v === 0) f.pc++;
            break;
          }
          case 'prog': {
            if (frames.length > 10) throw new CalcError('Ne ERROR', 'サブルーチンは10段まで');
            const sub = library.find(p => p.name === c.name) || library.find(p => p.name.toUpperCase() === c.name.toUpperCase());
            if (!sub) throw new CalcError('Go ERROR', 'プログラム「' + c.name + '」がない');
            frames.push({ code: compile(sub.source), name: sub.name, pc: 0, loops: new Map() });
            break;
          }
          case 'return': frames.pop(); break;
          case 'stop': frames.length = 0; break;
          case 'cls': io.cls(); break;
          case 'clrmem': for (const L of E.LETTERS) vars[L] = 0; vars.__z = []; break;
          case 'angle': state.angle = c.angle; if (opt.onAngle) opt.onAngle(c.angle); break;
          case 'disp': {
            const n = calc(c.expr).value;
            if (c.mode === 'Fix' && (n < 0 || n > 9)) throw new CalcError('Argument ERROR', 'Fix 0〜9');
            if (c.mode === 'Sci' && (n < 0 || n > 10)) throw new CalcError('Argument ERROR', 'Sci 0〜10');
            if (c.mode === 'Norm' && n !== 1 && n !== 2) throw new CalcError('Argument ERROR', 'Norm 1 か 2');
            state.disp = { mode: c.mode, n: c.mode === 'Sci' && n === 0 ? 10 : n };
            if (opt.onDisp) opt.onDisp(state.disp);
            break;
          }
          case 'locate': {
            const x = calc(c.x).value, y = calc(c.y).value;
            if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || x > 16 || y < 1 || y > 4) throw new CalcError('Argument ERROR', 'Locate 列1〜16・行1〜4');
            const m = c.val.match(/^"([^"]*)"?$/);
            io.locate(x, y, m ? m[1] : fmt(calc(c.val)));
            lastShown = true;
            break;
          }
          case 'text': io.print(c.value); lastShown = true; break;
          case 'input': {
            const label = c.prompt !== undefined ? c.prompt : (c.target.kind === 'var' ? c.target.name : '');
            const cur = read(c.target);
            for (;;) {
              // prog・target：どのプログラムのどの変数に入れるか（アプリで日本語の名前を出すため）
              const raw = yield { type: 'input', label, keep: c.keep, current: cur, currentText: E.formatNumber(cur, state.disp), angle: state.angle, prog: f.name, target: c.target.kind === 'var' ? c.target.name : (c.target.letter ? c.target.letter + '[' + c.target.index + ']' : null) };
              if ((raw === '' || raw == null) && c.keep) break;
              if (raw === '' || raw == null) continue;
              const r = calc(raw);
              assign(c.target, r.value); vars.Ans = r.value;
              break;
            }
            lastShown = true;
            break;
          }
          case 'assign': {
            const r = calc(c.expr);
            assign(c.target, r.value); vars.Ans = r.value; last = r; lastShown = false;
            break;
          }
          case 'expr': { const r = calc(c.expr); vars.Ans = r.value; last = r; lastShown = false; break; }
          case 'pause':
            if (last && !lastShown) { io.printValue(fmt(last)); lastShown = true; }
            yield { type: 'pause' };
            break;
        }
      } catch (e) {
        if (!(e instanceof CalcError)) throw e;
        e.prog = f.name; e.line = e.line || c.line; e.stmt = c.text;
        throw e;
      }
    }
    return { last: last && !lastShown ? last : null, lastText: last && !lastShown ? fmt(last) : null, angle: state.angle, disp: state.disp };
  }

  // 文法チェックだけ行う
  function check(source) { compile(source, true); return true; }

  // ---- アプリだけが読む説明（行の先頭が ' の行） ----
  //   '名前 …   → アプリで出す日本語のプログラム名（一覧で大きく出す）
  //   '説明 …   → 内容説明（一覧に出す 1 行）
  //   '使い方 … → 使い方の手順（何行でも。「？」で開く画面に番号付きで出す）
  //   '変数 A=… B=… → 変数の日本語の名前（実行中の入力の案内・変数のタブに出す）。1 行に何個でも、何行でも
  //   '解説 …   → 解説（何行でも。「？」で開く）
  //   ' …       → メモ（どこにも出さない）
  const isNote = l => /^\s*'/.test(l);
  function meta(source) {
    const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    let summary = '', title = '';
    const help = [], usage = [], vars = {};
    for (const l of lines) {
      if (!isNote(l)) continue;
      const t = l.replace(/^\s*'/, '');
      let m;
      if ((m = t.match(/^\s*名前\s*[:：]?\s*(.*)$/))) { if (!title) title = m[1].trim(); }
      else if ((m = t.match(/^\s*説明\s*[:：]?\s*(.*)$/))) { if (!summary) summary = m[1].trim(); else help.push(m[1]); }
      else if ((m = t.match(/^\s*使い方\s*[:：]?\s*(.*)$/))) { if (m[1].trim()) usage.push(m[1].trim()); }
      else if ((m = t.match(/^\s*変数\s*[:：]?\s*(.*)$/))) {
        // A=既知点の X、B＝…、Z[1]=曲線の数。名前の中の「＝」「、」はそのまま（区切りは「、のあとに 変数＝」の所だけ）
        const V = '(?:Z\\[\\d+\\]|[A-Zθ]|Ans)';
        const parts = m[1].split(new RegExp('\\s*[,、]\\s*(?=' + V + '\\s*[=＝])'));
        let hit = false, n;
        for (const part of parts) {
          if ((n = part.match(new RegExp('^\\s*(' + V + ')\\s*[=＝]\\s*(.*)$')))) { vars[n[1]] = n[2].trim(); hit = true; }
        }
        if (!hit && (n = m[1].match(/^(Z\[\d+\]|[A-Zθ]|Ans)\s+(.+)$/))) vars[n[1]] = n[2].trim();
      }
      else if ((m = t.match(/^\s*解説\s*[:：]?\s?(.*)$/))) help.push(m[1]);
    }
    return { title, summary, usage, vars, help: help.join('\n').replace(/\s+$/, '') };
  }
  // 「？」で開く画面の文（名前・説明・使い方・変数・解説をまとめる）
  function helpText(name, source) {
    const md = meta(source), out = [];
    out.push(md.title ? md.title + '（' + name + '）' : name);
    if (md.summary) out.push(md.summary);
    if (md.usage.length) out.push('', '【使い方】', ...md.usage.map((u, i) => (i + 1) + '. ' + u));
    const vk = Object.keys(md.vars);
    if (vk.length) out.push('', '【変数】', ...vk.map(k => k + '：' + md.vars[k]));
    if (md.help) out.push('', '【解説】', md.help);
    return out.join('\n');
  }
  // 電卓（実機）へ送るときは ' の行を消す
  function strip(source) {
    return String(source || '').replace(/\r\n?/g, '\n').split('\n').filter(l => !isNote(l)).join('\n');
  }

  const api = { compile, run, check, split, meta, strip, helpText };
  root.FxBasic = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
