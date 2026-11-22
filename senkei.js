// 線形（直線と曲線）と、測った点の照合
//   曲線総合プログラム（M_APP_005）の buildSurveyGeometry・judgeStraight・judgeCurve・judgePoint と同じ式・同じ選び方
//   座標：X＝北、Y＝東。方向角は北から時計回り（度）
//   線形 a = { bp: {x, y}, az: BP→IP1 の方向角（度）, L0: BP〜IP1, curves: [{ R, dir: 'R'|'L', ia: 交角（度・正）, L: 前の IP からの距離（2 本目から） }], Lf: 最後の IP〜EP }
(function (root) {
  'use strict';
  const RAD = Math.PI / 180;
  const pt = (o, az, d) => ({ x: o.x + d * Math.cos(az), y: o.y + d * Math.sin(az) });

  function build(a) {
    const bp = { name: 'BP', x: a.bp.x, y: a.bp.y };
    let az = a.az * RAD, accum = 0, x = bp.x, y = bp.y, lineStart = bp;
    const points = [bp], curves = [], sections = [];
    const list = (a.curves || []).map((c, i) => i === 0 ? Object.assign({}, c, { L: a.L0 }) : c);
    if (!list.length) {
      const ep = Object.assign(pt(bp, az, a.L0 + a.Lf), { name: 'EP' });
      sections.push({ type: 'st', id: 1, a: bp, b: ep, az, accStart: 0, accEnd: a.L0 + a.Lf, length: a.L0 + a.Lf });
      return { points: [bp, ep], curves, sections, total: a.L0 + a.Lf };
    }
    list.forEach((cd, i) => {
      const id = i + 1, R = +cd.R, IA = cd.ia * RAD, dir = cd.dir === 'L' ? 'L' : 'R', L = +cd.L || 0;
      const TL = R * Math.tan(IA / 2), CL = R * IA, SL = R * (1 / Math.cos(IA / 2) - 1);
      const ip = Object.assign(pt({ x, y }, az, L), { name: 'IP' + id });
      const bc = Object.assign(pt(ip, az, -TL), { name: 'BC' + id });
      const outAz = az + (dir === 'R' ? IA : -IA);
      const ec = Object.assign(pt(ip, outAz, TL), { name: 'EC' + id });
      const ro = Object.assign(pt(bc, az + (dir === 'R' ? Math.PI / 2 : -Math.PI / 2), R), { name: 'RO' + id });
      const straight = Math.hypot(bc.x - lineStart.x, bc.y - lineStart.y);
      const startDist = accum + straight, endDist = startDist + CL;
      sections.push({ type: 'st', id, a: lineStart, b: bc, az, accStart: accum, accEnd: startDist, length: straight });
      const c = { id, dir, R, IA, TL, CL, SL, ip, bc, ec, ro, inAz: az, outAz, startDist, endDist };
      curves.push(c); points.push(ip, bc, ec, ro);
      x = ip.x; y = ip.y; az = outAz; accum = endDist; lineStart = ec;
    });
    const last = curves[curves.length - 1];
    const ep = Object.assign(pt(last.ip, az, a.Lf), { name: 'EP' });
    const fin = Math.hypot(ep.x - last.ec.x, ep.y - last.ec.y);
    sections.push({ type: 'st', id: curves.length + 1, a: last.ec, b: ep, az, accStart: accum, accEnd: accum + fin, length: fin });
    points.push(ep);
    return { points, curves, sections, total: accum + fin };
  }

  // 直線との照合（右が＋）
  function judgeStraight(p, s) {
    const vx = s.b.x - s.a.x, vy = s.b.y - s.a.y, len = Math.hypot(vx, vy) || 1, ux = vx / len, uy = vy / len;
    const wx = p.x - s.a.x, wy = p.y - s.a.y, proj = wx * ux + wy * uy, inside = proj >= 0 && proj <= len;
    const cl = Math.max(0, Math.min(len, proj)), foot = { x: s.a.x + ux * cl, y: s.a.y + uy * cl };
    const ex = p.x - foot.x, ey = p.y - foot.y, signed = ux * ey - uy * ex;
    return { type: 'st', id: s.id, name: '第' + s.id + '直線', offset: signed, errorMm: Math.abs(signed) * 1000, side: signed > 0 ? '右' : '左', priority: inside ? 1 : 9, distFromBP: s.accStart + cl, foot, inside };
  }
  function curveDelta(c, ang) {
    const s = Math.atan2(c.bc.y - c.ro.y, c.bc.x - c.ro.x);
    let d = ang - s;
    if (c.dir === 'R') { while (d < 0) d += Math.PI * 2; while (d > Math.PI * 2) d -= Math.PI * 2; }
    else { while (d > 0) d -= Math.PI * 2; while (d < -Math.PI * 2) d += Math.PI * 2; }
    return d;
  }
  // 曲線との照合（右が＋）。右曲線で中心に近い＝右、左曲線で中心に近い＝左
  function judgeCurve(p, c) {
    const dx = p.x - c.ro.x, dy = p.y - c.ro.y, dist = Math.hypot(dx, dy);
    if (dist <= 1e-9) return { type: 'cv', id: c.id, name: '第' + c.id + '曲線', offset: NaN, errorMm: Infinity, priority: 99, distFromBP: c.startDist };
    const radial = dist - c.R;                      // ＋＝外側
    const delta = curveDelta(c, Math.atan2(dy, dx)), inArc = Math.abs(delta) <= Math.abs(c.IA) + 1e-7;
    const offset = c.dir === 'R' ? -radial : radial; // 右が＋
    const foot = { x: p.x - radial * dx / dist, y: p.y - radial * dy / dist };
    return { type: 'cv', id: c.id, name: '第' + c.id + '曲線 ' + (c.dir === 'L' ? '左' : '右'), offset, errorMm: Math.abs(radial) * 1000, side: offset > 0 ? '右' : offset < 0 ? '左' : '中心', inside: radial < 0 ? '内側' : radial > 0 ? '外側' : '中心', priority: inArc ? 0 : 8, distFromBP: c.startDist + c.R * Math.min(Math.abs(delta), Math.abs(c.IA)), foot, inArc };
  }
  function judge(g, p) {
    const cands = g.sections.map(s => judgeStraight(p, s)).concat(g.curves.map(c => judgeCurve(p, c)));
    cands.sort((a, b) => a.priority - b.priority || a.errorMm - b.errorMm);
    return cands[0] || null;
  }

  // 管の向きと次の予測（曲線総合プログラム 60.8 章と同じ定義）
  //   kp1＝1 本目前、kp2＝1 本目後、kp3＝2 本目前、kp4＝2 本目後。len を省くと kp1〜kp3 の距離
  function predict(kp1, kp2, kp3, kp4, len) {
    const d1 = Math.atan2(kp1.y - kp2.y, kp1.x - kp2.x), d2 = Math.atan2(kp3.y - kp4.y, kp3.x - kp4.x);
    const next = d1 + (d1 - d2), L = len == null ? Math.hypot(kp1.x - kp3.x, kp1.y - kp3.y) : len;
    return { x: kp1.x + L * Math.cos(next), y: kp1.y + L * Math.sin(next), dir1: d1 / RAD, dir2: d2 / RAD, next: next / RAD, bend: (d1 - d2) / RAD, len: L };
  }

  // 実機用：線形を入れて Z[ ] に覚える SENTEI と、照合する SENKEI（KAIHOU の A〜D・G・H・K を書き換えない）
  //   Z[ ] の並び：Z[1]＝曲線の数 N
  //     直線 j（0〜N）：Z[5j+2]〜Z[5j+6] ＝ 始点 X・Y、方向角、長さ、BP からの距離
  //     曲線 i（1〜N）：Z[5N+6i+1]〜Z[5N+6i+6] ＝ 中心 X・Y、半径、交角（右＋・左−）、中心から BC への方向角、BC の BP からの距離
  function calcCurvePrograms() {
  // 日本語の名前・使い方・変数の名前（proginfo.js）を頭に付ける。proginfo.js がなければ本文のまま
  const info = (name, src) => root.FxProgInfo ? root.FxProgInfo.attach(name, src) : src;
    const sentei = [
      'Deg:Fix 3',
      '"BP-X"?→X:"BP-Y"?→Y',
      '"HOUKOU"?→W',
      '"N"?→N',
      '11N+6→DimZ',
      'N→Z[1]',
      '0→Z',
      '"BP-IP"?→L',
      'Rec(L,W):X+I→E:Y+J→F',
      'For 1→M To N',
      '"R"?→R',
      '"IA"?→O',
      '"MUKI R=1 L=-1"?→T',
      'O×T→O',
      'R×tan(Abs(O)÷2)→T',
      'Rec(T,W):E-I→P:F-J→Q',
      '5M-3→S',
      'X→Z[S]:Y→Z[S+1]:W→Z[S+2]',
      'Pol(P-X,Q-Y):I→Z[S+3]:Z→Z[S+4]',
      'Z+I→Z',
      'O÷Abs(O)→U',
      '5N+6M+1→S',
      'Rec(R,W+90U):P+I→Z[S]:Q+J→Z[S+1]',
      'R→Z[S+2]:O→Z[S+3]:W+90U+180→Z[S+4]:Z→Z[S+5]',
      'Z+R×Abs(O)×π÷180→Z',
      'W+O→W',
      'Rec(T,W):E+I→X:F+J→Y',
      '"HOUKOU":W▸DMS◢',
      'If M<N:Then "IP-IP"?→L:Rec(L,W):E+I→E:F+J→F:Else "IP-EP"?→L:IfEnd',
      'Next',
      '5N+2→S',
      'X→Z[S]:Y→Z[S+1]:W→Z[S+2]:L-T→Z[S+3]:Z→Z[S+4]',
      '"EP KYORI":Z+L-T◢'
    ].join('\n');
    const senkei = [
      'Deg:Fix 3',
      '"-FX-"?X:"-FY-"?Y',
      'Z[1]→N',
      '1ᴇ99→Q',
      'For 1→M To N',
      '5N+6M+1→S',
      'Pol(X-Z[S],Y-Z[S+1])',
      'Z[S+3]÷Abs(Z[S+3])→U',
      '(J-Z[S+4])×U→T',
      'T-360Int(T÷360)→T',
      'If T<0:Then T+360→T:IfEnd',
      'U×(Z[S+2]-I)→R',
      '8→W:If T≤Abs(Z[S+3])+1ᴇ-7:Then 0→W:IfEnd',
      'If 1000W+Abs(R)<Q:Then 1000W+Abs(R)→Q:R→O:Z[S+5]+Z[S+2]×T×π÷180→L:-M→P:IfEnd',
      'Next',
      'For 0→M To N',
      '5M+2→S',
      'X-Z[S]→E:Y-Z[S+1]→F',
      'E×cos(Z[S+2])+F×sin(Z[S+2])→T',
      'F×cos(Z[S+2])-E×sin(Z[S+2])→R',
      '9→W:If T≥0 And T≤Z[S+3]:Then 1→W:IfEnd',
      'If 1000W+Abs(R)<Q:Then 1000W+Abs(R)→Q:R→O:Z[S+4]+T→L:M+1→P:IfEnd',
      'Next',
      'If Q≥8000:Then "SOTO(HANI-GAI)"◢IfEnd',
      'If P>0:Then "TYOKUSEN":P◢Else "KYOKUSEN":Abs(P)◢IfEnd',
      '"KYORI":L◢',
      'Fix 1',
      'If O<0:Then "HIDARI(MM)":Abs(O)×1000◢Else "MIGI(MM)":O×1000◢IfEnd',
      'Fix 3'
    ].join('\n');
    return [
      { name: 'SENTEI', mode: 'COMP', source: info('SENTEI', sentei), title: '線形を入れる（曲線の数・BP〜IP・R・交角・向き・IP 間・最後の直線）', uses: '書く E・F・I・J・L・M・N・O・P・Q・R・S・T・U・V・W・X・Y・Z、Z[1]〜Z[11N+6]（A〜D・G・H・K は使わない）' },
      { name: 'SENKEI', mode: 'COMP', source: info('SENKEI', senkei), title: '測った点（-FX-・-FY-）を線形と照合し、区間・BP からの距離・右／左 mm を出す', uses: '読む X・Y（KAIHOU の答え）・Z[ ]／書く E・F・I・J・L・M・N・O・P・Q・R・S・T・U・W（A〜D・G・H・K は使わない）' }
    ];
  }

  root.FxSenkei = { build, judge, judgeStraight, judgeCurve, predict, calcCurvePrograms };
})(typeof globalThis !== 'undefined' ? globalThis : window);
