// 座標の計算（測設・ほかの座標系プログラムで共通に使う）
//   約束：X＝北、Y＝東。方向角は北から時計回り（度）。器械の水平角も時計回り。距離は水平距離
//   点は { x, y } の形（name などほかの項目が付いていてもよい）
(function (root) {
  'use strict';
  const RAD = Math.PI / 180;
  const n360 = a => { let v = a % 360; if (v < 0) v += 360; return v >= 360 ? 0 : v; };
  const n180 = a => { const v = n360(a); return v > 180 ? v - 360 : v; };

  function fail(msg) { const e = new Error(msg); e.kind = 'geo'; return e; }
  function isPoint(p) { return p && Number.isFinite(p.x) && Number.isFinite(p.y); }
  function need(p, label) { if (!isPoint(p)) throw fail(label + 'の座標がありません'); }

  // 2 点間の距離
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  // a から b への方向角（度、0〜360）
  function azimuth(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx === 0 && dy === 0) throw fail('同じ位置の 2 点では方向角が決まりません');
    return n360(Math.atan2(dy, dx) / RAD);
  }
  // o から方向角 az・距離 s の点
  function polar(o, s, az) { return { x: o.x + s * Math.cos(az * RAD), y: o.y + s * Math.sin(az * RAD) }; }
  // 点を原点のまわりに deg 度だけ時計回り（方向角が増える向き）に回す
  function rotate(p, deg) {
    const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  }

  // 既知点 2 点の観測から器械点を求める（縮尺は 1 に固定）
  //   k1, k2：既知点 {x,y}（k1 を先に視準）
  //   o1, o2：観測 { h: 水平角（度）, s: 水平距離 }
  //   opt.tol：既知点間の距離の差の許容値（m、初期 0.010）
  function freeStation(k1, k2, o1, o2, opt) {
    opt = opt || {};
    const tol = opt.tol == null ? 0.010 : opt.tol;
    need(k1, '既知点1'); need(k2, '既知点2');
    for (const [o, l] of [[o1, '既知点1'], [o2, '既知点2']]) {
      if (!o || !Number.isFinite(o.h) || !Number.isFinite(o.s)) throw fail(l + 'の観測値（角度・距離）がありません');
      if (!(o.s > 0)) throw fail(l + 'までの距離は 0 より大きくしてください');
    }
    const dCoord = dist(k1, k2);
    if (dCoord < 1e-6) throw fail('既知点1と既知点2が同じ位置です');
    // 器械から見た既知点の位置（器械の 0 方向を X 軸とする）
    const p1 = polar({ x: 0, y: 0 }, o1.s, o1.h), p2 = polar({ x: 0, y: 0 }, o2.s, o2.h);
    const dObs = dist(p1, p2);
    if (dObs < 1e-6) throw fail('観測した 2 点が同じ位置になります。角度と距離を確かめてください');
    // 器械の 0 方向が向いている方向角
    const zero = n360(azimuth(k1, k2) - azimuth(p1, p2));
    const r1 = rotate(p1, zero), r2 = rotate(p2, zero);
    const a = { x: k1.x - r1.x, y: k1.y - r1.y }, b = { x: k2.x - r2.x, y: k2.y - r2.y };
    const station = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // 点検
    const diff = dObs - dCoord;
    const between = Math.abs(n180(o2.h - o1.h));      // 器械から見た 2 点の間の角
    const warnings = [];
    if (Math.abs(diff) > tol) warnings.push('既知点間の距離の差が許容値（' + (tol * 1000).toFixed(0) + ' mm）を超えています。既知点の選び間違い・観測の打ち間違いがないか確かめてください');
    if (between < 30 || between > 150) warnings.push('器械から見た既知点 2 点の間の角が ' + between.toFixed(1) + '° です。30〜150° から外れると器械点の精度が落ちます');
    return {
      station, zero,
      check: {
        dObs, dCoord, diff, tol, ok: Math.abs(diff) <= tol,
        scale: dCoord / dObs, between,
        // 2 つの既知点から出した器械点の食い違い（縮尺 1 で合わせた残り）
        spread: dist(a, b)
      },
      warnings
    };
  }

  // 測設：器械点 st から点 t へ向けるための水平角と距離
  //   ref：0 にする方向の方向角。既知点1を 0 にセットするなら azimuth(st, k1)、
  //        器械の読みをそのまま使うなら freeStation の zero
  function stakeout(st, ref, t) {
    need(st, '器械点'); need(t, '測点');
    const s = dist(st, t);
    if (s < 1e-6) return { h: 0, s: 0, az: null, x: t.x, y: t.y };
    const az = azimuth(st, t);
    return { h: n360(az - ref), s, az, x: t.x, y: t.y };
  }

  // 観測から座標：器械点 st、0 方向の方向角 ref、水平角 h・距離 s（KAIHOU と同じ使い方）
  function observe(st, ref, h, s) {
    need(st, '器械点');
    if (!Number.isFinite(h) || !Number.isFinite(s)) throw fail('角度と距離を入れてください');
    const p = polar(st, s, n360(ref + h));
    return { x: p.x, y: p.y };
  }

  root.FxGeo = { dist, azimuth, polar, rotate, freeStation, stakeout, observe, isPoint };
})(typeof globalThis !== 'undefined' ? globalThis : window);
