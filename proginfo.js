// プログラムの日本語の名前・使い方・変数の名前（アプリだけが読む ' の行にして、プログラムの頭に付ける）
//   電卓（実機）へ送るときは ' の行は消える（cclwrite.js）ので、バイト数は変わらない
//   FxProgInfo.attach('NINI', 本文) → ' の行を付けた文
//   FxProgInfo.addToKnown(programs) → 電卓アプリの手持ちのプログラム（KAIHOU など）に、中身が元と同じときだけ説明を付ける
(function (root) {
  'use strict';
  const INFO = {
    // ---- アプリが作る実機用プログラム ----
    TYOKUSEN: {
      name: '直線の右・左のずれ',
      summary: 'KAIHOU で出した点が、直線から右か左に何 m ずれているか',
      usage: ['IP-X・IP-Y：今いる直線の起点（IP）の座標を入れる', 'X・Y：KAIHOU で出た点がそのまま出るので EXE', 'IA：その直線の方向角を °′″ キーで入れる', 'MIGI（右）か HIDARI（左）と、ずれ（m）が出る'],
      vars: { T: '直線の起点（IP）の X', S: '直線の起点（IP）の Y', X: '測った点の X（KAIHOU の答え）', Y: '測った点の Y（KAIHOU の答え）', M: '直線の方向角', N: '直線からのずれ（m・右が＋）', I: 'IP から測った点までの距離（Pol が入れる）', J: 'IP から測った点への方向角（Pol が入れる）' },
      help: ['直した版：点が IP より西（Y が小さい）にあっても正しく出る。KAIHOU の角度 H を書き換えない']
    },
    NINI: {
      name: '任意点設置と測設',
      summary: '既知点を 2 点以上見て器械点を求め、測点ごとに合わせる角度と距離（と高さ）を出す',
      usage: ['Z 1/0：高さも出すなら 1、平面だけなら 0', '高さありなら HI（器械高）、HT（ターゲット高）', 'N：見る既知点の数（2 点以上）', '既知点ごとに KX・KY（座標）、HA（水平角、°′″ キー）、HD（水平距離）。高さありなら KZ（既知点の標高）、VD（高低差）', 'SCALE（1 に近いほどよい）、RMS(MM)（観測のばらつき）、OX・OY（器械点）、OZ（器械点の地盤高）が出る', 'PX・PY に測点の座標を入れるたびに HA・HD が出る。高さありなら PZ（計画高）を入れると、合わせる VD が出る', 'AC で終わり。SUB の HADI を一緒に送っておく'],
      vars: { O: '高さを使う（1）／使わない（0）', R: '器械高', T: 'ターゲット高', N: '既知点の数', K: '何点目の既知点か（くり返しの番号）', P: '既知点の X（入れたあと 1 点目からの差にする）', Q: '既知点の Y（入れたあと 1 点目からの差にする）', H: '既知点の水平角（高さありでは高低差 VD にも使う）', L: '既知点までの水平距離', Z: '既知点の標高／測点の計画高', A: '計算用の合計（器械から見た X の和）', B: '計算用の合計（器械から見た Y の和）', C: '計算用の合計（既知点 X の和）', D: '計算用の合計（既知点 Y の和）', E: '計算用の合計（内積）', F: '計算用の合計（外積）', G: '計算用の合計（距離の 2 乗）', M: '計算用の合計（座標の 2 乗）', U: '器械点の X', V: '器械点の Y', W: '器械の 0 方向の方向角', S: '器械点の地盤高（途中は標高の合計）', X: '測点の X', Y: '測点の Y', I: 'Pol・Rec が入れる値', J: 'Pol・Rec が入れる値' },
      help: ['最小二乗（縮尺 1）で器械点を求める。1 点目の既知点を原点にずらして桁落ちを防ぐ', 'A〜Z を全部使うので、KAIHOU などの値は書き換わる']
    },
    HADI: {
      name: '測点への角度と距離（SUB）',
      summary: '器械点から測点へ向けるための水平角と水平距離を出す（NINI などから呼ぶ）',
      usage: ['自分では動かさない。NINI などのプログラムが Prog "HADI" で呼ぶ', 'U・V（器械点）、W（器械の 0 方向）、X・Y（測点）を使って、HA・HD を出す'],
      vars: { U: '器械点の X', V: '器械点の Y', W: '器械の 0 方向の方向角', X: '測点の X', Y: '測点の Y', K: '合わせる水平角', I: '水平距離（Pol が入れる）', J: '方向角（Pol が入れる）' },
      help: []
    },
    OBXY: {
      name: '観測から座標（SUB）',
      summary: '器械点から測った水平角と水平距離から、その点の座標を出す',
      usage: ['自分では動かさない。KANSOKU などのプログラムが Prog "OBXY" で呼ぶ'],
      vars: { U: '器械点の X', V: '器械点の Y', W: '器械の 0 方向の方向角', H: '水平角', L: '水平距離', X: '測った点の X', Y: '測った点の Y', I: 'Rec が入れる値', J: 'Rec が入れる値' },
      help: []
    },
    KANSOKU: {
      name: '観測した点の座標',
      summary: 'NINI で器械点を決めたあと、測った点の座標を出す',
      usage: ['先に NINI で器械点を決めておく', 'HA（水平角）と HD（水平距離）を入れるたびに X・Y が出る', 'AC で終わり。SUB の OBXY を一緒に送っておく'],
      vars: { H: '水平角', L: '水平距離', X: '測った点の X', Y: '測った点の Y', U: '器械点の X（NINI が入れる）', V: '器械点の Y（NINI が入れる）', W: '器械の 0 方向（NINI が入れる）' },
      help: []
    },
    SENTEI: {
      name: '線形を入れる',
      summary: '曲線の数・BP〜IP・半径・交角・向き・IP 間・最後の直線を入れて、線形を覚える（最初に 1 回）',
      usage: ['BP-X・BP-Y：BP（路線の始まり）の座標', 'HOUKOU：BP→IP1 の方向角（°′″ キー）', 'N：曲線の数', 'BP-IP：BP から IP1 までの距離', '曲線ごとに R（半径）、IA（交角、°′″ キー）、MUKI（右曲線＝1、左曲線＝−1）', 'その曲線のあとの直線の方向角 HOUKOU が出る', 'IP-IP：次の IP までの距離（最後の曲線では IP-EP＝最後の直線の距離）', '最後に EP KYORI（BP から EP までの距離）が出る'],
      vars: { X: 'BP の X（途中は各直線の始点）', Y: 'BP の Y（途中は各直線の始点）', W: '直線の方向角', N: '曲線の数', L: '距離（BP〜IP・IP 間・最後の直線）', R: '曲線の半径', O: '交角（右＋・左−）', T: '向き（1／−1）、そのあと接線長 TL', M: '何本目の曲線か', Z: 'BP からの距離（たし算していく）', E: 'IP の X', F: 'IP の Y', P: 'BC の X', Q: 'BC の Y', U: '向き（1／−1）', S: 'Z[ ] の番号', 'Z[1]': '曲線の数' },
      help: ['線形は Z[1]〜Z[11N+6] に覚える', 'KAIHOU の A〜D・G・H・K は使わない', 'Z[ ] の命令コードが未確定なので、実機には手で打ち込む']
    },
    SENKEI: {
      name: '線形と照合（右・左のずれ）',
      summary: '測った点が、第何直線・第何曲線の、BP から何 m の所で、右か左に何 mm ずれているか',
      usage: ['先に SENTEI で線形を入れておく', '-FX-・-FY-：KAIHOU で出た点がそのまま出るので EXE', 'TYOKUSEN（第何直線）か KYOKUSEN（第何曲線）が出る', 'KYORI：BP からの距離', 'MIGI（右）か HIDARI（左）と、ずれ（mm）', 'どの区間の範囲にも入らないときは SOTO(HANI-GAI)'],
      vars: { X: '測った点の X（KAIHOU の答え）', Y: '測った点の Y（KAIHOU の答え）', N: '曲線の数（Z[1] から）', M: '調べている区間の番号', S: 'Z[ ] の番号', Q: 'いちばん近い区間の目安', O: 'ずれ（m・右が＋）', L: 'BP からの距離', P: '区間（＋＝第何直線、−＝第何曲線）', T: '区間の中の位置', R: 'この区間でのずれ', W: '範囲の中か外か', U: '曲線の向き（1／−1）', E: '計算用', F: '計算用' },
      help: ['KAIHOU の A〜D・G・H・K は使わないので、KAIHOU → SENKEI → KAIHOU と続けて使える', '区間の選び方は曲線総合プログラムと同じ（範囲内の曲線 → 範囲内の直線 → 範囲外）']
    },
    // ---- 利用者の手持ちのプログラム（電卓から吸い出したもの） ----
    KAIHOU: {
      name: '開放トラバース・放射',
      summary: '後視点・機械点から、距離と角度で測った点の座標（-FX-・-FY-）を出す',
      usage: ['SUB1 が BX・BY（後視点）、OX・OY（機械点）を聞く。前回のままなら EXE だけ', 'KYORI（水平距離）と KAKUDO（後視点を 0 にした水平角）を入れる', '-FX-・-FY- に測った点の座標が出る', 'K：0＝開放トラバース（後視点←機械点、機械点←測った点に進める）、1＝放射（同じ機械点で続ける）', 'もう一度 EXE で次の点へ'],
      vars: { A: '後視点の X', B: '後視点の Y', C: '機械点の X', D: '機械点の Y', G: '水平距離', H: '水平角（後視点を 0）', J: '後視点の方向角（SUB1 の Pol が入れる）', I: 'Pol・Rec が入れる値', K: '0＝開放トラバース、1＝放射', X: '測った点の X', Y: '測った点の Y' },
      help: ['SUB1・SUB2 を一緒に使う', 'このあと TYOKUSEN（直線）や KYOKUSEN（曲線）でずれを出せる']
    },
    SUB1: {
      name: '後視点と機械点を入れる（KAIHOU の SUB）',
      summary: '後視点と機械点の座標を聞いて、機械点から後視点への方向角を出す',
      usage: ['KAIHOU が呼ぶ。BX・BY（後視点）、OX・OY（機械点）。前回のままなら EXE だけ'],
      vars: { A: '後視点の X', B: '後視点の Y', C: '機械点の X', D: '機械点の Y', I: '機械点から後視点までの距離（Pol が入れる）', J: '機械点から後視点への方向角（Pol が入れる）' },
      help: []
    },
    SUB2: {
      name: '機械点を進める（KAIHOU の SUB）',
      summary: '開放トラバースで、後視点←今の機械点、機械点←測った点に入れ替える',
      usage: ['KAIHOU で K＝0 のときに呼ばれる'],
      vars: { A: '後視点の X（←機械点の X）', B: '後視点の Y（←機械点の Y）', C: '機械点の X（←測った点の X）', D: '機械点の Y（←測った点の Y）', X: '測った点の X', Y: '測った点の Y' },
      help: []
    },
    KYOKUSEN: {
      name: '曲線の右・左のずれ',
      summary: 'KAIHOU で出した点が、曲線（中心と半径）から右か左に何 m ずれているか',
      usage: ['TYUUSIN-X-・TYUUSIN-Y-：曲線の中心の座標', '-FX-・-FY-：KAIHOU で出た点がそのまま出るので EXE', '-R-：半径（右曲線は＋、左曲線は−）', 'MIGI（右）か HIDARI（左）と、ずれ（m）が出る'],
      vars: { V: '曲線の中心の X', W: '曲線の中心の Y', X: '測った点の X（KAIHOU の答え）', Y: '測った点の Y（KAIHOU の答え）', R: '半径（右曲線＋・左曲線−）', I: '中心から測った点までの距離（Pol が入れる）', N: 'ずれ（m・右が＋）' },
      help: ['点が曲線の範囲（BC〜EC）の外でも計算する']
    }
  };
  // 手持ちのプログラムの元の中身（電卓から吸い出したもの）。中身が同じときだけ説明を付ける
  const KNOWN = {
    KAIHOU: 'Fix 3:Prog "SUB1":\n"KYORI"?G:"KAKUDO"?H\nRec(G,H+J)+C→X\n"-FX-":X◢J+D→Y\n"-FY-":Y◢"KAIHOU⇒0"\n"HOUSYA⇒1"\n?→K:K=0⇒Prog "SUB2"\nNorm 2',
    SUB1: '"BX"?A:"BY"?B\n"OX"?C:"OY"?D\nPol(A-C,B-D)',
    SUB2: 'C→A:D→B:X→C:Y→D',
    KYOKUSEN: '"TYUUSIN-X-"?V:"TYUUSIN-Y-"?W:"-FX-"?X:"-FY-"?Y\nPol(X-V,Y-W)\n"-R-"?R\nIf R>0:Then Abs(R)-I→N:Else I-Abs(R)→N:IfEnd\nIf N<0:Then "HIDARI":Abs(N):Else "MIGI":N:IfEnd'
  };

  const isNote = l => /^\s*'/.test(l);
  function lines(name) {
    const d = INFO[name]; if (!d) return [];
    const out = ["'名前 " + d.name, "'説明 " + d.summary];
    for (const u of d.usage) out.push("'使い方 " + u);
    const vk = Object.keys(d.vars);
    for (const k of vk) out.push("'変数 " + k + '=' + d.vars[k]);
    for (const h of d.help) out.push("'解説 " + h);
    return out;
  }
  // 本文の頭に ' の行を付ける（すでにある ' の行は付け直す）
  function attach(name, src) {
    const body = String(src || '').replace(/\r\n?/g, '\n').split('\n').filter(l => !isNote(l)).join('\n');
    const ls = lines(name);
    return ls.length ? ls.join('\n') + '\n' + body : body;
  }
  // 比べるために、空白・改行・: を消す
  const norm = s => String(s || '').split('\n').filter(l => !isNote(l)).join('').replace(/[\s:：]/g, '');
  // 電卓アプリのプログラムに説明を付ける。戻り値：{ done: [名前], skipped: [{ name, why }] }
  function addToKnown(programs) {
    const done = [], skipped = [];
    for (const name of Object.keys(KNOWN)) {
      const p = programs.find(x => x.name === name);
      if (!p) continue;
      if (norm(p.source) !== norm(KNOWN[name])) { skipped.push({ name, why: '中身が電卓から吸い出した元のものと違うので、付けませんでした' }); continue; }
      p.source = attach(name, p.source);
      done.push(name);
    }
    return { done, skipped };
  }
  root.FxProgInfo = { INFO, KNOWN, attach, addToKnown, lines };
})(typeof globalThis !== 'undefined' ? globalThis : window);
