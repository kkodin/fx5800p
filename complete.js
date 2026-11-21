// 入力候補と命令のまとまり（電卓とエディターで共通）
(function (root) {
  'use strict';
  // [表示, 入れる文字（| はカーソル位置）, 説明, 別名]
  const WORDS = [
    ['Abs(', 'Abs(', '絶対値'], ['And', ' And ', 'かつ'], ['Ans', 'Ans', '直前の答え'],
    ['Break', 'Break', 'ループを抜ける'], ['Cls', 'Cls', '画面を消す'], ['ClrMemory', 'ClrMemory', 'A〜Z を0に'],
    ['cos(', 'cos(', 'コサイン'], ['cos⁻¹(', 'cos⁻¹(', '逆コサイン', 'acos'], ['cosh(', 'cosh(', ''],
    ['Deg', 'Deg', '角度を度に'], ['DimZ', 'DimZ', '配列の確保 n→DimZ'], ['Do', 'Do\n|\nLpWhile ', 'Do〜LpWhile ブロック'], ['Dsz', 'Dsz ', '1引いて0なら次をとばす'],
    ['e^(', 'e^(', 'eのべき乗', 'exp'], ['Else', 'Else ', ''], ['Fix', 'Fix ', '小数の桁を固定'],
    ['For', 'For 1→I To |\n\nNext', 'For〜Next ブロック'], ['For（1行）', 'For |→I To ', 'For だけ'], ['Frac(', 'Frac(', '小数部分'],
    ['GCD(', 'GCD(', '最大公約数'], ['Getkey', 'Getkey', '押したキーのコード'], ['Goto', 'Goto ', 'Lbl へ飛ぶ'], ['Gra', 'Gra', '角度をグラードに'],
    ['If', 'If |\nThen \nIfEnd', 'If〜Then〜IfEnd ブロック'], ['If Else', 'If |\nThen \nElse \nIfEnd', 'If〜Else〜IfEnd ブロック'], ['IfEnd', 'IfEnd', ''],
    ['Int(', 'Int(', '整数部分'], ['Intg(', 'Intg(', 'それ以下の最大の整数'], ['Isz', 'Isz ', '1足して0なら次をとばす'],
    ['LCM(', 'LCM(', '最小公倍数'], ['Lbl', 'Lbl ', 'ラベル'], ['Locate', 'Locate 1,1,|', '位置を決めて表示 列,行,値'],
    ['log(', 'log(', '常用対数（log(a,b) も可）'], ['ln(', 'ln(', '自然対数'], ['LpWhile', 'LpWhile ', ''],
    ['Neg(', 'Neg(', '符号反転'], ['Next', 'Next', ''], ['Norm', 'Norm 1', '表示を通常に'], ['Not(', 'Not(', '否定'],
    ['Or', ' Or ', 'または'], ['Pol(', 'Pol(|)', '直交→極座標（I=距離, J=角度）'], ['Prog', 'Prog "|"', 'サブルーチンを呼ぶ'],
    ['Rad', 'Rad', '角度をラジアンに'], ['Ran#', 'Ran#', '0〜1の乱数'], ['RanInt#(', 'RanInt#(|)', '整数の乱数 (a,b)'],
    ['Rec(', 'Rec(|)', '極→直交座標（I=X, J=Y）'], ['Return', 'Return', '呼び出し元へ戻る'], ['Rnd(', 'Rnd(', '表示桁で丸める'],
    ['Sci', 'Sci ', '有効桁数'], ['sin(', 'sin(', 'サイン'], ['sin⁻¹(', 'sin⁻¹(', '逆サイン', 'asin'], ['sinh(', 'sinh(', ''],
    ['Step', ' Step ', 'For の刻み'], ['Stop', 'Stop', '終了'], ['Then', 'Then ', ''], ['To', ' To ', 'For の終わり'],
    ['tan(', 'tan(', 'タンジェント'], ['tan⁻¹(', 'tan⁻¹(', '逆タンジェント', 'atan'], ['tanh(', 'tanh(', ''],
    ['While', 'While |\n\nWhileEnd', 'While〜WhileEnd ブロック'], ['WhileEnd', 'WhileEnd', ''], ['Xor', ' Xor ', '排他的論理和'],
    ['▸DMS', '▸DMS', '度分秒で表示', 'DMS'], ['π', 'π', '円周率', 'pi'], ['√(', '√(', '平方根', 'sqrt'], ['∛(', '∛(', '立方根', 'cbrt'],
    ['Z[ ]', 'Z[|]', '配列 Z[n]', 'Z['], ['°', '°', '度分秒の入力 2°30°15°', 'do dms'],
    ['?→', '?→', '入力', 'input'], ['◢', '◢', '表示して止める', 'disp']
  ];

  // 前の語（英字の並び）から候補を探す
  const strip = s => s.replace(/^[\s▸]+/, '').toLowerCase();
  function match(word, opt) {
    const w = String(word || '').toLowerCase();
    if (!w) return [];
    let list = WORDS.filter(([label, , , alias]) => strip(label).startsWith(w) || (alias || '').split(' ').some(x => x && x.toLowerCase().startsWith(w)));
    if (opt && opt.oneLine) list = list.filter(x => !x[1].includes('\n'));
    // ちょうど打ち終えた1語しか無いときは出さない
    if (list.length === 1 && strip(list[0][0]).replace(/\($/, '') === w && !list[0][1].includes('\n')) return [];
    return list.slice(0, 9);
  }

  // 1つの命令として扱う文字の並び（DEL で丸ごと消す）。長いものから照合する。
  const TOKENS = [
    'sinh⁻¹(', 'cosh⁻¹(', 'tanh⁻¹(', 'sin⁻¹(', 'cos⁻¹(', 'tan⁻¹(', 'sinh(', 'cosh(', 'tanh(', 'sin(', 'cos(', 'tan(',
    'log(', 'ln(', 'e^(', '10^(', '√(', '∛(', 'ˣ√(', '^(', 'Abs(', 'Int(', 'Intg(', 'Frac(', 'Rnd(', 'Pol(', 'Rec(',
    'RanInt#(', 'Ran#', 'GCD(', 'LCM(', 'Not(', 'Neg(', 'Ans', '▸DMS', '⁻¹', 'Getkey', 'DimZ', 'ClrMemory',
    'If ', 'Then ', 'Then', 'Else ', 'Else', 'IfEnd', 'For ', ' To ', ' Step ', 'Next', 'While ', 'WhileEnd', 'Do', 'LpWhile ',
    'Lbl ', 'Goto ', 'Prog ', 'Return', 'Stop', 'Break', 'Isz ', 'Dsz ', 'Locate ', 'Cls', 'Fix ', 'Sci ', 'Norm ',
    'Deg', 'Rad', 'Gra', ' And ', ' Or ', ' Xor '
  ].sort((a, b) => b.length - a.length);
  // text の末尾が命令で終わっていれば、その長さを返す（語の途中は対象外）
  function tokenBefore(text) {
    for (const t of TOKENS) {
      if (!text.endsWith(t)) continue;
      const prev = text.slice(0, text.length - t.length).slice(-1);
      if (/^[A-Za-z]/.test(t) && /[A-Za-z]/.test(prev)) continue;
      return t.length;
    }
    return 0;
  }

  root.FxComplete = { WORDS, match, tokenBefore, TOKENS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
