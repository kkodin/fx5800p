// FMLA（内蔵公式）。実機の128種のうち、測量・土木でよく使うものを中心に収録。
// 入力: [変数名, 説明, 角度なら 'ang']  出力: [変数名, 説明, 計算関数, 角度なら 'ang']
(function (root) {
  'use strict';
  const PI = Math.PI;
  const F = [
    { name: 'Circle Area', jp: '円の面積', in: [['r', '半径']], out: [['S', '面積', v => PI * v.r * v.r]] },
    { name: 'Sector Area', jp: '扇形の面積', in: [['r', '半径'], ['θ', '中心角', 'ang']], out: [['S', '面積', (v, h) => v.r * v.r * h.rad(v.θ) / 2], ['l', '弧長', (v, h) => v.r * h.rad(v.θ)]] },
    { name: 'Scir&ArcArea', jp: '弦と半径から欠円の面積と弧', in: [['r', '半径'], ['c', '弦長']], out: [['S', '欠円の面積', v => { const t = 2 * Math.asin(v.c / 2 / v.r); return v.r * v.r * (t - Math.sin(t)) / 2; }], ['l', '弧長', v => 2 * v.r * Math.asin(v.c / 2 / v.r)]] },
    { name: 'Ellipse Area', jp: '楕円の面積', in: [['a', '長半径'], ['b', '短半径']], out: [['S', '面積', v => PI * v.a * v.b]] },
    { name: 'T-Zoid Area', jp: '台形の面積', in: [['a', '上底'], ['b', '下底'], ['h', '高さ']], out: [['S', '面積', v => (v.a + v.b) * v.h / 2]] },
    { name: 'Triangle 1', jp: '三角形の面積（2辺と夾角）', in: [['a', '辺a'], ['b', '辺b'], ['C', '夾角C', 'ang']], out: [['S', '面積', (v, h) => v.a * v.b * Math.sin(h.rad(v.C)) / 2]] },
    { name: 'Triangle 2', jp: '座標面積計算（三角形）', in: [['x1', 'X1'], ['y1', 'Y1'], ['x2', 'X2'], ['y2', 'Y2'], ['x3', 'X3'], ['y3', 'Y3']], out: [['S', '面積', v => Math.abs((v.x2 - v.x1) * (v.y3 - v.y1) - (v.x3 - v.x1) * (v.y2 - v.y1)) / 2]] },
    { name: 'HeronFormula', jp: 'ヘロンの公式', in: [['a', '辺a'], ['b', '辺b'], ['c', '辺c']], out: [['S', '面積', v => { const s = (v.a + v.b + v.c) / 2, q = s * (s - v.a) * (s - v.b) * (s - v.c); if (q < 0) throw Error('三角形になりません'); return Math.sqrt(q); }]] },
    { name: 'Area&IntAngl', jp: '三角形の解法（三辺既知）', in: [['a', '辺a'], ['b', '辺b'], ['c', '辺c']], out: [
      ['A', '角A', (v, h) => h.deg(Math.acos((v.b * v.b + v.c * v.c - v.a * v.a) / (2 * v.b * v.c))), 'ang'],
      ['B', '角B', (v, h) => h.deg(Math.acos((v.a * v.a + v.c * v.c - v.b * v.b) / (2 * v.a * v.c))), 'ang'],
      ['C', '角C', (v, h) => h.deg(Math.acos((v.a * v.a + v.b * v.b - v.c * v.c) / (2 * v.a * v.b))), 'ang'],
      ['S', '面積', v => { const s = (v.a + v.b + v.c) / 2; return Math.sqrt(s * (s - v.a) * (s - v.b) * (s - v.c)); }]] },
    { name: 'CosinTheorem', jp: '余弦定理', in: [['b', '辺b'], ['c', '辺c'], ['A', '夾角A', 'ang']], out: [['a', '辺a', (v, h) => Math.sqrt(v.b * v.b + v.c * v.c - 2 * v.b * v.c * Math.cos(h.rad(v.A)))]] },
    { name: 'SineTheorem1', jp: '正弦定理（辺を求める）', in: [['b', '辺b'], ['B', '角B', 'ang'], ['A', '角A', 'ang']], out: [['a', '辺a', (v, h) => v.b * Math.sin(h.rad(v.A)) / Math.sin(h.rad(v.B))]] },
    { name: 'Coord Calc', jp: '方向角と距離による座標計算', in: [['Xa', '既知点X'], ['Ya', '既知点Y'], ['θ', '方向角', 'ang'], ['L', '距離']], out: [['Xb', '求点X', (v, h) => v.Xa + v.L * Math.cos(h.rad(v.θ))], ['Yb', '求点Y', (v, h) => v.Ya + v.L * Math.sin(h.rad(v.θ))]] },
    { name: 'Dist&DirecAn', jp: '逆計算（2点の距離と方向角）', in: [['Xa', '点A X'], ['Ya', '点A Y'], ['Xb', '点B X'], ['Yb', '点B Y']], out: [
      ['L', '距離', v => Math.hypot(v.Xb - v.Xa, v.Yb - v.Ya)],
      ['θ', '方向角', (v, h) => { let t = Math.atan2(v.Yb - v.Ya, v.Xb - v.Xa); if (t < 0) t += 2 * PI; return h.deg(t); }, 'ang']] },
    { name: 'V-Line&Dist', jp: '垂線と距離（三点既知）', in: [['Xa', '点A X'], ['Ya', '点A Y'], ['Xb', '点B X'], ['Yb', '点B Y'], ['Xp', '点P X'], ['Yp', '点P Y']], out: [
      ['L', 'Aから垂線の足まで', v => { const dx = v.Xb - v.Xa, dy = v.Yb - v.Ya, d = Math.hypot(dx, dy); return ((v.Xp - v.Xa) * dx + (v.Yp - v.Ya) * dy) / d; }],
      ['H', '垂線の長さ（右+）', v => { const dx = v.Xb - v.Xa, dy = v.Yb - v.Ya, d = Math.hypot(dx, dy); return ((v.Yp - v.Ya) * dx - (v.Xp - v.Xa) * dy) / d; }]] },
    { name: 'C-PointCoord', jp: '中間点の座標', in: [['Xa', '点A X'], ['Ya', '点A Y'], ['Xb', '点B X'], ['Yb', '点B Y']], out: [['Xc', '中点X', v => (v.Xa + v.Xb) / 2], ['Yc', '中点Y', v => (v.Ya + v.Yb) / 2]] },
    { name: 'Single Curve', jp: '単曲線', in: [['R', '半径'], ['I', '交角', 'ang']], out: [
      ['TL', '接線長', (v, h) => v.R * Math.tan(h.rad(v.I) / 2)],
      ['CL', '曲線長', (v, h) => v.R * h.rad(v.I)],
      ['SL', '外線長', (v, h) => v.R * (1 / Math.cos(h.rad(v.I) / 2) - 1)],
      ['M', '中央縦距', (v, h) => v.R * (1 - Math.cos(h.rad(v.I) / 2))],
      ['C', '弦長', (v, h) => 2 * v.R * Math.sin(h.rad(v.I) / 2)]] },
    { name: 'Stadia Calc', jp: 'スタジア計算', in: [['K', '乗数'], ['l', '挟長'], ['α', '高度角', 'ang']], out: [['D', '水平距離', (v, h) => v.K * v.l * Math.cos(h.rad(v.α)) ** 2], ['H', '高低差', (v, h) => v.K * v.l * Math.sin(h.rad(v.α)) * Math.cos(h.rad(v.α))]] },
    { name: 'SphereVolume', jp: '球の体積', in: [['r', '半径']], out: [['V', '体積', v => 4 / 3 * PI * v.r ** 3]] },
    { name: 'SphereS-Area', jp: '球の表面積', in: [['r', '半径']], out: [['S', '表面積', v => 4 * PI * v.r * v.r]] },
    { name: 'CircCone Vol', jp: '円錐の体積', in: [['r', '半径'], ['h', '高さ']], out: [['V', '体積', v => PI * v.r * v.r * v.h / 3]] },
    { name: 'CircCone Lat', jp: '円錐の側面積', in: [['r', '半径'], ['h', '高さ']], out: [['S', '側面積', v => PI * v.r * Math.hypot(v.r, v.h)]] },
    { name: 'CircCylinVol', jp: '円柱の体積', in: [['r', '半径'], ['h', '高さ']], out: [['V', '体積', v => PI * v.r * v.r * v.h]] },
    { name: 'CircCylinLat', jp: '円柱の側面積', in: [['r', '半径'], ['h', '高さ']], out: [['S', '側面積', v => 2 * PI * v.r * v.h]] },
    { name: 'ArithProgSum', jp: '等差数列の和', in: [['a', '初項'], ['d', '公差'], ['n', '項数']], out: [['S', '和', v => v.n * (2 * v.a + (v.n - 1) * v.d) / 2]] },
    { name: 'GeomProg Sum', jp: '等比数列の和', in: [['a', '初項'], ['r', '公比'], ['n', '項数']], out: [['S', '和', v => v.r === 1 ? v.a * v.n : v.a * (1 - v.r ** v.n) / (1 - v.r)]] },
    { name: 'Squares Sum', jp: '平方の和', in: [['n', 'n']], out: [['S', '和', v => v.n * (v.n + 1) * (2 * v.n + 1) / 6]] },
    { name: 'Cubes Sum', jp: '3乗の和', in: [['n', 'n']], out: [['S', '和', v => (v.n * (v.n + 1) / 2) ** 2]] },
    { name: 'DropDistance', jp: '落下距離', in: [['t', '時間 s']], out: [['h', '距離 m', v => 9.80665 * v.t * v.t / 2]] },
    { name: 'Tension&Comp', jp: '引張・圧縮応力', in: [['P', '荷重'], ['A', '断面積']], out: [['σ', '応力', v => v.P / v.A]] }
  ];
  root.FxFormulas = F.sort((a, b) => a.name.localeCompare(b.name, 'en'));
})(typeof globalThis !== 'undefined' ? globalThis : window);
