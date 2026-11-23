// 現場の座標：現場の切り替え・座標一覧・取り込み・書き出し
(function () {
  'use strict';
  const P = FxPoints, ST = FxStore, D = FxDialog, h = D.h;
  const $ = id => document.getElementById(id);
  const PAGE = 200;                 // 一度に描く行数

  const state = { sites: [], site: null, points: [], q: '', kind: '', sort: 'order', shown: PAGE, recent: [] };

  // ---- 小物 ----
  let toastTimer;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }
  const f3 = v => v == null || !Number.isFinite(+v) ? '' : (+v).toFixed(3);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function saveLocal(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  // ファイルを渡す：スマホでは「共有」（Dropbox・Google ドライブ・OneDrive・メールなど）か「端末に保存」を選ぶ。PC はそのまま保存
  //   content：文字か Uint8Array。戻り値：'share'／'save'／null（やめた）
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    let file = null;
    try { file = new File([blob], name, { type }); } catch { /* 古いブラウザ */ }
    const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    const canShare = !!(file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] }));
    if (!touch || !canShare) { saveLocal(blob, name); return Promise.resolve('save'); }
    return new Promise(resolve => {
      let r = null;
      D.open({
        title: 'ファイルの渡し方', width: 460,
        body: h('div', {}, [h('p', { class: 'dlg-msg', text: name }),
          h('p', { class: 'small', text: '「共有」を押すと、Dropbox・Google ドライブ・OneDrive・ファイル・メール・LINE など、スマホに入っているアプリへ渡せます。' })]),
        buttons: [
          { label: 'やめる' },
          { label: '端末に保存', onClick: () => { saveLocal(blob, name); r = 'save'; } },
          { label: '共有', kind: 'primary', onClick: async () => {
            try { await navigator.share({ files: [file], title: name }); r = 'share'; }
            catch (e) { if (e && e.name === 'AbortError') return false; saveLocal(blob, name); r = 'save'; toast('共有できなかったので、端末に保存しました'); }
          } }
        ],
        onClose: () => resolve(r)
      });
    });
  }
  const today = () => new Date().toISOString().slice(0, 10);
  const safeName = s => String(s).replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  async function guard(fn) { try { return await fn(); } catch (e) { console.error(e); toast(e.message || String(e)); } }

  // ---- 現場 ----
  async function loadSites(selectId) {
    state.sites = await ST.listSites();
    const want = selectId || (await ST.getMeta('lastSite', null));
    state.site = state.sites.find(s => s.id === want) || state.sites[0] || null;
    const sel = $('site');
    sel.innerHTML = '';
    for (const s of state.sites) sel.append(h('option', { value: s.id, text: s.name }));
    sel.hidden = !state.sites.length;
    if (state.site) { sel.value = state.site.id; await ST.setMeta('lastSite', state.site.id); }
    state.recent = state.site ? await ST.getMeta('recent:' + state.site.id, []) : [];
    await loadPoints();
  }
  async function loadPoints() {
    state.points = state.site ? await ST.listPoints(state.site.id) : [];
    state.shown = PAGE;
    render();
    for (const fn of hooks.points) await fn();
    await checkBackup();
  }
  const hooks = { points: [], tab: [] };

  function siteForm(site, title, okLabel) {
    return new Promise(resolve => {
      const name = h('input', { value: site ? site.name : '', maxlength: 40, placeholder: '例 ○○線 第2工区', autofocus: true });
      const memo = h('textarea', { rows: 3, placeholder: 'メモ（任意）' }); memo.value = site ? site.memo || '' : '';
      const err = h('p', { class: 'err' });
      let result = null;
      D.open({
        title, width: 480,
        body: h('div', {}, [h('div', { class: 'form' }, [h('label', { text: '現場の名前' }), name, h('label', { text: 'メモ' }), memo]), err]),
        buttons: [
          { label: 'やめる' },
          { label: okLabel, kind: 'primary', onClick: () => {
            const n = name.value.trim();
            if (!n) { err.textContent = '名前を入れてください'; name.classList.add('bad'); name.focus(); return false; }
            result = { name: n, memo: memo.value.trim() };
          } }
        ],
        onClose: () => resolve(result)
      });
    });
  }
  async function createSite() {
    const r = await siteForm(null, '新しい現場', '作る');
    if (!r) return;
    const s = ST.newSite(r.name, r.memo);
    await ST.putSite(s);
    await loadSites(s.id);
    toast('現場「' + s.name + '」を作りました');
  }
  async function renameSite() {
    const r = await siteForm(state.site, '現場の名前とメモ', '保存');
    if (!r) return;
    Object.assign(state.site, r);
    await ST.putSite(state.site);
    await loadSites(state.site.id);
  }
  async function removeSite() {
    const s = state.site, calcs = await ST.listCalcs(s.id);
    const ok = await D.confirm('現場を消す', '「' + s.name + '」を消します。\n点 ' + state.points.length + ' 点と計算の履歴 ' + calcs.length + ' 件も一緒に消えます。元に戻せません。\n\n先にバックアップを書き出しておくと安心です。', '消す', 'danger');
    if (!ok) return;
    await ST.deleteSite(s.id);
    await loadSites();
    toast('現場を消しました');
  }
  async function backupSites(all) {
    const data = await ST.exportSites(all ? null : [state.site.id]);
    const name = all ? '全部の現場' : safeName(state.site.name);
    const how = await download('genba-' + name + '-' + today() + '.json', JSON.stringify(data, null, 1), 'application/json');
    if (!how) return;
    await ST.setMeta('lastBackup', new Date().toISOString());
    await ST.setMeta('calcsSinceBackup', 0);
    $('backupNote').hidden = true;
    toast('バックアップを書き出しました（' + data.sites.length + ' 現場）');
  }
  function restoreSites() {
    pickFile('.json,application/json', async file => {
      const data = JSON.parse(P.decode(await file.arrayBuffer()));
      if (!data || data.format !== ST.FORMAT) throw new Error('現場のバックアップの形式ではありません');
      const have = new Set(state.sites.map(s => s.id));
      const dup = data.sites.filter(x => x.site && have.has(x.site.id));
      let mode = 'replace';
      if (dup.length) {
        const replace = await D.confirm('同じ現場があります', dup.map(x => '・' + x.site.name).join('\n') + '\n\nこの端末の同じ現場を、バックアップの中身で置き換えますか？\n「別に残す」を選ぶと、別の現場として足します。', '置き換える', 'danger');
        mode = replace ? 'replace' : 'copy';
      }
      const r = await ST.importSites(data, mode);
      await loadSites(r.length ? undefined : null);
      toast('読み込みました：' + r.map(x => x.name + '（' + x.points + ' 点）').join('、'));
    });
  }

  let menuOpen = null;
  async function siteMenu() {
    if (menuOpen) { menuOpen.close(); menuOpen = null; return; }
    const persisted = await ST.persist();
    const last = await ST.getMeta('lastBackup', null);
    const items = [{ label: '＋ 新しい現場', onClick: () => guard(createSite) }];
    if (state.site) items.push({ label: '現場の名前・メモを変える', onClick: () => guard(renameSite) }, '-',
      { label: 'この現場をバックアップ（書き出し）', onClick: () => guard(() => backupSites(false)) });
    if (state.sites.length > 1) items.push({ label: '全部の現場をバックアップ', onClick: () => guard(() => backupSites(true)) });
    items.push({ label: 'バックアップを読み込む', onClick: () => guard(restoreSites) });
    if (state.site) items.push('-', { label: 'この現場を消す', kind: 'danger', onClick: () => guard(removeSite) });
    items.push('-', { note: '最後のバックアップ：' + (last ? new Date(last).toLocaleString('ja-JP') : 'まだありません') },
      { note: persisted === true ? '端末の保存：消されにくい設定 ✓' : persisted === false ? '端末の保存：ブラウザが消すことがあります。ホーム画面に追加して使ってください' : '端末の保存：この端末では確かめられません' });
    menuOpen = D.menu($('siteMenu'), items);
    const close = menuOpen.close;
    menuOpen.close = () => { close(); menuOpen = null; };
    // メニューの外を押して閉じたときも忘れる
    setTimeout(function watch() { if (menuOpen && !document.querySelector('.menu')) menuOpen = null; else if (menuOpen) setTimeout(watch, 300); }, 300);
  }

  // ---- 一覧 ----
  function hilite(name, q) {
    if (!q) return esc(name);
    const key = P.normKey(q);
    // 揃えた文字で位置を探し、元の文字に印を付ける（1 文字ずつ対応が取れる範囲で）
    const chars = Array.from(name), norm = chars.map(c => P.normKey(c));
    const joined = norm.join('');
    let at = joined.indexOf(key);
    if (at < 0 && /^\d+$/.test(key)) { const m = joined.match(new RegExp('(^|\\D)0*(' + key + ')')); if (m) at = m.index + m[0].length - key.length; }
    if (at < 0) return esc(name);
    let pos = 0, s = -1, e = -1;
    for (let i = 0; i < chars.length; i++) { if (pos === at) s = i; pos += norm[i].length; if (pos >= at + key.length && s >= 0) { e = i; break; } }
    if (s < 0 || e < 0) return esc(name);
    return esc(chars.slice(0, s).join('')) + '<mark>' + esc(chars.slice(s, e + 1).join('')) + '</mark>' + esc(chars.slice(e + 1).join(''));
  }
  function render() {
    const has = !!state.site;
    $('noSite').hidden = has; $('ptsView').hidden = !has;
    if (!has) return;
    // 種類のボタン
    const kinds = $('kinds'); kinds.innerHTML = '';
    const counts = {}; for (const p of state.points) counts[p.kind] = (counts[p.kind] || 0) + 1;
    for (const k of [''].concat(P.KINDS)) {
      if (k && !counts[k]) continue;
      kinds.append(h('button', { type: 'button', class: state.kind === k ? 'on' : '', text: (k || '全部') + ' ' + (k ? counts[k] : state.points.length), onclick: () => { state.kind = state.kind === k ? '' : k; state.shown = PAGE; render(); } }));
    }
    const list = P.search(state.points, state.q, { kind: state.kind, sort: state.sort, recent: state.recent });
    $('count').textContent = (state.q || state.kind ? list.length + ' 点 ／ 全 ' : '全 ') + state.points.length + ' 点';
    const ul = $('list'); ul.innerHTML = '';
    if (!list.length) ul.append(h('li', { class: 'none', text: state.points.length ? '見つかりません' : 'まだ点がありません。「＋ 追加」か「取り込み」で登録してください' }));
    if (list.length) ul.append(h('li', { class: 'head', 'aria-hidden': 'true', html: '<span class="nm">点名</span><span class="kd">種類</span><span class="xy"><span>X（北）</span><span>Y（東）</span><span>Z</span></span><span class="memo">メモ</span>' }));
    const recent = new Set(state.recent.slice(0, 5));
    for (const p of list.slice(0, state.shown)) {
      const li = h('li', { 'data-id': p.id });
      li.innerHTML = '<span class="nm">' + (recent.has(p.id) && !state.q ? '🕘 ' : '') + hilite(p.name, state.q) + '</span><span class="kd">' + esc(p.kind) + '</span>'
        + '<span class="xy"><span><i>X </i>' + f3(p.x) + '</span><span><i>Y </i>' + f3(p.y) + '</span><span>' + (p.z != null ? '<i>Z </i>' + f3(p.z) : '') + '</span></span>'
        + '<span class="memo">' + esc(p.memo || '') + '</span>';
      ul.append(li);
    }
    $('more').hidden = list.length <= state.shown;
    $('more').textContent = 'さらに表示（あと ' + (list.length - state.shown) + ' 点）';
  }

  // ---- 点の追加・修正 ----
  function pointForm(p) {
    const isNew = !p;
    const name = h('input', { value: p ? p.name : '', maxlength: P.NAME_MAX, placeholder: '例 境界杭 No.3', autofocus: true, autocomplete: 'off' });
    const x = h('input', { class: 'num', value: p ? f3(p.x) : '', inputmode: 'decimal', placeholder: '北（X）', autocomplete: 'off' });
    const y = h('input', { class: 'num', value: p ? f3(p.y) : '', inputmode: 'decimal', placeholder: '東（Y）', autocomplete: 'off' });
    const z = h('input', { class: 'num', value: p && p.z != null ? f3(p.z) : '', inputmode: 'decimal', placeholder: '任意', autocomplete: 'off' });
    const kind = h('select', {}, P.KINDS.map(k => h('option', { value: k, text: k })));
    kind.value = p ? p.kind : (state.kind || '既知点');
    const memo = h('input', { value: p ? p.memo || '' : '', placeholder: '任意', autocomplete: 'off' });
    const err = h('p', { class: 'err' });
    const buttons = [{ label: 'やめる' }];
    if (!isNew) buttons.push({ label: '削除', kind: 'danger', onClick: async close => {
      if (!(await D.confirm('点を消す', '「' + p.name + '」を消します。元に戻せません。', '消す', 'danger'))) return false;
      await guard(async () => { await ST.deletePoints(state.site.id, [p.id]); await loadPoints(); toast('「' + p.name + '」を消しました'); });
    } });
    buttons.push({ label: isNew ? '登録' : '保存', kind: 'primary', onClick: async () => {
      for (const el of [name, x, y, z]) el.classList.remove('bad');
      const n = name.value.trim(), vx = P.num(x.value), vy = P.num(y.value), vz = z.value.trim() ? P.num(z.value) : null;
      const bad = (el, msg) => { el.classList.add('bad'); el.focus(); err.textContent = msg; return false; };
      if (!n) return bad(name, '点名を入れてください');
      if (state.points.some(q => q.name === n && (!p || q.id !== p.id))) return bad(name, '同じ点名がもうあります');
      if (!Number.isFinite(vx)) return bad(x, 'X を数字で入れてください');
      if (!Number.isFinite(vy)) return bad(y, 'Y を数字で入れてください');
      if (vz !== null && !Number.isFinite(vz)) return bad(z, 'Z は数字で入れるか、空にしてください');
      const rec = p ? Object.assign(p, { name: n, x: vx, y: vy, z: vz, kind: kind.value, memo: memo.value.trim() })
        : ST.newPoint(state.site.id, { name: n, x: vx, y: vy, z: vz, kind: kind.value, memo: memo.value.trim(), src: '手入力' }, Date.now());
      await guard(async () => { await ST.putPoints(state.site.id, [rec]); await loadPoints(); toast((isNew ? '登録しました：' : '保存しました：') + n); });
    } });
    D.open({
      title: isNew ? '点を追加' : '点を直す', width: 480, buttons,
      body: h('div', {}, [h('div', { class: 'form' }, [
        h('label', { text: '点名' }), name, h('label', { text: 'X（北）' }), x, h('label', { text: 'Y（東）' }), y,
        h('label', { text: 'Z（高さ）' }), z, h('label', { text: '種類' }), kind, h('label', { text: 'メモ' }), memo]), err])
    });
  }

  // ---- 取り込み ----
  function pickFile(accept, fn) {
    const inp = $('fileIn');
    inp.accept = accept; inp.value = '';
    inp.onchange = () => { const f = inp.files[0]; if (f) guard(() => fn(f)); };
    inp.click();
  }
  function importForm() {
    const ta = h('textarea', { placeholder: 'ここに貼り付け（Excel の表をコピーしても可）\n例）\nK1,1000.000,2000.000\nK2,1050.000,2080.000\n境界杭 No.3,1031.500,2051.200', spellcheck: 'false' });
    const fileBtn = h('button', { type: 'button', text: '📂 ファイルを選ぶ（CSV・TXT・SIMA）' });
    const fileName = h('span', { class: 'small' });
    const policy = h('select', {}, [h('option', { value: 'replace', text: '同じ点名は置き換える' }), h('option', { value: 'rename', text: '同じ点名は別名で残す（末尾に (2)）' }), h('option', { value: 'skip', text: '同じ点名は飛ばす' })]);
    const swap = h('input', { type: 'checkbox' });
    const kind = h('select', {}, P.KINDS.map(k => h('option', { value: k, text: '種類：' + k })));
    kind.value = '既知点';
    const sum = h('div', { class: 'sum' }), tbl = h('div', { class: 'tbl-wrap', hidden: true }), errs = h('ul', { class: 'errs' });
    let parsed = { rows: [], errors: [], format: '' }, planned = [], okBtn = null, srcLabel = '貼り付け';
    function refresh() {
      parsed = ta.value.trim() ? P.parseText(ta.value) : { rows: [], errors: [], format: '' };
      planned = P.plan(state.points, parsed.rows, policy.value, swap.checked);
      const c = { add: 0, replace: 0, rename: 0, skip: 0 };
      for (const r of planned) c[r.action === 'replace-dup' ? 'replace' : r.action]++;
      const n = planned.length - c.skip;
      sum.textContent = parsed.rows.length || parsed.errors.length
        ? (parsed.format === 'SIMA' ? 'SIMA 形式。' : '') + '追加 ' + c.add + '・置き換え ' + c.replace + '・別名 ' + c.rename + '・飛ばす ' + c.skip + (parsed.errors.length ? '・読めない行 ' + parsed.errors.length : '')
        : '';
      const ACT = { add: '追加', replace: '置き換え', 'replace-dup': '置き換え（同じ取り込みの中）', rename: '別名', skip: '飛ばす' };
      tbl.hidden = !planned.length;
      tbl.innerHTML = '<table class="tbl"><thead><tr><th>行</th><th>どうする</th><th>点名</th><th>X</th><th>Y</th><th>Z</th><th>メモ</th></tr></thead><tbody>'
        + planned.slice(0, 500).map(r => '<tr><td>' + r.line + '</td><td class="act-' + r.action + '">' + ACT[r.action] + '</td><td>' + esc(r.name) + '</td><td class="n">' + f3(r.x) + '</td><td class="n">' + f3(r.y) + '</td><td class="n">' + f3(r.z) + '</td><td>' + esc(r.memo || '') + '</td></tr>').join('')
        + (planned.length > 500 ? '<tr><td colspan="7">ほか ' + (planned.length - 500) + ' 行</td></tr>' : '') + '</tbody></table>';
      errs.innerHTML = parsed.errors.slice(0, 20).map(e => '<li>' + e.line + ' 行目：' + esc(e.reason) + '（' + esc(e.text.slice(0, 60)) + '）</li>').join('') + (parsed.errors.length > 20 ? '<li>ほか ' + (parsed.errors.length - 20) + ' 行</li>' : '');
      if (okBtn) { okBtn.disabled = !n; okBtn.textContent = n ? '登録する（' + n + ' 点）' : '登録する'; }
    }
    let timer; ta.addEventListener('input', () => { srcLabel = '貼り付け'; fileName.textContent = ''; clearTimeout(timer); timer = setTimeout(refresh, 200); });
    policy.addEventListener('change', refresh); swap.addEventListener('change', refresh);
    fileBtn.addEventListener('click', () => pickFile('.csv,.txt,.tsv,.sim,.sima,text/plain,text/csv', async f => {
      ta.value = P.decode(await f.arrayBuffer()); srcLabel = f.name; fileName.textContent = f.name; refresh();
    }));
    D.open({
      title: '座標を取り込む', width: 760,
      body: h('div', { class: 'imp' }, [
        h('div', { class: 'row' }, [fileBtn, fileName]), ta,
        h('div', { class: 'row' }, [policy, kind, h('label', {}, [swap, ' X と Y を入れ替える（点名,Y,X のファイル）'])]),
        h('p', { class: 'small', text: '書き方：点名,X,Y[,Z][,メモ] ／ 番号,点名,X,Y[,Z] ／ タブ・空白区切りも可。先頭の見出しの行は読み飛ばします。' }),
        sum, tbl, errs]),
      buttons: [
        { label: 'やめる' },
        { label: '登録する', kind: 'primary', ref: b => { okBtn = b; b.disabled = true; }, onClick: async () => {
          const site = state.site, byName = new Map(state.points.map(p => [p.name, p]));
          const out = []; let order = Date.now();
          for (const r of planned) {
            if (r.action === 'skip') continue;
            const old = (r.action === 'replace' || r.action === 'replace-dup') ? (byName.get(r.name) || out.find(p => p.name === r.name)) : null;
            if (old) Object.assign(old, { x: r.x, y: r.y, z: r.z, memo: r.memo || old.memo, src: srcLabel });
            const rec = old || ST.newPoint(site.id, { name: r.name, x: r.x, y: r.y, z: r.z, kind: kind.value, memo: r.memo, src: srcLabel }, order++);
            if (!out.includes(rec)) out.push(rec);
            byName.set(rec.name, rec);
          }
          await guard(async () => { await ST.putPoints(site.id, out); await loadPoints(); toast(out.length + ' 点を登録しました'); });
        } }
      ]
    });
  }

  // 書き出し：表示中の点（絞り込んでいればその点だけ）
  let expMenu = null;
  function exportMenu() {
    if (expMenu) { expMenu.close(); expMenu = null; return; }
    const list = P.search(state.points, state.q, { kind: state.kind, sort: state.sort });
    const what = (state.q || state.kind ? '表示中の ' : '全部の ') + list.length + ' 点';
    expMenu = D.menu($('exp'), [
      { note: what },
      { label: 'CSV（Excel で開ける）', disabled: !list.length, onClick: () => guard(async () => {
        if (await download(safeName(state.site.name) + '-座標-' + today() + '.csv', '\ufeff' + P.toCsv(list), 'text/csv')) toast(list.length + ' 点を CSV で書き出しました');
      }) },
      { label: 'SIMA（測量ソフト用・Shift_JIS）', disabled: !list.length, onClick: () => guard(async () => {
        const r = P.encodeSjis(P.toSima(list, state.site.name));
        if (await download(safeName(state.site.name) + '-座標-' + today() + '.sim', r.bytes, 'application/octet-stream'))
          toast(list.length + ' 点を SIMA で書き出しました' + (r.lost ? '（Shift_JIS にない文字 ' + r.lost + ' 個は ? にしました）' : ''));
      }) }
    ]);
    const close = expMenu.close; expMenu.close = () => { close(); expMenu = null; };
    setTimeout(function watch() { if (expMenu && !document.querySelector('.menu')) expMenu = null; else if (expMenu) setTimeout(watch, 300); }, 300);
  }

  // バックアップのお知らせ：まだない、最後のバックアップから 7 日、または計算を 20 件保存したら
  async function checkBackup() {
    const note = $('backupNote');
    if (state.dismissBackup || !state.sites.length) { note.hidden = true; return; }
    let any = state.points.length > 0;
    if (!any) for (const s of state.sites) { if ((await ST.listPoints(s.id)).length) { any = true; break; } }
    if (!any) { note.hidden = true; return; }
    const last = await ST.getMeta('lastBackup', null), n = await ST.getMeta('calcsSinceBackup', 0);
    const days = last ? (Date.now() - new Date(last).getTime()) / 864e5 : Infinity;
    let msg = '';
    if (!last) msg = 'まだバックアップがありません。';
    else if (days >= 7) msg = '最後のバックアップから ' + Math.floor(days) + ' 日たちました。';
    else if (n >= 20) msg = 'バックアップのあと、計算を ' + n + ' 件保存しました。';
    note.hidden = !msg;
    $('backupMsg').textContent = msg + 'ブラウザのデータは消えることがあるので、ファイルにも残してください。';
  }

  // ---- 起動 ----
  function bind() {
    $('site').addEventListener('change', e => guard(() => loadSites(e.target.value)));
    $('siteMenu').addEventListener('click', () => guard(siteMenu));
    $('firstSite').addEventListener('click', () => guard(createSite));
    let t; $('q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; state.shown = PAGE; render(); }, 80); });
    $('sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
    $('add').addEventListener('click', () => pointForm(null));
    $('imp').addEventListener('click', importForm);
    $('exp').addEventListener('click', exportMenu);
    $('backupNow').addEventListener('click', () => guard(() => backupSites(true)));
    $('backupLater').addEventListener('click', () => { state.dismissBackup = true; $('backupNote').hidden = true; });
    $('more').addEventListener('click', () => { state.shown += PAGE; render(); });
    $('list').addEventListener('click', e => {
      const li = e.target.closest('li[data-id]'); if (!li) return;
      const p = state.points.find(x => x.id === li.dataset.id); if (p) pointForm(p);
    });
    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  }
  function showTab(name) {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === name));
    document.querySelectorAll('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + name; });
    state.tab = name;
    for (const fn of hooks.tab) fn(name);
    window.scrollTo(0, 0);
  }
  // 最近使った点を記録する（新しい順に 20 点まで）
  async function useRecent(ids) {
    if (!state.site || !ids.length) return;
    state.recent = ids.concat(state.recent.filter(id => !ids.includes(id))).slice(0, 20);
    await ST.setMeta('recent:' + state.site.id, state.recent);
  }
  // 測設・履歴（genba-calc.js）から使う
  window.FxGenba = { state, hooks, toast, guard, download, esc, f3, today, safeName, loadPoints, pickFile, showTab, useRecent, checkBackup, siteMenu: () => siteMenu() };
  bind();
  document.addEventListener('DOMContentLoaded', () => guard(async () => { await ST.persist(); await loadSites(); }));
  window.__genba = state;   // 確かめ用
})();
