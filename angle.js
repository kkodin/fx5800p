// 角度の読み取りと表示（測設・電卓・エディターで共通に使う）
//   読める書き方：45-30-15 ／ 45°30′15″ ／ 45°30°15° ／ 45.30.15（点 2 つ） ／ 全角・似た記号 ／ 10進の度 45.504167
//   設定 dmsDot:true のときは 45.3015 を 45°30′15″（度.分秒）として読む
(function (root) {
  'use strict';

  // 似た記号を揃える
  const SYM = {
    '゜': '°', 'º': '°', '˚': '°', '度': '°',
    '′': '′', '’': '′', '‘': '′', "'": '′', '´': '′', '分': '′',
    '″': '″', '”': '″', '“': '″', '"': '″', '秒': '″',
    '－': '-', '−': '-', '‐': '-', '‑': '-', '–': '-', '—': '-', 'ー': '-', '―': '-',
    '＋': '+', '．': '.', '，': ',', '　': ' '
  };

  function normalize(src) {
    let s = '';
    for (const ch of String(src == null ? '' : src)) {
      if (SYM[ch] !== undefined) { s += SYM[ch]; continue; }
      const c = ch.charCodeAt(0);
      if (c >= 0xFF10 && c <= 0xFF19) { s += String.fromCharCode(c - 0xFEE0); continue; } // 全角数字
      s += ch;
    }
    return s.replace(/\s+/g, '');
  }

  function fail(msg) { const e = new Error(msg); e.kind = 'angle'; return e; }
  const NUM = /^\d+(\.\d+)?$/;
  const INT = /^\d+$/;

  // 度・分・秒の文字列から度を出す（分・秒は 60 未満）
  function fromParts(parts, src) {
    if (parts.length < 1 || parts.length > 3) throw fail('角度の書き方が違います：' + src);
    parts.forEach((p, i) => {
      if (!NUM.test(p)) throw fail('角度に数字でない所があります：' + src);
      if (i < parts.length - 1 && !INT.test(p)) throw fail('小数を使えるのは最後の数だけです：' + src);
    });
    const [d, m = 0, s = 0] = parts.map(Number);
    if (m >= 60) throw fail('分は 60 より小さくしてください：' + src);
    if (s >= 60) throw fail('秒は 60 より小さくしてください：' + src);
    return d + m / 60 + s / 3600;
  }

  // 度.分秒（45.3015 → 45°30′15″、45.3 → 45°30′）
  function fromDmsDot(t, src) {
    if (!NUM.test(t)) throw fail('角度の書き方が違います：' + src);
    const [d, f = ''] = t.split('.');
    const mm = (f + '00').slice(0, 2), ss = (f + '0000').slice(2, 4), rest = f.slice(4);
    return fromParts([d, mm, ss + (rest ? '.' + rest : '')], src);
  }

  // 角度を読む。戻り値は度（10進）。読めないときは Error（kind='angle'）
  function parse(src, opt) {
    opt = opt || {};
    let t = normalize(src);
    if (!t) throw fail('角度が空です');
    let sign = 1;
    if (t[0] === '-' || t[0] === '+') { if (t[0] === '-') sign = -1; t = t.slice(1); }
    if (!t) throw fail('角度が空です');
    let v;
    if (/[°′″]/.test(t)) {
      // 45°30′15″ ／ 45°30°15° ／ 45°30′ ／ 45°
      if (!/^[\d.]+°([\d.]+[°′]([\d.]+[°″]?)?|[\d.]+)?$/.test(t)) throw fail('角度の書き方が違います：' + src);
      const parts = t.replace(/[′″]/g, '°').split('°').filter(p => p !== '');
      v = fromParts(parts, src);
    } else if (t.includes('-')) {
      v = fromParts(t.split('-'), src);
    } else if (/^\d+\.\d+\.\d+(\.\d+)?$/.test(t)) {
      // 点が 2 つ以上：45.30.15 ／ 45.30.15.5（スマホの数字キーボードには - がないため）
      const p = t.split('.');
      v = fromParts(p.length === 4 ? [p[0], p[1], p[2] + '.' + p[3]] : p, src);
    } else if (opt.dmsDot) {
      v = fromDmsDot(t, src);
    } else {
      if (!NUM.test(t)) throw fail('角度の書き方が違います：' + src);
      v = Number(t);
    }
    return sign * v;
  }

  // 読めれば度、読めなければ null
  function tryParse(src, opt) { try { return parse(src, opt); } catch { return null; } }

  // 0 以上 360 未満に直す
  function norm360(deg) { let a = deg % 360; if (a < 0) a += 360; return a === 360 || Object.is(a, -0) ? 0 : a; }
  // -180 より大きく 180 以下に直す（角度の差に使う）
  function norm180(deg) { const a = norm360(deg); return a > 180 ? a - 360 : a; }

  // 度・分・秒に分ける（秒は secDigits 桁で丸め、繰り上がりも処理）
  function toDMS(deg, secDigits) {
    const k = Math.pow(10, secDigits == null ? 0 : secDigits);
    const sign = deg < 0 ? -1 : 1;
    let total = Math.round(Math.abs(deg) * 3600 * k);   // 秒×k の整数
    const s = (total % (60 * k)) / k; total = Math.floor(total / (60 * k));
    const m = total % 60, d = Math.floor(total / 60);
    return { sign, d, m, s };
  }

  // 表示：style 'hyphen' → 161-33-54、'symbol' → 161°33′54″
  //   opt.wrap=false で 0〜360 に直さない（角度の差を出すとき）
  function format(deg, opt) {
    opt = opt || {};
    const digits = opt.secDigits == null ? 0 : opt.secDigits;
    let v = opt.wrap === false ? deg : norm360(deg);
    let r = toDMS(v, digits);
    if (opt.wrap !== false && r.d >= 360) r = toDMS(0, digits);
    const ss = r.s.toFixed(digits).padStart(digits ? 3 + digits : 2, '0');
    const mm = String(r.m).padStart(2, '0');
    const head = r.sign < 0 && (r.d || r.m || r.s) ? '-' : '';
    return opt.style === 'symbol' ? head + r.d + '°' + mm + '′' + ss + '″' : head + r.d + '-' + mm + '-' + ss;
  }

  root.FxAngle = { normalize, parse, tryParse, norm360, norm180, toDMS, format };
})(typeof globalThis !== 'undefined' ? globalThis : window);
