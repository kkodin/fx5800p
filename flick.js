// 日本語フリックキーボード（電卓の「i」キーでテンキーと切り替える）
//   FxFlick.render(el, { onChar, onBack, onDel, onAc, onExe, onClose })
//   仮想キーボードを使わず、電卓のテンキー枠（5×4）の中でひらがな・カタカナ・漢字・英数を入力する
(function (root) {
  'use strict';

  // [中央, 左, 上, 右, 下]
  const KANA_KEYS = [
    { id: 'a', ch: ['あ', 'い', 'う', 'え', 'お'] },
    { id: 'ka', ch: ['か', 'き', 'く', 'け', 'こ'] },
    { id: 'sa', ch: ['さ', 'し', 'す', 'せ', 'そ'] },
    { id: 'DEL', label: 'DEL', cls: 'k-del', act: 'del' },
    { id: 'AC', label: 'AC', cls: 'k-del', act: 'ac' },

    { id: 'ta', ch: ['た', 'ち', 'つ', 'て', 'と'] },
    { id: 'na', ch: ['な', 'に', 'ぬ', 'ね', 'の'] },
    { id: 'ha', ch: ['は', 'ひ', 'ふ', 'へ', 'ほ'] },
    { id: 'KANA', label: 'カナ', cls: 'k-fn', act: 'kana' },
    { id: 'CONV', label: '変換', cls: 'k-fn', act: 'conv' },

    { id: 'ma', ch: ['ま', 'み', 'む', 'め', 'も'] },
    { id: 'ya', ch: ['や', '「', 'ゆ', '」', 'よ'] },
    { id: 'ra', ch: ['ら', 'り', 'る', 'れ', 'ろ'] },
    { id: 'SPACE', label: '空白', cls: 'k-fn', act: 'space' },
    { id: 'MODE', label: '英数', cls: 'k-fn', act: 'mode' },

    { id: 'MOD', label: '゛゜小', cls: 'k-fn', act: 'mod' },
    { id: 'wa', ch: ['わ', 'を', 'ん', 'ー', '〜'] },
    { id: 'punc', ch: ['、', '。', '？', '！', '・'] },
    { id: '123', label: '数字', cls: 'k-light', act: 'close' },
    { id: 'EXE', label: 'EXE', cls: 'k-exe', act: 'exe' }
  ];

  const ALNUM_KEYS = [
    { id: 'abc', ch: ['A', 'B', 'C', 'a', 'b'] },
    { id: 'def', ch: ['D', 'E', 'F', 'd', 'e'] },
    { id: 'ghi', ch: ['G', 'H', 'I', 'g', 'h'] },
    { id: 'DEL', label: 'DEL', cls: 'k-del', act: 'del' },
    { id: 'AC', label: 'AC', cls: 'k-del', act: 'ac' },

    { id: 'jkl', ch: ['J', 'K', 'L', 'j', 'k'] },
    { id: 'mno', ch: ['M', 'N', 'O', 'm', 'n'] },
    { id: 'pqrs', ch: ['P', 'Q', 'R', 'S', 'p'] },
    { id: 'CASE', label: '大/小', cls: 'k-fn', act: 'case' },
    { id: 'sym', ch: ['-', '_', '/', '(', ')'] },

    { id: 'tuv', ch: ['T', 'U', 'V', 't', 'u'] },
    { id: 'wxyz', ch: ['W', 'X', 'Y', 'Z', 'w'] },
    { id: 'n1', ch: ['1', '2', '3', '4', '5'] },
    { id: 'SPACE', label: '空白', cls: 'k-fn', act: 'space' },
    { id: 'MODE', label: 'かな', cls: 'k-fn', act: 'mode' },

    { id: 'n6', ch: ['6', '7', '8', '9', '0'] },
    { id: 'dot', ch: ['.', ',', '+', '*', '#'] },
    { id: 'dms', ch: ['°', '′', '″', ':', '!'] },
    { id: '123', label: '数字', cls: 'k-light', act: 'close' },
    { id: 'EXE', label: 'EXE', cls: 'k-exe', act: 'exe' }
  ];

  // 濁点・半濁点・小文字の循環表
  const MOD_RING = {};
  [
    ['あ', 'ぁ'], ['い', 'ぃ'], ['う', 'ぅ', 'ゔ'], ['え', 'ぇ'], ['お', 'ぉ'],
    ['か', 'が'], ['き', 'ぎ'], ['く', 'ぐ'], ['け', 'げ'], ['こ', 'ご'],
    ['さ', 'ざ'], ['し', 'じ'], ['す', 'ず'], ['せ', 'ぜ'], ['そ', 'ぞ'],
    ['た', 'だ'], ['ち', 'ぢ'], ['つ', 'っ', 'づ'], ['て', 'で'], ['と', 'ど'],
    ['は', 'ば', 'ぱ'], ['ひ', 'び', 'ぴ'], ['ふ', 'ぶ', 'ぷ'], ['へ', 'べ', 'ぺ'], ['ほ', 'ぼ', 'ぽ'],
    ['や', 'ゃ'], ['ゆ', 'ゅ'], ['よ', 'ょ'], ['わ', 'ゎ'],
    ['ア', 'ァ'], ['イ', 'ィ'], ['ウ', 'ゥ', 'ヴ'], ['エ', 'ェ'], ['オ', 'ォ'],
    ['カ', 'ガ'], ['キ', 'ギ'], ['ク', 'グ'], ['ケ', 'ゲ'], ['コ', 'ゴ'],
    ['サ', 'ザ'], ['シ', 'ジ'], ['ス', 'ズ'], ['セ', 'ゼ'], ['ソ', 'ゾ'],
    ['タ', 'ダ'], ['チ', 'ヂ'], ['ツ', 'ッ', 'ヅ'], ['テ', 'デ'], ['ト', 'ド'],
    ['ハ', 'バ', 'パ'], ['ヒ', 'ビ', 'ピ'], ['フ', 'ブ', 'プ'], ['ヘ', 'ベ', 'ペ'], ['ホ', 'ボ', 'ポ'],
    ['ヤ', 'ャ'], ['ユ', 'ュ'], ['ヨ', 'ョ'], ['ワ', 'ヮ']
  ].forEach(g => { g.forEach((c, i) => { MOD_RING[c] = g[(i + 1) % g.length]; }); });

  // 測量・現場でよく使う読みの辞書（最長一致で変換、再押下で次候補）
  const DICT = {
    'きょくせん': ['曲線'], 'すいしん': ['推進'], 'すいしんかん': ['推進管'], 'せんけい': ['線形'],
    'げんば': ['現場'], 'そくてん': ['測点'], 'そくりょう': ['測量'], 'こうく': ['工区'],
    'げすい': ['下水'], 'げすいどう': ['下水道'], 'かん': ['管', '間'], 'かんばんごう': ['管番号'],
    'ごう': ['号'], 'だい': ['第'], 'ほん': ['本'], 'ぜん': ['前'], 'ご': ['後'],
    'ひだり': ['左'], 'みぎ': ['右'], 'きかい': ['機械'], 'きかいてん': ['機械点'],
    'こうし': ['後視'], 'こうしてん': ['後視点'], 'きょり': ['距離'], 'かくど': ['角度'],
    'ほうこうかく': ['方向角'], 'こうかく': ['交角'], 'はんけい': ['半径'], 'ざひょう': ['座標'],
    'てすと': ['テスト', '試験'], 'しけん': ['試験'], 'よそく': ['予測'], 'きろく': ['記録'],
    'たてまち': ['館町'], 'みなみ': ['南'], 'きた': ['北'], 'ひがし': ['東'], 'にし': ['西'],
    'うえ': ['上'], 'した': ['下'], 'なか': ['中'], 'しん': ['新'], 'きゅう': ['旧'],
    'いち': ['一', '位置'], 'に': ['二'], 'さん': ['三'], 'よん': ['四'],
    'せん': ['線', '千'], 'てん': ['点'], 'まる': ['〇'], 'かく': ['角'],
    'あ': ['亜'], 'か': ['下', '可'], 'さ': ['左', '差'], 'た': ['多', '田'],
    'な': ['名'], 'は': ['端'], 'ま': ['間'], 'や': ['矢'], 'ら': ['ら'],
    'こうじ': ['工事'], 'どうろ': ['道路'], 'きょう': ['橋'], 'かわ': ['川'],
    'まち': ['町'], 'ちょう': ['町'], 'し': ['市'], 'く': ['区'], 'むら': ['村'],
    'あおき': ['青木'], 'おおつか': ['大塚'], 'さがみ': ['相模'], 'よこはま': ['横浜']
  };

  const toKata = s => s.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  const toHira = s => s.replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));

  let subMode = 'kana'; // 'kana' | 'alnum'
  let convState = null; // { yomi, list, idx, len }
  let popEl = null;

  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function showPop(btn, ch, activeIdx) {
    if (!popEl) {
      popEl = document.createElement('div');
      popEl.className = 'flick-pop';
      document.body.append(popEl);
    }
    const r = btn.getBoundingClientRect();
    popEl.innerHTML =
      '<span class="fp-u' + (activeIdx === 2 ? ' on' : '') + '">' + esc(ch[2]) + '</span>' +
      '<span class="fp-l' + (activeIdx === 1 ? ' on' : '') + '">' + esc(ch[1]) + '</span>' +
      '<span class="fp-c' + (activeIdx === 0 ? ' on' : '') + '">' + esc(ch[0]) + '</span>' +
      '<span class="fp-r' + (activeIdx === 3 ? ' on' : '') + '">' + esc(ch[3]) + '</span>' +
      '<span class="fp-d' + (activeIdx === 4 ? ' on' : '') + '">' + esc(ch[4]) + '</span>';
    popEl.style.left = (r.left + r.width / 2) + 'px';
    popEl.style.top = (r.top + r.height / 2) + 'px';
    popEl.style.display = 'grid';
    popEl.hidden = false;
  }
  function hidePop() { if (popEl) { popEl.hidden = true; popEl.style.display = 'none'; } }

  function pickDir(dx, dy) {
    if (Math.hypot(dx, dy) < 18) return 0;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 3;
    return dy < 0 ? 2 : 4;
  }

  function render(container, cb) {
    const list = subMode === 'kana' ? KANA_KEYS : ALNUM_KEYS;
    container.innerHTML = list.map((k, i) => {
      if (k.ch) {
        const sub = k.ch.slice(1).join('');
        return '<button type="button" class="key k-flick" data-fi="' + i + '" aria-label="' + esc(k.ch[0]) + '">' +
          '<span class="sub"><i class="fl-sub">' + esc(sub) + '</i></span>' +
          '<span class="main">' + esc(k.ch[0]) + '</span></button>';
      }
      return '<button type="button" class="key ' + (k.cls || 'k-fn') + '" data-fi="' + i + '" aria-label="' + esc(k.label) + '">' +
        '<span class="sub"></span><span class="main">' + esc(k.label) + '</span></button>';
    }).join('');

    let drag = null; // { idx, x, y, dir, btn, k }
    container.onpointerdown = e => {
      const btn = e.target.closest('[data-fi]');
      if (!btn) return;
      e.preventDefault();
      btn.classList.add('down');
      const k = list[Number(btn.dataset.fi)];
      if (k.ch) {
        drag = { x: e.clientX, y: e.clientY, dir: 0, btn, k };
        try { btn.setPointerCapture(e.pointerId); } catch { /* 無視 */ }
        showPop(btn, k.ch, 0);
      } else {
        drag = { btn, k, act: true };
      }
    };
    container.onpointermove = e => {
      if (!drag || drag.act) return;
      const d = pickDir(e.clientX - drag.x, e.clientY - drag.y);
      if (d !== drag.dir) {
        drag.dir = d;
        showPop(drag.btn, drag.k.ch, d);
      }
    };
    const end = e => {
      if (!drag) return;
      const cur = drag; drag = null;
      cur.btn.classList.remove('down');
      hidePop();
      if (cur.act) {
        const act = cur.k.act;
        if (act !== 'conv') convState = null;
        if (act === 'del') cb.onDel();
        else if (act === 'ac') cb.onAc();
        else if (act === 'exe') cb.onExe();
        else if (act === 'close') cb.onClose();
        else if (act === 'space') cb.onChar(' ');
        else if (act === 'mode') { subMode = subMode === 'kana' ? 'alnum' : 'kana'; render(container, cb); if (cb.onModeChange) cb.onModeChange(subMode); }
        else if (act === 'mod') {
          const text = cb.getText();
          const arr = Array.from(text);
          const last = arr[arr.length - 1];
          if (last && MOD_RING[last]) cb.replaceTail(1, MOD_RING[last]);
        } else if (act === 'kana') {
          const text = cb.getText();
          const mH = text.match(/[\u3041-\u3096ー]+$/);
          const mK = text.match(/[\u30a1-\u30f6ー]+$/);
          if (mH) cb.replaceTail(Array.from(mH[0]).length, toKata(mH[0]));
          else if (mK) cb.replaceTail(Array.from(mK[0]).length, toHira(mK[0]));
        } else if (act === 'case') {
          const arr = Array.from(cb.getText());
          const last = arr[arr.length - 1];
          if (last && /^[A-Za-z]$/.test(last)) {
            cb.replaceTail(1, last === last.toUpperCase() ? last.toLowerCase() : last.toUpperCase());
          }
        } else if (act === 'conv') {
          const text = cb.getText();
          if (convState && text.endsWith(convState.cur)) {
            const nextIdx = (convState.idx + 1) % convState.list.length;
            const nextWord = convState.list[nextIdx];
            cb.replaceTail(Array.from(convState.cur).length, nextWord);
            convState.idx = nextIdx; convState.cur = nextWord;
          } else {
            const m = text.match(/[\u3041-\u3096ー]+$/);
            if (!m) return;
            const tail = m[0];
            let yomi = null, cand = null;
            for (let len = Array.from(tail).length; len >= 1; len--) {
              const sub = Array.from(tail).slice(-len).join('');
              if (DICT[sub]) { yomi = sub; cand = DICT[sub]; break; }
            }
            const cands = cand ? cand.concat([toKata(yomi), yomi]) : [toKata(tail), tail];
            const src = yomi || tail;
            convState = { yomi: src, list: cands, idx: 0, cur: cands[0] };
            cb.replaceTail(Array.from(src).length, cands[0]);
          }
        }
        return;
      }
      if (e.type === 'pointercancel') return;
      convState = null;
      cb.onChar(cur.k.ch[cur.dir]);
    };
    container.onpointerup = end;
    container.onpointercancel = end;
  }

  function clearHandlers(container) {
    container.onpointerdown = null;
    container.onpointermove = null;
    container.onpointerup = null;
    container.onpointercancel = null;
    hidePop();
    convState = null;
  }

  root.FxFlick = { render, clearHandlers, getMode: () => subMode, setMode: m => { if (m === 'kana' || m === 'alnum') subMode = m; } };
})(typeof window !== 'undefined' ? window : globalThis);
