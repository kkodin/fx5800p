// 日本語フリックキーボード（電卓の「i」キーでテンキーと切り替える）
//   FxFlick.render(el, { onChar, getText, replaceTail, onDel, onAc, onExe, onClose, onModeChange, onCands })
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

  // 測量・現場用語＋日常基本語彙のオフライン辞書（オンライン時は Google 変換と併用）
  const DICT = {
    // 測量・推進・土木・現場用語
    'きょくせん': ['曲線'], 'たんきょくせん': ['単曲線'], 'かんわきょくせん': ['緩和曲線'],
    'すいしん': ['推進'], 'すいしんかん': ['推進管'], 'すいしんこう': ['推進工'],
    'せんけい': ['線形'], 'ちゅうしんせん': ['中心線'], 'けいかくせん': ['計画線'],
    'げんば': ['現場'], 'そくてん': ['測点'], 'そくりょう': ['測量'], 'こうく': ['工区'],
    'げすい': ['下水'], 'げすいどう': ['下水道'], 'じょうすい': ['上水'], 'うすい': ['雨水'], 'おすい': ['汚水'],
    'かん': ['管', '間'], 'かんばんごう': ['管番号'], 'ばんごう': ['番号'], 'なんばー': ['ナンバー', 'No.', '番号'],
    'ごう': ['号'], 'だい': ['第'], 'ほん': ['本'], 'ほんすう': ['本数'],
    'ぜん': ['前'], 'ぜんご': ['前後'], 'さゆう': ['左右'], 'じょうげ': ['上下'], 'ないがい': ['内外'],
    'ひだり': ['左'], 'みぎ': ['右'], 'きかい': ['機械', '器械'], 'きかいてん': ['機械点', '器械点'],
    'こうし': ['後視'], 'こうしてん': ['後視点'], 'ぜんし': ['前視'], 'ぜんしてん': ['前視点'],
    'きょり': ['距離'], 'しゃきょり': ['斜距離'], 'すいへいきょり': ['水平距離'],
    'かくど': ['角度'], 'すいへいかく': ['水平角'], 'えんちょくかく': ['鉛直角'],
    'ほうこうかく': ['方向角'], 'こうかく': ['交角'], 'へんかく': ['偏角'],
    'はんけい': ['半径'], 'ちょっけい': ['直径'], 'ないけい': ['内径'], 'がいけい': ['外径'],
    'ざひょう': ['座標'], 'ひょうこう': ['標高'], 'じばん': ['地盤'], 'どかぶり': ['土被り'],
    'こうばい': ['勾配'], 'えんちょう': ['延長'], 'せつごう': ['接合'], 'つぎて': ['継手'], 'めじ': ['目地'],
    'ひらき': ['開き'], 'めじひらき': ['目地開き'], 'ごさ': ['誤差'], 'へんしん': ['偏心'],
    'たてこう': ['立坑'], 'はっしん': ['発進'], 'とうたつ': ['到達'], 'じんこう': ['人孔'], 'まんほーる': ['マンホール'],
    'くっしん': ['掘進'], 'すいりょく': ['推力'], 'じゃっき': ['ジャッキ'], 'かつざい': ['滑材'],
    'ひゅーむかん': ['ヒューム管'], 'えんびかん': ['塩ビ管'], 'こうかん': ['鋼管'],
    'きじゅん': ['基準'], 'きじゅんてん': ['基準点'], 'ひきつけ': ['引付'], 'ちょうはり': ['丁張'],
    'たーげっと': ['ターゲット'], 'ぷりずむ': ['プリズム'], 'とらんしっと': ['トランシット'], 'れべる': ['レベル'],
    'てすと': ['テスト', '試験'], 'しけん': ['試験'], 'よそく': ['予測'], 'きろく': ['記録'],
    'けいかく': ['計画'], 'せっけい': ['設計'], 'せこう': ['施工'], 'できがた': ['出来形'],
    'かんり': ['管理'], 'かくにん': ['確認'], 'けんさ': ['検査'], 'しゃしん': ['写真'], 'こくばん': ['黒板'],
    'ていあん': ['提案'], 'ほうこく': ['報告'], 'めも': ['メモ'], 'びこう': ['備考'],
    // 方角・位置・大小
    'みなみ': ['南'], 'きた': ['北'], 'ひがし': ['東'], 'にし': ['西'],
    'うえ': ['上'], 'した': ['下'], 'なか': ['中'], 'そと': ['外'], 'うち': ['内'],
    'まえ': ['前'], 'うしろ': ['後', '後ろ'], 'よこ': ['横'], 'たて': ['縦'], 'ななめ': ['斜め'],
    'しん': ['新'], 'きゅう': ['旧'], 'おお': ['大'], 'しょう': ['小'], 'おおきい': ['大きい'], 'ちいさい': ['小さい'],
    'たかい': ['高い'], 'ひくい': ['低い'], 'ながい': ['長い'], 'みじかい': ['短い'],
    'ふかい': ['深い'], 'あさい': ['浅い'], 'ひろい': ['広い'], 'せまい': ['狭い'],
    // 数・単位・時間
    'いち': ['一', '位置'], 'に': ['二'], 'さん': ['三'], 'よん': ['四'], 'し': ['四', '市'],
    'ご': ['五', '後'], 'ろく': ['六'], 'なな': ['七'], 'しち': ['七'], 'はち': ['八'], 'きゅう': ['九', '旧'], 'じゅう': ['十'],
    'ひゃく': ['百'], 'せん': ['線', '千'], 'まん': ['万'], 'ぜろ': ['ゼロ', '零'], 'れい': ['零', '例'],
    'てん': ['点'], 'まる': ['丸', '〇'], 'かく': ['角'], 'ど': ['度'], 'ふん': ['分'], 'びょう': ['秒'],
    'きょう': ['今日', '橋'], 'あした': ['明日'], 'きのう': ['昨日'], 'いま': ['今'],
    'つき': ['月'], 'ひ': ['日'], 'ねん': ['年'], 'じかん': ['時間'],
    'げつようび': ['月曜日'], 'かようび': ['火曜日'], 'すいようび': ['水曜日'], 'もくようび': ['木曜日'],
    'きんようび': ['金曜日'], 'どようび': ['土曜日'], 'にちようび': ['日曜日'],
    // 一般・地名・日常語
    'さかな': ['魚', '肴'], 'にく': ['肉'], 'やさい': ['野菜'], 'みず': ['水'], 'おちゃ': ['お茶'],
    'ひと': ['人'], 'なまえ': ['名前'], 'ばしょ': ['場所'], 'もの': ['物'], 'こと': ['事'],
    'いえ': ['家'], 'へや': ['部屋'], 'くるま': ['車'], 'でんわ': ['電話'], 'でんたく': ['電卓'],
    'しごと': ['仕事'], 'かいしゃ': ['会社'], 'だいがく': ['大学'], 'がっこう': ['学校'],
    'やま': ['山'], 'かわ': ['川'], 'うみ': ['海'], 'そら': ['空'], 'あめ': ['雨'], 'ゆき': ['雪'], 'かぜ': ['風'],
    'はる': ['春'], 'なつ': ['夏'], 'あき': ['秋'], 'ふゆ': ['冬'],
    'しろ': ['白'], 'くろ': ['黒'], 'あか': ['赤'], 'あお': ['青'], 'きいろ': ['黄色'], 'みどり': ['緑'],
    'こうじ': ['工事'], 'どうろ': ['道路'], 'まち': ['町'], 'ちょう': ['町'], 'く': ['区'], 'むら': ['村'],
    'けん': ['県'], 'と': ['都'], 'ふ': ['府'], 'どう': ['道'], 'ろせん': ['路線'], 'くかん': ['区間'],
    'たてまち': ['館町'], 'あおき': ['青木'], 'おおつか': ['大塚'], 'さがみ': ['相模'], 'よこはま': ['横浜'],
    'とうきょう': ['東京'], 'かながわ': ['神奈川'], 'ちば': ['千葉'], 'さいたま': ['埼玉'], 'おおさか': ['大阪'],
    'あさ': ['朝'], 'ひる': ['昼'], 'よる': ['夜'], 'ほんじつ': ['本日'], 'じっし': ['実施'],
    'かいし': ['開始'], 'しゅうりょう': ['終了'], 'かんりょう': ['完了'], 'ちゅうし': ['中止'], 'へんこう': ['変更'],
    'ついか': ['追加'], 'さくじょ': ['削除'], 'ほぞん': ['保存'], 'よみこみ': ['読込'], 'かきだし': ['書出']
  };

  // 1文字だけのときに使う単漢字候補（2文字以上の末尾には使わない）
  const SINGLE_DICT = {
    'あ': ['亜'], 'い': ['位', '井'], 'う': ['右', '上'], 'え': ['絵', '江'], 'お': ['尾', '小'],
    'か': ['下', '可', '仮'], 'き': ['木', '気', '基'], 'く': ['区', '組'], 'け': ['毛'], 'こ': ['子', '小', '個'],
    'さ': ['左', '差'], 'し': ['市', '四', '仕'], 'す': ['素', '図'], 'せ': ['背', '瀬'], 'そ': ['素', '外'],
    'た': ['多', '田', '他'], 'ち': ['地', '値'], 'つ': ['津', '対'], 'て': ['手'], 'と': ['都', '戸', '外'],
    'な': ['名', '菜'], 'に': ['二', '荷'], 'ぬ': ['抜'], 'ね': ['根', '値'], 'の': ['野'],
    'は': ['端', '葉', '場'], 'ひ': ['日', '比', '火'], 'ふ': ['府', '負', '部'], 'へ': ['辺', '部'], 'ほ': ['歩', '穂'],
    'ま': ['間', '真'], 'み': ['見', '実', '三'], 'む': ['無', '六'], 'め': ['目', '面'], 'も': ['元', '面'],
    'や': ['矢', '谷', '屋'], 'ゆ': ['由', '湯'], 'よ': ['与', '四', '横'],
    'ら': ['ら'], 'り': ['利', '里'], 'る': ['留'], 'れ': ['例'], 'ろ': ['路'],
    'わ': ['和', '輪']
  };

  const toKata = s => s.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  const toHira = s => s.replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));

  let subMode = 'kana'; // 'kana' | 'alnum'
  let convState = null; // { yomi, list, idx, cur, token, pick }
  let convSeq = 0;
  let convAbort = null;
  let popEl = null;
  let activeCb = null;
  const onlineCache = new Map();

  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function uniq(arr) {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      if (x && !seen.has(x)) { seen.add(x); out.push(x); }
    }
    return out;
  }

  function emitCands(cb) {
    if (!cb || !cb.onCands) return;
    if (!convState || !convState.list.length) cb.onCands([], -1, null);
    else cb.onCands(convState.list, convState.idx, convState.pick);
  }

  function clearConv(cb) {
    if (convAbort) { try { convAbort.abort(); } catch { /* 無視 */ } convAbort = null; }
    convState = null;
    convSeq++;
    emitCands(cb || activeCb);
  }

  function lookupLocal(tail) {
    const chars = Array.from(tail);
    if (DICT[tail]) return { yomi: tail, cands: DICT[tail].slice() };
    if (chars.length === 1 && SINGLE_DICT[tail]) return { yomi: tail, cands: SINGLE_DICT[tail].slice() };
    // 2文字以上のみ末尾から最長一致（1文字だけ勝手に漢字にしない）
    for (let len = chars.length - 1; len >= 2; len--) {
      const sub = chars.slice(-len).join('');
      if (DICT[sub]) return { yomi: sub, cands: DICT[sub].slice() };
    }
    return null;
  }

  async function fetchOnlineCands(yomi, signal) {
    if (onlineCache.has(yomi)) return onlineCache.get(yomi);
    const url = 'https://inputtools.google.com/request?text=' + encodeURIComponent(yomi) +
      '&itc=ja-t-i0-und&num=10&cp=0&cs=1&ie=utf-8&oe=utf-8';
    const res = await fetch(url, { method: 'POST', signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data[0] !== 'SUCCESS') return null;
    const segs = Array.isArray(data[1]) ? data[1] : (data[1] && data[1].value);
    if (!Array.isArray(segs) || !segs.length) return null;
    let out = null;
    if (segs.length === 1 && Array.isArray(segs[0][1])) {
      out = segs[0][1];
    } else {
      const joined = segs.map(s => (s[1] && s[1][0]) || s[0] || '').join('');
      if (joined) out = [joined];
    }
    if (out && out.length) {
      if (onlineCache.size > 200) onlineCache.clear();
      onlineCache.set(yomi, out);
    }
    return out;
  }

  function buildCandList(yomi, localCands, onlineCands) {
    const merged = [];
    if (localCands) merged.push(...localCands);
    if (onlineCands) merged.push(...onlineCands);
    merged.push(toKata(yomi), yomi);
    return uniq(merged);
  }

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

  function runConv(cb) {
    const text = cb.getText();
    if (convState && text.endsWith(convState.cur)) {
      const nextIdx = (convState.idx + 1) % convState.list.length;
      const nextWord = convState.list[nextIdx];
      cb.replaceTail(Array.from(convState.cur).length, nextWord);
      convState.idx = nextIdx;
      convState.cur = nextWord;
      emitCands(cb);
      return;
    }

    const m = text.match(/[\u3041-\u3096ー]+$/);
    if (!m) { clearConv(cb); return; }
    const tail = m[0];

    const exactLocal = DICT[tail] || (Array.from(tail).length === 1 ? SINGLE_DICT[tail] : null);
    const cachedOnline = onlineCache.get(tail) || null;
    const partialLocal = (!exactLocal && !cachedOnline) ? lookupLocal(tail) : null;

    // 全体に対して完全一致またはオンラインキャッシュがある場合は tail 全体を使う。なければ部分一致（2文字以上）を使う
    const src = (exactLocal || cachedOnline || !partialLocal) ? tail : partialLocal.yomi;
    const localCands = exactLocal ? exactLocal.slice() : (partialLocal && src === partialLocal.yomi ? partialLocal.cands : null);
    const initialList = buildCandList(src, localCands, src === tail ? cachedOnline : null);

    if (convAbort) { try { convAbort.abort(); } catch { /* 無視 */ } }
    const token = ++convSeq;
    const pick = i => {
      if (!convState || convState.token !== token) return;
      const word = convState.list[i];
      if (!word) return;
      if (cb.getText().endsWith(convState.cur)) {
        cb.replaceTail(Array.from(convState.cur).length, word);
      }
      clearConv(cb);
    };

    convState = { yomi: src, list: initialList, idx: 0, cur: initialList[0], token, pick };
    cb.replaceTail(Array.from(src).length, initialList[0]);
    emitCands(cb);

    if (!cachedOnline && typeof fetch === 'function') {
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      convAbort = ac;
      const timer = ac ? setTimeout(() => ac.abort(), 1800) : null;
      fetchOnlineCands(tail, ac ? ac.signal : undefined).then(online => {
        if (timer) clearTimeout(timer);
        if (!online || !online.length || !convState || convState.token !== token) return;
        // 部分一致で一時変換していた場合でも、オンライン結果が全文(tail)を変換できたなら全文を優先する
        if (convState.yomi !== tail) {
          const fullList = buildCandList(tail, exactLocal, online);
          const tailPrefix = Array.from(tail).slice(0, Array.from(tail).length - Array.from(convState.yomi).length).join('');
          const curFull = tailPrefix + convState.cur;
          if (convState.idx === 0 && cb.getText().endsWith(curFull)) {
            cb.replaceTail(Array.from(curFull).length, fullList[0]);
            convState.yomi = tail;
            convState.list = fullList;
            convState.cur = fullList[0];
            emitCands(cb);
          }
          return;
        }
        const updated = buildCandList(tail, localCands, online);
        if (convState.idx === 0 && updated[0] !== convState.cur && !localCands) {
          if (cb.getText().endsWith(convState.cur)) {
            cb.replaceTail(Array.from(convState.cur).length, updated[0]);
            convState.cur = updated[0];
          }
        }
        const curIdx = updated.indexOf(convState.cur);
        convState.list = updated;
        convState.idx = curIdx >= 0 ? curIdx : 0;
        emitCands(cb);
      }).catch(() => {
        if (timer) clearTimeout(timer);
      });
    }
  }

  function render(container, cb) {
    activeCb = cb;
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

    let drag = null; // { x, y, dir, btn, k, act }
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
        if (act !== 'conv') clearConv(cb);
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
          runConv(cb);
        }
        return;
      }
      if (e.type === 'pointercancel') return;
      clearConv(cb);
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
    clearConv(activeCb);
    activeCb = null;
  }

  root.FxFlick = { render, clearHandlers, getMode: () => subMode, setMode: m => { if (m === 'kana' || m === 'alnum') subMode = m; } };
})(typeof window !== 'undefined' ? window : globalThis);
