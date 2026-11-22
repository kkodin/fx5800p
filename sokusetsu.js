// 測設の計算をまとめる（画面に依存しない）
//   入力 calc：{
//     k1: { name, x, y }, k2: { name, x, y },          既知点1（先に視準）・既知点2
//     o1: { h: '0-00-00', s: '44.721' }, o2: {...},     観測値（文字のまま）
//     targets: [{ id, name, mode: 'xy'|'obs', x, y, h, s, done }]
//   }
//   設定 st：{ dmsDot, zero: 'k1'|'raw', tol }
(function (root) {
  'use strict';
  const A = root.FxAngle, G = root.FxGeo;

  function readNum(v) {
    if (v == null) return NaN;
    const t = String(v).normalize('NFKC').replace(/[−‐–ー]/g, '-').replace(/,/g, '').trim();
    return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : NaN;
  }
  // 観測値を読む。{ h, s, errH, errS }
  function readObs(o, st) {
    const r = { h: NaN, s: NaN, errH: '', errS: '' };
    const ht = o && o.h != null ? String(o.h).trim() : '', sv = o && o.s != null ? String(o.s).trim() : '';
    if (ht) { try { r.h = A.parse(ht, { dmsDot: !!st.dmsDot }); } catch (e) { r.errH = e.message; } }
    if (sv) { r.s = readNum(sv); if (!Number.isFinite(r.s)) r.errS = '距離を数字で入れてください'; else if (r.s <= 0) { r.errS = '距離は 0 より大きくしてください'; r.s = NaN; } }
    return r;
  }

  function compute(calc, st) {
    st = st || {};
    const out = { ready: false, error: '', obs1: readObs(calc.o1, st), obs2: readObs(calc.o2, st), fs: null, station: null, ref: null, targets: [] };
    const k1 = calc.k1, k2 = calc.k2;
    const okPt = p => p && G.isPoint(p);
    const missing = [];
    if (!okPt(k1)) missing.push('既知点1');
    if (!okPt(k2)) missing.push('既知点2');
    if (!Number.isFinite(out.obs1.h) || !Number.isFinite(out.obs1.s)) missing.push('既知点1の角度・距離');
    if (!Number.isFinite(out.obs2.h) || !Number.isFinite(out.obs2.s)) missing.push('既知点2の角度・距離');
    if (missing.length) out.error = missing.join('・') + 'を入れてください';
    else {
      try {
        out.fs = G.freeStation(k1, k2, out.obs1, out.obs2, { tol: st.tol == null ? 0.010 : st.tol });
        out.station = out.fs.station;
        out.ref = st.zero === 'raw' ? out.fs.zero : G.azimuth(out.station, k1);
        out.ready = true;
      } catch (e) { out.error = e.message; }
    }
    for (const t of calc.targets || []) {
      const r = { id: t.id, name: t.name, mode: t.mode || 'xy', done: !!t.done, x: NaN, y: NaN, h: NaN, s: NaN, az: NaN, error: '' };
      if (r.mode === 'obs') {
        const o = readObs(t, st);
        r.h = o.h; r.s = o.s;
        if (o.errH || o.errS) r.error = o.errH || o.errS;
        else if (!Number.isFinite(o.h) || !Number.isFinite(o.s)) r.error = '角度と距離を入れてください';
        else if (out.ready) { const p = G.observe(out.station, out.ref, o.h, o.s); r.x = p.x; r.y = p.y; r.az = A.norm360(out.ref + o.h); }
      } else {
        r.x = t.x; r.y = t.y;
        if (!G.isPoint(t)) r.error = '座標がありません';
        else if (out.ready) { const so = G.stakeout(out.station, out.ref, t); r.h = so.h; r.s = so.s; r.az = so.az == null ? NaN : so.az; }
      }
      out.targets.push(r);
    }
    return out;
  }

  // 履歴に残す形（入力と答えを両方）
  function snapshot(calc, res, st, memo) {
    const pt = p => p ? { name: p.name, x: p.x, y: p.y } : null;
    return {
      input: JSON.parse(JSON.stringify({ k1: calc.k1, k2: calc.k2, o1: calc.o1, o2: calc.o2, targets: calc.targets })),
      settings: { dmsDot: !!st.dmsDot, zero: st.zero || 'k1', tol: st.tol == null ? 0.010 : st.tol },
      k1: pt(calc.k1), k2: pt(calc.k2),
      station: res.station ? { x: res.station.x, y: res.station.y } : null,
      check: res.fs ? { dObs: res.fs.check.dObs, dCoord: res.fs.check.dCoord, diff: res.fs.check.diff, ok: res.fs.check.ok, between: res.fs.check.between, scale: res.fs.check.scale } : null,
      warnings: res.fs ? res.fs.warnings.slice() : [],
      targets: res.targets.map(t => ({ name: t.name, mode: t.mode, x: t.x, y: t.y, h: t.h, s: t.s, done: t.done })),
      memo: memo || ''
    };
  }

  // 履歴の CSV（測点 1 点で 1 行）
  function historyCsv(calcs, fmtAngle) {
    const f = v => Number.isFinite(v) ? v.toFixed(3) : '';
    const cell = s => { s = String(s == null ? '' : s); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [['日時', '既知点1', '既知点2', '器械点X', '器械点Y', '既知点間の差(m)', '点検', '測点', '水平角', '水平距離', 'X', 'Y', '済', 'メモ']];
    for (const c of calcs) {
      const base = [new Date(c.time).toLocaleString('ja-JP'), c.k1 && c.k1.name, c.k2 && c.k2.name, c.station && f(c.station.x), c.station && f(c.station.y), c.check && c.check.diff.toFixed(4), c.check ? (c.check.ok ? 'OK' : 'NG') : ''];
      const ts = c.targets && c.targets.length ? c.targets : [null];
      for (const t of ts) rows.push(base.concat(t ? [t.name, Number.isFinite(t.h) ? fmtAngle(t.h) : '', f(t.s), f(t.x), f(t.y), t.done ? '済' : ''] : ['', '', '', '', '', ''], [c.memo]));
    }
    return rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  // 電卓（実機 fx-5800P）版の測設プログラム。アプリの測設と同じ計算をする
  //   入力：既知点1・2 の X・Y、既知点1・2 の水平角（°′″ キーで入れる）・水平距離
  //   出力：既知点間の差（mm）、器械点 X・Y。そのあと測点の X・Y を入れるたびに水平角（既知点1を 0）と水平距離
  //   変数：A〜D 既知点、E〜H 観測、M〜P 器械から見た既知点、Q・T 角、R・S 距離、U・V 器械点、W 既知点1の方向、X・Y 測点、L・Z 答え
  function calcProgram() {
    const source = [
      'Deg:Fix 3',
      '"K1X"?→A:"K1Y"?→B',
      '"K2X"?→C:"K2Y"?→D',
      '"H1"?→E:"S1"?→F',
      '"H2"?→G:"S2"?→H',
      'Rec(F,E):I→M:J→N',
      'Rec(H,G):I→O:J→P',
      'Pol(C-A,D-B):I→R:J→Q',
      'Pol(O-M,P-N):I→S:Q-J→T',
      '"DIFF(MM)":(S-R)×1000◢',
      'Rec(F,E+T):A-I→U:B-J→V',
      'Rec(H,G+T):(U+C-I)÷2→U:(V+D-J)÷2→V',
      '"OX":U◢',
      '"OY":V◢',
      'Pol(A-U,B-V):J→W',
      'Lbl 1',
      '"PX"?→X:"PY"?→Y',
      'Pol(X-U,Y-V):I→L:J-W→Z',
      'If Z<0:Then Z+360→Z:IfEnd',
      '"HA":Z▸DMS◢',
      '"HD":L◢',
      'Goto 1'
    ].join('\n');
    return { name: 'SOKUSETU', mode: 'COMP', source };
  }

  // ---- 実機用のプログラム一式（既知点 N 点・高さ付き、SUB を共有） ----
  //   変数の決まり（ほかのプログラムとも合わせる）：
  //     U・V＝器械点 X・Y、W＝器械の 0 方向の方向角、X・Y＝いまの測点、S＝器械点の地盤高
  //     R＝器械高、T＝ターゲット高、O＝高さを使う（1）／使わない（0）
  //     I・J は Pol(・Rec( が書き換えるので、値を残す用には使わない
  //   NINI（本体）：既知点を N 点観測して器械点を求め（最小二乗・縮尺 1）、測点ごとに HA・HD（と VD）を出す
  //   HADI（SUB）：器械点 U・V、0 方向 W から、測点 X・Y への HA・HD を表示（ほかの測設プログラムでも使う）
  //   OBXY（SUB）：器械点 U・V、0 方向 W と、観測 H（角）・L（距離）から X・Y を出す（KAIHOU 型の計算に使う）
  //   KANSOKU：NINI のあとで、観測した点の座標を出す（OBXY を使う）
  function calcPrograms() {
    const nini = [
      'Deg:Fix 3',
      '"Z 1/0"?→O',
      'If O=1:Then "HI"?→R:"HT"?→T:IfEnd',
      '"N"?→N',
      '0→A:0→B:0→C:0→D:0→E:0→F:0→G:0→M:0→S',
      'For 1→K To N',
      '"KX"?→P:"KY"?→Q',
      // 桁落ちを防ぐため、1 点目の既知点を原点にずらして足し合わせる（U・V に一時的に入れておく）
      'If K=1:Then P→U:Q→V:IfEnd',
      'P-U→P:Q-V→Q',
      '"HA"?→H:"HD"?→L',
      'Rec(L,H)',
      'A+I→A:B+J→B:C+P→C:D+Q→D',
      'E+I×P+J×Q→E:F+I×Q-J×P→F',
      'G+I²+J²→G:M+P²+Q²→M',
      'If O=1:Then "KZ"?→Z:"VD"?→H:S+Z+T-H-R→S:IfEnd',
      'Next',
      'E-(A×C+B×D)÷N→E',
      'F-(A×D-B×C)÷N→F',
      'G-(A²+B²)÷N→G',
      'M-(C²+D²)÷N→M',
      'Pol(E,F):J→W',
      '"SCALE":I÷G◢',
      '"RMS(MM)":√(Abs(M+G-2I)÷(2N-3))×1000◢',
      'Pol(A,B):Rec(I,J+W)',
      '(C-I)÷N+U→U:(D-J)÷N+V→V',
      '"OX":U◢',
      '"OY":V◢',
      'If O=1:Then S÷N→S:"OZ":S◢IfEnd',
      'Lbl 1',
      '"PX"?→X:"PY"?→Y',
      'Prog "HADI"',
      'If O=1:Then "PZ"?→Z:"VD":Z+T-S-R◢IfEnd',
      'Goto 1'
    ].join('\n');
    const hadi = [
      'Pol(X-U,Y-V)',
      'J-W→K',
      'If K<0:Then K+360→K:IfEnd',
      '"HA":K▸DMS◢',
      '"HD":I◢'
    ].join('\n');
    const obxy = 'Rec(L,H+W):U+I→X:V+J→Y';
    const kansoku = [
      'Deg:Fix 3',
      'Lbl 2',
      '"HA"?→H:"HD"?→L',
      'Prog "OBXY"',
      '"X":X◢',
      '"Y":Y◢',
      'Goto 2'
    ].join('\n');
    // TYOKUSEN（直した版）：KAIHOU の答え X・Y が直線（IP の T・S、方向角 M）の右か左か。
    //   元の版は cos⁻¹ で角度を求め直していたため、点が IP より西（Y が小さい）だと狂った（改修案 21 章）
    const tyokusen = [
      '"IP-X"?T:"IP-Y"?S:?X:?Y',
      'Pol(X-T,Y-S)',
      '"IA"?M',
      'sin(J-M)×I→N',
      'If N<0:Then "HIDARI":Abs(N)',
      'Else "MIGI":Abs(N)',
      'IfEnd'
    ].join('\n');
    return [
      { name: 'TYOKUSEN', mode: 'COMP', source: tyokusen, title: '直線の右・左（直した版。KAIHOU の X・Y を使う）', uses: '読む X・Y／書く T・S・M・N・I・J（KAIHOU の A〜D・G・H・K は使わない）' },
      { name: 'NINI', mode: 'COMP', source: nini, title: '任意点設置と測設（既知点 N 点・高さ）', uses: 'A〜I・J・K・L・M・N・O・P・Q・R・S・T・U・V・W・X・Y・Z（全部）' },
      { name: 'HADI', mode: 'COMP', source: hadi, title: 'SUB：測点への角度と距離', uses: '読む U・V・W・X・Y／書く I・J・K' },
      { name: 'OBXY', mode: 'COMP', source: obxy, title: 'SUB：観測から座標', uses: '読む U・V・W・H・L／書く I・J・X・Y' },
      { name: 'KANSOKU', mode: 'COMP', source: kansoku, title: '観測した点の座標（NINI のあと）', uses: '読む U・V・W／書く H・L・I・J・X・Y' }
    ];
  }

  root.FxSokusetsu = { compute, snapshot, historyCsv, readNum, readObs, calcProgram, calcPrograms };
})(typeof globalThis !== 'undefined' ? globalThis : window);
