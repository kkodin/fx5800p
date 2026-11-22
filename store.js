// 端末への保存（IndexedDB）：現場・点・計算の履歴
//   電卓のプログラム・メモリー（localStorage の fx5800p-emu-v1）とは別に保存する
(function (root) {
  'use strict';
  const DB_NAME = 'fx5800p-genba', DB_VER = 1;
  const FORMAT = 'fx5800p-genba';           // バックアップの印
  let dbp = null;

  const uid = () => (root.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const now = () => new Date().toISOString();

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('このブラウザでは端末に保存できません（IndexedDB がありません）')); return; }
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('sites')) db.createObjectStore('sites', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('points')) db.createObjectStore('points', { keyPath: 'id' }).createIndex('site', 'siteId');
        if (!db.objectStoreNames.contains('calcs')) db.createObjectStore('calcs', { keyPath: 'id' }).createIndex('site', 'siteId');
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); dbp = null; }; resolve(db); };
      r.onerror = () => reject(new Error('端末の保存場所を開けません：' + (r.error && r.error.message)));
      r.onblocked = () => reject(new Error('ほかのタブがこのアプリを開いています。閉じてからもう一度開いてください'));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  const done = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  const finish = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('保存を取り消しました')); });

  async function all(store, siteId) {
    const db = await open();
    const os = db.transaction(store).objectStore(store);
    return done(siteId == null ? os.getAll() : os.index('site').getAll(siteId));
  }
  async function get(store, id) { const db = await open(); return done(db.transaction(store).objectStore(store).get(id)); }
  async function putMany(store, items) {
    const db = await open();
    const tx = db.transaction(store, 'readwrite'), os = tx.objectStore(store);
    for (const it of items) os.put(it);
    return finish(tx);
  }
  async function delMany(store, ids) {
    const db = await open();
    const tx = db.transaction(store, 'readwrite'), os = tx.objectStore(store);
    for (const id of ids) os.delete(id);
    return finish(tx);
  }

  // ---- 現場 ----
  async function listSites() { return (await all('sites')).sort((a, b) => (b.updated || '').localeCompare(a.updated || '')); }
  function newSite(name, memo) {
    const t = now();
    return { id: uid(), name: String(name || '').trim() || '名前のない現場', memo: memo || '', created: t, updated: t, settings: { angleStyle: 'hyphen', dmsDot: false, zero: 'k1', tol: 0.010 } };
  }
  async function putSite(site) { site.updated = now(); await putMany('sites', [site]); return site; }
  async function touchSite(siteId) { const s = await get('sites', siteId); if (s) await putSite(s); }
  // 現場を消す（点・履歴も一緒に）
  async function deleteSite(siteId) {
    const db = await open();
    const tx = db.transaction(['sites', 'points', 'calcs'], 'readwrite');
    tx.objectStore('sites').delete(siteId);
    for (const st of ['points', 'calcs']) {
      const req = tx.objectStore(st).index('site').getAllKeys(siteId);
      req.onsuccess = () => { for (const k of req.result) tx.objectStore(st).delete(k); };
    }
    return finish(tx);
  }

  // ---- 点 ----
  // 登録順（order）で並べて返す
  async function listPoints(siteId) { return (await all('points', siteId)).sort((a, b) => (a.order || 0) - (b.order || 0)); }
  function newPoint(siteId, p, order) {
    return { id: uid(), siteId, name: String(p.name).trim(), x: +p.x, y: +p.y, z: p.z == null || p.z === '' ? null : +p.z, kind: p.kind || 'その他', memo: p.memo || '', src: p.src || '', order: order || Date.now(), updated: now() };
  }
  async function putPoints(siteId, points) {
    for (const p of points) { p.siteId = siteId; p.updated = now(); }
    await putMany('points', points); await touchSite(siteId);
  }
  async function deletePoints(siteId, ids) { await delMany('points', ids); await touchSite(siteId); }

  // ---- 計算の履歴 ----
  async function listCalcs(siteId) { return (await all('calcs', siteId)).sort((a, b) => (b.time || '').localeCompare(a.time || '')); }
  async function putCalc(siteId, calc) { calc.id = calc.id || uid(); calc.siteId = siteId; calc.time = calc.time || now(); await putMany('calcs', [calc]); await touchSite(siteId); return calc; }
  async function deleteCalcs(siteId, ids) { await delMany('calcs', ids); await touchSite(siteId); }

  // ---- 設定など ----
  async function getMeta(key, def) { const r = await get('meta', key); return r ? r.value : def; }
  async function setMeta(key, value) { return putMany('meta', [{ key, value }]); }

  // ---- バックアップ ----
  async function exportSites(siteIds) {
    const sites = (await listSites()).filter(s => !siteIds || siteIds.includes(s.id));
    const out = { format: FORMAT, version: 1, exported: now(), sites: [] };
    for (const s of sites) out.sites.push({ site: s, points: await listPoints(s.id), calcs: await listCalcs(s.id) });
    return out;
  }
  // バックアップを読む。同じ id の現場があれば mode='replace' で置き換え、'copy' で別の現場として足す
  async function importSites(data, mode) {
    if (!data || data.format !== FORMAT || !Array.isArray(data.sites)) throw new Error('現場のバックアップの形式ではありません');
    const have = new Set((await listSites()).map(s => s.id));
    const result = [];
    for (const item of data.sites) {
      const src = item.site; if (!src || !src.id) continue;
      let site = Object.assign({}, src), pts = (item.points || []).map(p => Object.assign({}, p)), cs = (item.calcs || []).map(c => Object.assign({}, c));
      if (have.has(site.id) && mode === 'copy') {
        site.id = uid(); site.name = site.name + '（読込）';
        pts.forEach(p => { p.id = uid(); }); cs.forEach(c => { c.id = uid(); });
      } else if (have.has(site.id)) await deleteSite(site.id);
      pts.forEach(p => { p.siteId = site.id; }); cs.forEach(c => { c.siteId = site.id; });
      await putMany('sites', [site]); await putMany('points', pts); await putMany('calcs', cs);
      result.push({ name: site.name, points: pts.length, calcs: cs.length });
    }
    return result;
  }

  // ブラウザに勝手に消されないように頼む（結果：true／false／null＝この端末では使えない）
  async function persist() {
    try {
      if (!navigator.storage || !navigator.storage.persist) return null;
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    } catch { return null; }
  }

  root.FxStore = { open, uid, listSites, newSite, putSite, deleteSite, listPoints, newPoint, putPoints, deletePoints, listCalcs, putCalc, deleteCalcs, getMeta, setMeta, exportSites, importSites, persist, FORMAT };
})(typeof globalThis !== 'undefined' ? globalThis : window);
