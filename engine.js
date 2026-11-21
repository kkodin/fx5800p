// fx-5800P 風 計算エンジン（式の字句解析・構文解析・計算・表示書式）
(function (root) {
  'use strict';
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  class CalcError extends Error {
    constructor(kind, detail, pos) { super(kind + (detail ? '：' + detail : '')); this.kind = kind; this.detail = detail || ''; this.pos = pos; }
  }
  const syntax = (d, p) => new CalcError('Syntax ERROR', d, p);
  const mathErr = d => new CalcError('Math ERROR', d);

  // 表記ゆれ（ASCII・全角・旧表記）をそろえる
  function normalize(s) {
    return String(s)
      .replace(/\r/g, '')
      .replace(/->/g, '→').replace(/=>/g, '⇒')
      .replace(/>=/g, '≥').replace(/<=/g, '≤').replace(/≧/g, '≥').replace(/≦/g, '≤')
      .replace(/!=|<>/g, '≠')
      .replace(/[−－‐]/g, '-').replace(/＋/g, '+').replace(/[＊*]/g, '×').replace(/[／\/]/g, '÷')
      .replace(/[▶►▸]\s*DMS/g, '▸DMS')
      .replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',')
      .replace(/x10\^|×10\^/g, 'ᴇ');
  }

  // 引数を ( 付きで取る関数（表示名 → 内部名）。長い名前を先に照合する。
  const FUNCS = {
    'sinh⁻¹(': 'asinh', 'cosh⁻¹(': 'acosh', 'tanh⁻¹(': 'atanh',
    'sin⁻¹(': 'asin', 'cos⁻¹(': 'acos', 'tan⁻¹(': 'atan',
    'sinh(': 'sinh', 'cosh(': 'cosh', 'tanh(': 'tanh',
    'sin(': 'sin', 'cos(': 'cos', 'tan(': 'tan',
    'log(': 'log', 'ln(': 'ln', '√(': 'sqrt', '∛(': 'cbrt',
    'Abs(': 'abs', 'Int(': 'int', 'Intg(': 'intg', 'Frac(': 'frac', 'Rnd(': 'rnd',
    'Pol(': 'pol', 'Rec(': 'rec', 'RanInt#(': 'ranint', 'Not(': 'not', 'Neg(': 'neg',
    'GCD(': 'gcd', 'LCM(': 'lcm'
  };
  // ( を付けずに書かれた関数（例：Abs A、√A）も受け付ける
  const BARE = { 'sin⁻¹': 'asin', 'cos⁻¹': 'acos', 'tan⁻¹': 'atan', 'sinh': 'sinh', 'cosh': 'cosh', 'tanh': 'tanh', 'sin': 'sin', 'cos': 'cos', 'tan': 'tan', 'log': 'log', 'ln': 'ln', '√': 'sqrt', '∛': 'cbrt', 'Abs': 'abs', 'Int': 'int', 'Intg': 'intg', 'Frac': 'frac', 'Not': 'not', 'Neg': 'neg' };
  const FUNC_KEYS = Object.keys(FUNCS).sort((a, b) => b.length - a.length);
  const BARE_KEYS = Object.keys(BARE).sort((a, b) => b.length - a.length);
  const WORDS = ['Getkey', 'Ran#', 'Ans', 'And', 'Or', 'Xor', 'DimZ', '▸DMS', 'ˣ√('];

  function tokenize(src) {
    const s = normalize(src), out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      const rest = s.slice(i);
      let m;
      if ((m = rest.match(/^(\d+\.?\d*|\.\d+)(ᴇ[+-]?\d+)?/))) {
        const t = m[0].replace('ᴇ', 'e');
        out.push({ t: 'num', v: Number(t), p: i }); i += m[0].length; continue;
      }
      if ((m = rest.match(/^ᴇ([+-]?\d+)/))) { out.push({ t: 'num', v: Number('1e' + m[1]), p: i }); i += m[0].length; continue; }
      let hit = FUNC_KEYS.find(k => rest.startsWith(k));
      if (hit) { out.push({ t: 'func', v: FUNCS[hit], p: i }); i += hit.length; continue; }
      hit = WORDS.find(k => rest.startsWith(k));
      if (hit) {
        const map = { 'Getkey': 'getkey', 'Ran#': 'ran', 'Ans': 'ans', 'And': 'and', 'Or': 'or', 'Xor': 'xor', 'DimZ': 'dimz', '▸DMS': 'todms', 'ˣ√(': 'xroot' };
        out.push({ t: map[hit] === 'and' || map[hit] === 'or' || map[hit] === 'xor' ? 'op' : 'word', v: map[hit], p: i });
        i += hit.length; continue;
      }
      hit = BARE_KEYS.find(k => rest.startsWith(k) && !/[a-z]/.test(rest[k.length] || ''));
      if (hit) { out.push({ t: 'bare', v: BARE[hit], p: i }); i += hit.length; continue; }
      if (c === 'π') { out.push({ t: 'num', v: Math.PI, p: i, k: 'π' }); i++; continue; }
      if (c === 'e' || c === '𝑒') { out.push({ t: 'num', v: Math.E, p: i, k: 'e' }); i++; continue; }
      if (c === 'θ') { out.push({ t: 'var', v: 'θ', p: i }); i++; continue; }
      if (LETTERS.includes(c)) { out.push({ t: 'var', v: c, p: i }); i++; continue; }
      if (rest.startsWith('⁻¹')) { out.push({ t: 'post', v: 'inv', p: i }); i += 2; continue; }
      if ('²³!%°'.includes(c)) { out.push({ t: 'post', v: c, p: i }); i++; continue; }
      if ('+-×÷^(),[]=≠<>≤≥⌟ℙℂ'.includes(c)) { out.push({ t: 'op', v: c, p: i }); i++; continue; }
      throw syntax('使えない文字「' + c + '」', i);
    }
    return out;
  }

  // 式の中で使っている変数 A〜Z を登場順に返す（CALC・SOLVE 用）
  function variablesIn(src) {
    const seen = [];
    let toks;
    try { toks = tokenize(src); } catch { return seen; }
    toks.forEach((t, i) => {
      if (t.t === 'var' && t.v !== 'θ' && toks[i + 1]?.v !== '[' && !seen.includes(t.v)) seen.push(t.v);
    });
    return seen;
  }

  function factorial(n) {
    if (!Number.isInteger(n) || n < 0 || n > 69) throw mathErr('x! は 0〜69 の整数');
    let a = 1; for (let k = 2; k <= n; k++) a *= k; return a;
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

  // ctx: { vars, angle:'Deg'|'Rad'|'Gra', getkey(), disp }
  function evaluate(src, ctx) {
    const toks = tokenize(src);
    if (!toks.length) throw syntax('式がありません', 0);
    let p = 0, dms = false, pair = null, depth = 0;
    const vars = ctx.vars;
    const peek = () => toks[p], take = () => toks[p++];
    const isOp = v => toks[p] && toks[p].t === 'op' && toks[p].v === v;
    const toRad = x => ctx.angle === 'Rad' ? x : ctx.angle === 'Gra' ? x * Math.PI / 200 : x * Math.PI / 180;
    const fromRad = x => ctx.angle === 'Rad' ? x : ctx.angle === 'Gra' ? x * 200 / Math.PI : x * 180 / Math.PI;
    const here = () => (toks[p] ? toks[p].p : (toks.length ? toks[toks.length - 1].p + 1 : 0));

    function closeParen() {
      if (isOp(')')) { take(); return; }
      if (p >= toks.length) return; // 式の末尾の閉じカッコは省略できる（実機と同じ）
      if (toks[p].t === 'op' && (toks[p].v === '=' || toks[p].v === '≠' || toks[p].v === '<' || toks[p].v === '>' || toks[p].v === '≤' || toks[p].v === '≥')) return;
      throw syntax('カッコ ) が必要', here());
    }
    function args() {
      const a = [logic()];
      while (isOp(',')) { take(); a.push(logic()); }
      closeParen();
      return a;
    }
    function arrayIndex(letter) {
      take(); // [
      const n = logic();
      if (isOp(']')) take(); else if (p < toks.length) throw syntax('] が必要', here());
      return root.FxMemory.indexOf(letter, n);
    }
    function callFunc(name, a) {
      const one = () => { if (a.length !== 1) throw syntax(name + ' の引数の数'); return a[0]; };
      let x;
      switch (name) {
        case 'sin': return Math.sin(toRad(one()));
        case 'cos': return Math.cos(toRad(one()));
        case 'tan': x = toRad(one()); if (Math.abs(Math.cos(x)) < 1e-15) throw mathErr('tan'); return Math.tan(x);
        case 'asin': x = one(); if (Math.abs(x) > 1) throw mathErr('sin⁻¹ の範囲'); return fromRad(Math.asin(x));
        case 'acos': x = one(); if (Math.abs(x) > 1) throw mathErr('cos⁻¹ の範囲'); return fromRad(Math.acos(x));
        case 'atan': return fromRad(Math.atan(one()));
        case 'sinh': return Math.sinh(one()); case 'cosh': return Math.cosh(one()); case 'tanh': return Math.tanh(one());
        case 'asinh': return Math.asinh(one()); case 'acosh': return Math.acosh(one()); case 'atanh': return Math.atanh(one());
        case 'log':
          if (a.length === 2) { if (a[0] <= 0 || a[1] <= 0 || a[0] === 1) throw mathErr('log'); return Math.log(a[1]) / Math.log(a[0]); }
          x = one(); if (x <= 0) throw mathErr('log の真数'); return Math.log10(x);
        case 'ln': x = one(); if (x <= 0) throw mathErr('ln の真数'); return Math.log(x);
        case 'sqrt': x = one(); if (x < 0) throw mathErr('√ の中が負'); return Math.sqrt(x);
        case 'cbrt': return Math.cbrt(one());
        case 'abs': return Math.abs(one());
        case 'int': return Math.trunc(one());
        case 'intg': return Math.floor(one());
        case 'frac': x = one(); return x - Math.trunc(x);
        case 'rnd': return roundForDisplay(one(), ctx.disp);
        case 'not': return one() === 0 ? 1 : 0;
        case 'neg': return -one();
        case 'gcd': if (a.length !== 2) throw syntax('GCD'); return gcd(a[0], a[1]);
        case 'lcm': if (a.length !== 2) throw syntax('LCM'); return Math.abs(a[0] * a[1]) / gcd(a[0], a[1]);
        case 'ranint': {
          if (a.length !== 2) throw syntax('RanInt#');
          const lo = Math.ceil(Math.min(a[0], a[1])), hi = Math.floor(Math.max(a[0], a[1]));
          return lo + Math.floor(Math.random() * (hi - lo + 1));
        }
        case 'pol': {
          if (a.length !== 2) throw syntax('Pol( の引数は2つ');
          const [X, Y] = a;
          if (X === 0 && Y === 0) throw mathErr('Pol(0,0)');
          const r = Math.hypot(X, Y), t = fromRad(Math.atan2(Y, X));
          vars.I = r; vars.J = t; pair = { a: ['I', r], b: ['J', t], angleB: true }; return r;
        }
        case 'rec': {
          if (a.length !== 2) throw syntax('Rec( の引数は2つ');
          const [r, t] = a, X = r * Math.cos(toRad(t)), Y = r * Math.sin(toRad(t));
          vars.I = X; vars.J = Y; pair = { a: ['I', X], b: ['J', Y] }; return X;
        }
      }
      throw syntax('未対応の関数 ' + name);
    }
    // 数値や変数の直後の ° を度分秒として読む（2°30°15° = 2度30分15秒）
    function dmsTail(first) {
      let v = first, scale = 1, parts = 1;
      take(); // °
      dms = true;
      while (parts < 3 && peek() && (peek().t === 'num' && !peek().k) && toks[p + 1] && toks[p + 1].t === 'post' && toks[p + 1].v === '°') {
        scale *= 60; v += Math.sign(first || 1) * take().v / scale; take(); parts++;
      }
      // 最後の ° を省略した「2°30°15」も受け付ける
      if (parts < 3 && peek() && peek().t === 'num' && !peek().k) { scale *= 60; v += Math.sign(first || 1) * take().v / scale; }
      return v;
    }
    function primary() {
      if (++depth > 200) throw new CalcError('Stack ERROR', '入れ子が深すぎます');
      const t = take();
      if (!t) throw syntax('式が途中で終わっています', here());
      let v;
      if (t.t === 'num') {
        v = t.v;
        if (peek() && peek().t === 'post' && peek().v === '°' && !t.k) v = dmsTail(v);
      } else if (t.t === 'op' && t.v === '(') {
        v = logic(); closeParen();
      } else if (t.t === 'func') {
        v = callFunc(t.v, args());
      } else if (t.t === 'bare') {
        v = callFunc(t.v, [unary()]);
      } else if (t.t === 'var') {
        if (t.v === 'θ') v = vars.θ || 0;
        else if (isOp('[')) v = root.FxMemory.get(vars, arrayIndex(t.v));
        else v = Number.isFinite(vars[t.v]) ? vars[t.v] : 0;
      } else if (t.t === 'word') {
        if (t.v === 'ans') v = Number.isFinite(vars.Ans) ? vars.Ans : 0;
        else if (t.v === 'ran') v = Math.floor(Math.random() * 1000) / 1000;
        else if (t.v === 'getkey') v = ctx.getkey ? ctx.getkey() : 0;
        else if (t.v === 'dimz') v = root.FxMemory.dim(vars);
        else throw syntax('ここに置けない記号', t.p);
      } else throw syntax('ここに置けない記号「' + (t.v || '') + '」', t.p);
      depth--;
      return v;
    }
    function postfix() {
      let v = primary();
      while (peek() && peek().t === 'post') {
        const o = take().v;
        if (o === '²') v = v * v;
        else if (o === '³') v = v * v * v;
        else if (o === 'inv') { if (v === 0) throw mathErr('0 の逆数'); v = 1 / v; }
        else if (o === '!') v = factorial(v);
        else if (o === '%') v = v / 100;
        else if (o === '°') { v = ctx.angle === 'Rad' ? v * Math.PI / 180 : ctx.angle === 'Gra' ? v * 200 / 180 : v; }
      }
      return v;
    }
    function power() {
      let v = postfix();
      for (;;) {
        if (isOp('^')) {
          take();
          let neg = false; while (isOp('-') || isOp('+')) { if (take().v === '-') neg = !neg; }
          let e = postfix(); if (neg) e = -e;
          const r = Math.pow(v, e);
          if (Number.isNaN(r)) throw mathErr('べき乗');
          v = r;
        } else if (peek() && peek().t === 'word' && peek().v === 'xroot') {
          take(); const x = logic(); closeParen();
          if (v === 0) throw mathErr('0 乗根');
          const r = x < 0 && Math.abs(v % 2) === 1 ? -Math.pow(-x, 1 / v) : Math.pow(x, 1 / v);
          if (Number.isNaN(r)) throw mathErr('べき乗根');
          v = r;
        } else return v;
      }
    }
    function startsValue() {
      const t = peek();
      if (!t) return false;
      if (t.t === 'num' || t.t === 'var' || t.t === 'func' || t.t === 'bare') return true;
      if (t.t === 'word' && ['ans', 'ran', 'getkey', 'dimz'].includes(t.v)) return true;
      return t.t === 'op' && t.v === '(';
    }
    // 分数 a⌟b（＝a÷b）と帯分数 a⌟b⌟c（＝a＋b÷c）。(式)⌟(式) も可。べき乗の次に優先。
    function fraction() {
      const parts = [power()];
      while (isOp('⌟')) { take(); parts.push(power()); }
      if (parts.length === 1) return parts[0];
      if (parts.length > 3) throw syntax('分数', here());
      const den = parts[parts.length - 1];
      if (den === 0) throw mathErr('分母が0');
      if (parts.length === 2) return parts[0] / den;
      return parts[0] + (parts[0] < 0 ? -1 : 1) * parts[1] / den;
    }
    // 乗算記号の省略（2A、2π、3(4+1)、2sin(30)）は × ÷ より優先
    function implicit() {
      let v = fraction();
      while (startsValue()) v *= fraction();
      return v;
    }
    function unary() {
      if (isOp('-')) { take(); return -unary(); }
      if (isOp('+')) { take(); return unary(); }
      return implicit();
    }
    function perm() {
      let v = unary();
      while (isOp('ℙ') || isOp('ℂ')) {
        const o = take().v, r = unary();
        if (!Number.isInteger(v) || !Number.isInteger(r) || r < 0 || v < r) throw mathErr('nPr・nCr');
        let a = 1; for (let k = 0; k < r; k++) a *= (v - k);
        if (o === 'ℂ') a /= factorial(r);
        v = a;
      }
      return v;
    }
    function mul() {
      let v = perm();
      while (isOp('×') || isOp('÷')) {
        const o = take().v, r = perm();
        if (o === '÷' && r === 0) throw mathErr('0 で割り算');
        v = o === '×' ? v * r : v / r;
      }
      return v;
    }
    function add() {
      let v = mul();
      while (isOp('+') || isOp('-')) { const o = take().v, r = mul(); v = o === '+' ? v + r : v - r; }
      return v;
    }
    function compare() {
      let v = add();
      while (peek() && peek().t === 'op' && ['=', '≠', '<', '>', '≤', '≥'].includes(peek().v)) {
        const o = take().v, r = add(), eq = Math.abs(v - r) <= 1e-12 * Math.max(1, Math.abs(v), Math.abs(r));
        v = Number(o === '=' ? eq : o === '≠' ? !eq : o === '<' ? v < r && !eq : o === '>' ? v > r && !eq : o === '≤' ? v < r || eq : v > r || eq);
      }
      return v;
    }
    function and() { let v = compare(); while (peek() && peek().t === 'op' && peek().v === 'and') { take(); const r = compare(); v = Number(v !== 0 && r !== 0); } return v; }
    function logic() {
      let v = and();
      while (peek() && peek().t === 'op' && (peek().v === 'or' || peek().v === 'xor')) {
        const o = take().v, r = and();
        v = o === 'or' ? Number(v !== 0 || r !== 0) : Number((v !== 0) !== (r !== 0));
      }
      return v;
    }
    let v = logic();
    let toDms = false;
    if (peek() && peek().t === 'word' && peek().v === 'todms') { take(); toDms = true; }
    if (p < toks.length) {
      const t = toks[p];
      throw syntax(t.t === 'op' && t.v === ')' ? '閉じカッコが多い' : '記号の並び', t.p);
    }
    if (!Number.isFinite(v)) throw mathErr('計算できない値');
    if (Math.abs(v) >= 1e100) throw mathErr('範囲外（1ᴇ100 以上）');
    if (Math.abs(v) < 1e-99) v = 0;
    return { value: v, dms: dms || toDms, pair };
  }

  // 表示書式 ------------------------------------------------------------
  function trimNum(s) { return s.includes('e') ? s : s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''); }
  function expForm(v, digits) {
    let [m, e] = v.toExponential(digits - 1).split('e');
    if (!/\.\d*[1-9]/.test(m) || true) m = trimNum(m);
    const n = Number(e);
    return m + 'ᴇ' + (n < 0 ? '-' : '') + String(Math.abs(n)).padStart(2, '0');
  }
  function formatNumber(v, disp) {
    disp = disp || { mode: 'Norm', n: 1 };
    if (!Number.isFinite(v)) return 'Math ERROR';
    if (v === 0 && disp.mode !== 'Fix') return '0';
    const a = Math.abs(v);
    if (disp.mode === 'Fix') {
      if (a >= 1e10) return expForm(v, 10);
      const s = v.toFixed(disp.n);
      return s === '-0' || /^-0\.0*$/.test(s) ? s.slice(1) : s;
    }
    if (disp.mode === 'Sci') {
      let [m, e] = v.toExponential(Math.max(0, disp.n - 1)).split('e');
      const n = Number(e);
      return m + 'ᴇ' + (n < 0 ? '-' : '') + String(Math.abs(n)).padStart(2, '0');
    }
    const lower = disp.n === 2 ? 1e-9 : 1e-2;
    if (a >= 1e10 || a < lower) return expForm(v, 10);
    const r = Number(v.toPrecision(10));
    if (Math.abs(r) >= 1e10) return expForm(v, 10);
    return trimNum(r.toFixed(Math.max(0, 9 - Math.floor(Math.log10(Math.abs(r))))));
  }
  function roundForDisplay(v, disp) {
    disp = disp || { mode: 'Norm', n: 1 };
    if (disp.mode === 'Fix') return Number(v.toFixed(disp.n));
    if (disp.mode === 'Sci') return Number(v.toPrecision(Math.max(1, disp.n)));
    return Number(v.toPrecision(10));
  }
  function formatDMS(v) {
    if (!Number.isFinite(v)) return 'Math ERROR';
    if (Math.abs(v) >= 1e7) return formatNumber(v);
    const sign = v < 0 ? '-' : '';
    let a = Math.abs(v);
    let d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf + 1e-9), s = (mf - m) * 60;
    const dec = Math.max(0, Math.min(4, 8 - String(d).length));
    s = Number(s.toFixed(dec));
    if (s >= 60) { s -= 60; m++; }
    if (m >= 60) { m -= 60; d++; }
    if (s < 0) s = 0;
    return sign + d + '°' + m + '\'' + trimNum(String(s)) + '"';
  }
  // 小数を分数で表す（S⇔D 用）。表せないときは null
  function toFraction(v) {
    if (!Number.isFinite(v) || Number.isInteger(v) || Math.abs(v) >= 1e10) return null;
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, x = Math.abs(v);
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(x), h2 = a * h1 + h0, k2 = a * k1 + k0;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (k1 > 1e6) return null;
      if (Math.abs(Math.abs(v) - h1 / k1) < 1e-10 * Math.max(1, Math.abs(v))) break;
      x = 1 / (x - a); if (!Number.isFinite(x)) break;
    }
    if (k1 <= 1 || k1 > 1e6 || Math.abs(Math.abs(v) - h1 / k1) > 1e-10 * Math.max(1, Math.abs(v))) return null;
    const sign = v < 0 ? '-' : '', w = Math.floor(h1 / k1), r = h1 - w * k1;
    return sign + (w ? w + '⌟' + r + '⌟' + k1 : h1 + '⌟' + k1);
  }

  // 変数・配列メモリー（A〜Z と Z[n]。A[1]=B のように並びが続く）
  const FxMemory = {
    MAX: 2372,
    indexOf(letter, n) {
      if (!Number.isInteger(n)) throw new CalcError('Argument ERROR', '添字は整数');
      const k = LETTERS.indexOf(letter) + n;
      if (k < 0) throw new CalcError('Argument ERROR', '添字が範囲外');
      return k;
    },
    get(vars, k) {
      if (k < 26) return vars[LETTERS[k]] || 0;
      const ext = vars.__z || [];
      if (k - 25 > (vars.__dim || 0)) throw new CalcError('Memory ERROR', 'Z[' + (k - 25) + '] は未確保（n→DimZ で確保）');
      return ext[k - 26] || 0;
    },
    set(vars, k, value) {
      if (k < 26) { vars[LETTERS[k]] = value; return; }
      if (k - 25 > (vars.__dim || 0)) throw new CalcError('Memory ERROR', 'Z[' + (k - 25) + '] は未確保（n→DimZ で確保）');
      if (!vars.__z) vars.__z = [];
      vars.__z[k - 26] = value;
    },
    dim(vars) { return vars.__dim || 0; },
    setDim(vars, n) {
      if (!Number.isInteger(n) || n < 0 || n > this.MAX) throw new CalcError('Argument ERROR', 'DimZ は 0〜' + this.MAX);
      vars.__dim = n;
      vars.__z = (vars.__z || []).slice(0, n);
    }
  };

  const api = { CalcError, normalize, tokenize, evaluate, variablesIn, formatNumber, formatDMS, toFraction, roundForDisplay, LETTERS };
  root.FxEngine = api;
  root.FxMemory = FxMemory;
  if (typeof module !== 'undefined') module.exports = { ...api, FxMemory };
})(typeof globalThis !== 'undefined' ? globalThis : window);
