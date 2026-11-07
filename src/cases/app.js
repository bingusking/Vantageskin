// Menu for the case game: Cases, Inventory, Codex and Play.
import { SKINS, RARITY, RARITIES, CONDITIONS, condition, itemTitle, WEAPON_NAMES } from '../items/catalog.js';
import { patternInfo, hasPatterns } from '../items/patterns.js';
import { KNIFE_TYPES } from '../shared/knives.js';
import { WEAPONS } from '../weapons.js';
import { Viewer, thumbnail, previewItem, modelFor } from '../ui/studio.js';
import { audio } from '../audio.js';
import * as S from './store.js';

const h = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => n.toLocaleString('en-US');

const weaponLabel = (d) => (d.knife ? '★ ' + KNIFE_TYPES[d.knife] : WEAPON_NAMES[d.weapon] || d.weapon);
function categoryOf(d) {
  if (d.knife) return 'knife';
  const c = WEAPONS[d.weapon]?.cls || 'pistol';
  return c === 'shotgun' || c === 'lmg' ? 'heavy' : c;
}
const CATS = [['all', 'All'], ['knife', 'Knives'], ['pistol', 'Pistols'], ['smg', 'SMGs'], ['rifle', 'Rifles'], ['sniper', 'Snipers'], ['heavy', 'Heavy']];

// Search text for a skin definition: weapon name and id, finish name, rarity.
const searchText = (d) => [weaponLabel(d), d.weapon.replace('knife:', ''), d.name, RARITY[d.rarity].name, d.knife ? 'knife' : '', WEAPONS[d.weapon]?.cls || '']
  .join(' ').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ');
const norm = (q) => q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
export function searchSkins(q, list = Object.values(SKINS)) {
  const toks = norm(q);
  if (!toks.length) return list;
  return list.filter(d => { const t = searchText(d); return toks.every(k => t.includes(k)); });
}

// ---------------------------------------------------------------- case art
const artCache = {};
function caseArt(c) {
  if (artCache[c.id]) return artCache[c.id];
  const cv = document.createElement('canvas'); cv.width = 360; cv.height = 230;
  const x = cv.getContext('2d');
  x.translate(180, 122);
  const glow = x.createRadialGradient(0, 0, 10, 0, 0, 170);
  glow.addColorStop(0, c.color + '55'); glow.addColorStop(1, c.color + '00');
  x.fillStyle = glow; x.fillRect(-180, -122, 360, 230);
  // body with a little perspective
  const body = x.createLinearGradient(0, -62, 0, 62);
  body.addColorStop(0, '#34322d'); body.addColorStop(1, '#1d1c19');
  x.fillStyle = body; x.fillRect(-125, -62, 250, 124);
  x.fillStyle = c.color; x.fillRect(-125, -62, 250, 18); x.fillRect(-125, 44, 250, 18);
  x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(-125, -62, 250, 3);
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(-125, 59, 250, 3);
  // latches + handle
  x.fillStyle = '#9a968c'; x.fillRect(-118, -10, 16, 20); x.fillRect(102, -10, 16, 20);
  x.fillStyle = '#55524b'; x.fillRect(-34, -74, 68, 12);
  x.font = '700 30px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ebe7df';
  x.fillText(c.name.replace(' Case', '').toUpperCase(), 0, 4);
  x.font = '600 13px "Barlow Condensed", sans-serif'; x.fillStyle = c.color;
  x.fillText(c.id === 'gold' ? '★ KNIFE CASE ★' : RARITY[c.rarity].name.toUpperCase() + ' ONLY', 0, 26);
  return (artCache[c.id] = cv.toDataURL());
}

export class App {
  constructor(root, onPlay) {
    this.root = root; this.onPlay = onPlay;
    this.tab = 'cases';
    this.inv = { cat: 'all', sort: 'newest' };
    this.codex = { q: '', cat: 'all', rarity: 'all' };
    S.onChange(() => this.updateBar());
  }

  show() {
    this.root.style.display = 'block';
    this.root.innerHTML = `
      <div class="client cg">
        <header class="bar">
          <div class="mark"><i></i>VANTAGE <span class="sub">CASES</span></div>
          <nav>${['cases', 'inventory', 'codex', 'play'].map(t => `<button data-tab="${t}">${t}</button>`).join('')}</nav>
          <div class="who"><span class="stat-skins"></span><span class="stat-open"></span></div>
        </header>
        <main class="page"></main>
        <div class="modal-layer"></div>
      </div>`;
    this.$ = (s) => this.root.querySelector(s);
    this.$('nav').onclick = (e) => { const t = e.target.dataset.tab; if (t) { audio.init(); audio.ui(); this.go(t); } };
    this.updateBar();
    this.go(this.tab === 'play' ? 'cases' : this.tab);
  }
  hide() { this.closeModal(); this.root.style.display = 'none'; this.root.innerHTML = ''; }

  updateBar() {
    if (!this.$?.('.stat-skins')) return;
    this.$('.stat-skins').textContent = `${fmt(S.items().length)} skins`;
    this.$('.stat-open').textContent = `${fmt(S.stats().opened)} opened`;
  }

  go(tab) {
    if (tab === 'play') { this.onPlay(); return; }
    this.tab = tab;
    this.closeModal();
    for (const b of this.root.querySelectorAll('nav button')) b.classList.toggle('on', b.dataset.tab === tab);
    const page = this.$('.page');
    page.onclick = null; page.oninput = null;
    page.className = 'page page-' + tab;
    this[`render_${tab}`](page);
  }

  toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    this.$('.client').appendChild(t); setTimeout(() => t.remove(), 2200);
  }

  closeModal() {
    this.modalViewer?.dispose(); this.modalViewer = null;
    clearTimeout(this.paintT);
    const layer = this.$?.('.modal-layer');
    if (layer) { layer.innerHTML = ''; layer.onclick = null; layer.oninput = null; }
  }

  // lazy thumbnails for everything in scope with data-def (a preview) or data-uid (an owned item)
  lazyThumbs(scope) {
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const el = e.target;
        const it = el.dataset.uid ? S.find(el.dataset.uid) : previewItem(el.dataset.def);
        if (it) thumbnail(it, url => { el.src = url; }, { priority: true });
      }
    }, { root: null, rootMargin: '300px' });
    for (const img of scope.querySelectorAll('img[data-def], img[data-uid]')) io.observe(img);
  }

  // ------------------------------------------------------------- cases
  render_cases(page) {
    const st = S.stats();
    page.innerHTML = `
      <div class="cases-head"><h3>Cases</h3><p class="note">Every case is free to open. Each colour guarantees that rarity from Vantage's full skin list, and the Gold Case always gives a ★ knife. Float, pattern and tally roll exactly like Vantage.</p></div>
      <div class="cg-cases">${S.COLOR_CASES.map(c => `
        <div class="cg-case" style="--rc:${c.color}">
          <img src="${caseArt(c)}" alt="">
          <div class="meta"><b>${h(c.name)}</b><small>${h(c.blurb)}</small>
            <small class="dim">${c.id === 'gold' ? `${Object.keys(KNIFE_TYPES).length - 1} knives × ${S.casePool('gold').length / (Object.keys(KNIFE_TYPES).length - 1)} finishes` : `${S.casePool(c.id).length} finishes`} · opened ${fmt(st.byCase[c.id] || 0)}</small></div>
          <div class="btns"><button data-view="${c.id}">Contents</button><button class="pri" data-open="${c.id}">Open</button></div>
        </div>`).join('')}</div>`;
    page.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      audio.init(); audio.ui();
      if (b.dataset.view) this.caseView(b.dataset.view);
      if (b.dataset.open) { this.caseView(b.dataset.open); this.openNow(b.dataset.open); }
    };
  }

  caseView(caseId) {
    this.closeModal();
    const c = S.CASE[caseId], gold = caseId === 'gold';
    const layer = this.$('.modal-layer');
    let contents = S.casePool(caseId);
    if (gold) contents = [...contents].sort((a, b) => a.knife.localeCompare(b.knife));
    else contents = [...contents].sort((a, b) => a.weapon.localeCompare(b.weapon) || a.name.localeCompare(b.name));
    layer.innerHTML = `
      <div class="modal casev cg-casev" style="--rc:${c.color}">
        <div class="ch"><div><small>${gold ? '★ Knife case' : RARITY[c.rarity].name + ' case'}</small><h2>${h(c.name)}</h2></div><button class="x" data-act="close">Close</button></div>
        <div class="reel-wrap hidden"><div class="needle"></div><div class="reel"></div></div>
        <div class="contents">${contents.map(d => `<div class="ci" style="--rc:${RARITY[d.rarity].color}"><img data-def="${d.id}" alt=""><span class="w">${h(weaponLabel(d))}</span><span class="n">${h(d.name)}</span></div>`).join('')}</div>
        <div class="cfoot">
          <table class="odds"><tr><td><i style="background:${c.color}"></i>${gold ? '★ Knife (any type, any finish)' : RARITY[c.rarity].name}</td><td>100%</td></tr><tr><td><i style="background:#888"></i>Each of ${contents.length} items</td><td>${gold ? 'equal per knife type' : (100 / contents.length).toFixed(2) + '%'}</td></tr></table>
          <div class="unlock"><button class="pri big" data-act="open">Open ${h(c.name)}</button></div>
        </div>
      </div>`;
    this.lazyThumbs(layer);
    layer.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      audio.ui();
      if (b.dataset.act === 'close') { this.closeModal(); this.go(this.tab); }
      if (b.dataset.act === 'open') this.openNow(caseId);
    };
  }

  openNow(caseId) { const won = S.openCase(caseId); this.spin(caseId, won); }

  // Horizontal reel that decelerates onto the won item (as in Vantage).
  spin(caseId, won) {
    const layer = this.$('.modal-layer');
    layer.querySelector('.contents').classList.add('hidden');
    layer.querySelector('.cfoot').classList.add('hidden');
    const wrap = layer.querySelector('.reel-wrap'); wrap.classList.remove('hidden');
    const reel = layer.querySelector('.reel');
    const N = 56, WIN = 48, TW = 168;
    const filler = [];
    for (let i = 0; i < N; i++) filler.push(i === WIN ? won : S.rollCase(caseId));
    const gold = caseId === 'gold';
    reel.innerHTML = filler.map((it, i) => {
      const d = SKINS[it.defId], r = RARITY[d.rarity];
      const hide = gold && i !== WIN;
      return `<div class="rt" style="--rc:${r.color}">${hide ? '<div class="star">★</div>' : `<img data-i="${i}" alt="">`}<span class="w">${hide ? 'Rare special item' : h(weaponLabel(d))}</span><span class="n">${hide ? '★' : h(d.name)}</span></div>`;
    }).join('');
    for (const img of reel.querySelectorAll('img[data-i]')) thumbnail(previewItem(filler[+img.dataset.i].defId), url => { img.src = url; }, { priority: +img.dataset.i === WIN });
    const vw = wrap.clientWidth;
    const offset = WIN * TW - vw / 2 + TW / 2 + (Math.random() - 0.5) * (TW * 0.8);
    reel.style.transition = 'none'; reel.style.transform = 'translateX(0)';
    void reel.offsetWidth;
    reel.style.transition = 'transform 6.5s cubic-bezier(0.12, 0.72, 0.1, 1)';
    reel.style.transform = `translateX(${-offset}px)`;
    let last = -1;
    const tick = () => {
      const m = new DOMMatrix(getComputedStyle(reel).transform);
      const idx = Math.floor((-m.m41 + vw / 2) / TW);
      if (idx !== last) { last = idx; audio.ui(); }
      if (reel.isConnected && reel.dataset.done !== '1') requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    reel.addEventListener('transitionend', () => {
      reel.dataset.done = '1';
      audio.ui(RARITY[SKINS[won.defId].rarity].tier >= 2 ? 'win' : 'click');
      setTimeout(() => { if (reel.isConnected) this.inspect(won, { fromCase: caseId }); }, 700);
    }, { once: true });
  }

  // ------------------------------------------------------------- inspect (owned item)
  inspect(it, { fromCase = null } = {}) {
    this.closeModal();
    const layer = this.$('.modal-layer');
    const render = () => {
      const d = SKINS[it.defId], r = RARITY[d.rarity], t = itemTitle(it), c = condition(it.float), pt = patternInfo(d, it.seed);
      const eq = S.isEquipped(it);
      layer.innerHTML = `
        <div class="modal inspect" style="--rc:${r.color}">
          <div class="view"><div class="vp"></div>
            <div class="presets">${['left', 'right', 'top', 'muzzle'].map(v => `<button data-view="${v}">${v}</button>`).join('')}</div>
            <p class="hint">Drag to rotate · scroll to zoom</p>
          </div>
          <div class="info">
            <button class="x" data-act="close">Close</button>
            <div class="rar"><i></i>${r.name}${d.knife ? ' · Knife' : ''}${fromCase ? ' · Unboxed' : ''}</div>
            <h2><small>${h(t.weapon)}</small>${h(t.name)}</h2>
            <dl>
              <dt>Condition</dt><dd>${c.name}</dd>
              <dt>Float</dt><dd class="mono">${it.float.toFixed(9)}</dd>
              <dt>Pattern</dt><dd class="mono">${it.seed}${pt.name ? ` · <span class="${pt.special ? 'pat-special' : ''}">${h(pt.name)}</span>` : ''}</dd>
              ${it.tally != null ? `<dt>Tally</dt><dd class="mono">Tally counter</dd>` : ''}
            </dl>
            <div class="wearbar">${CONDITIONS.map((cc, i) => { const lo = i ? CONDITIONS[i - 1].max : 0; return `<span style="flex:${cc.max - lo}" class="${cc === c ? 'on' : ''}">${cc.id}</span>`; }).join('')}<b style="left:${(it.float * 100).toFixed(2)}%"></b></div>
            <div class="acts">
              ${fromCase ? `<button data-act="again" class="pri">Open another ${h(S.CASE[fromCase].name)}</button>` : ''}
              <button data-act="equip" class="${fromCase ? '' : 'pri'}">${eq ? 'Unequip' : 'Equip for Play'}</button>
              <button data-act="codex">View in Codex</button>
              ${fromCase ? '<button data-act="close">Keep</button>' : '<button data-act="delete" class="danger">Delete</button>'}
            </div>
          </div>
        </div>`;
      const v = new Viewer(layer.querySelector('.vp'));
      v.setItem(it);
      this.modalViewer?.dispose(); this.modalViewer = v;
    };
    render();
    layer.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) { if (e.target === layer) { this.closeModal(); this.go(this.tab); } return; }
      audio.ui();
      if (b.dataset.view) return this.modalViewer.view(b.dataset.view);
      const a = b.dataset.act;
      if (a === 'close') { this.closeModal(); this.go(this.tab); }
      if (a === 'again') { this.caseView(fromCase); this.openNow(fromCase); }
      if (a === 'equip') { S.toggleEquip(it); this.toast(S.isEquipped(it) ? 'Equipped: you start Play with it' : 'Unequipped'); render(); }
      if (a === 'codex') this.codexDetail(it.defId, { float: it.float, seed: it.seed });
      if (a === 'delete') { if (!confirm(`Delete ${itemTitle(it).weapon} | ${itemTitle(it).name}?`)) return; S.remove(it); this.closeModal(); this.go('inventory'); }
    };
  }

  // ------------------------------------------------------------- inventory
  render_inventory(page) {
    const all = S.items();
    const f = this.inv;
    let list = all.filter(it => f.cat === 'all' || categoryOf(SKINS[it.defId]) === f.cat);
    const sorters = {
      newest: (a, b) => b.acquired - a.acquired,
      rarity: (a, b) => RARITY[SKINS[b.defId].rarity].tier - RARITY[SKINS[a.defId].rarity].tier || b.acquired - a.acquired,
      float: (a, b) => a.float - b.float,
      name: (a, b) => weaponLabel(SKINS[a.defId]).localeCompare(weaponLabel(SKINS[b.defId])) || SKINS[a.defId].name.localeCompare(SKINS[b.defId].name),
    };
    list = [...list].sort(sorters[f.sort]);
    const byR = Object.fromEntries(RARITIES.map(r => [r.id, all.filter(it => SKINS[it.defId].rarity === r.id).length]));
    page.innerHTML = `
      <aside class="filters">
        <h3>Inventory</h3>
        <div class="count">${all.length} skins</div>
        ${CATS.map(([id, l]) => `<button data-cat="${id}" class="${f.cat === id ? 'on' : ''}">${l}<span>${id === 'all' ? all.length : all.filter(i => categoryOf(SKINS[i.defId]) === id).length}</span></button>`).join('')}
        <label class="sort">Sort <select>${[['newest', 'Newest'], ['rarity', 'Rarity'], ['float', 'Float (best first)'], ['name', 'Name']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="cg-rbars">${RARITIES.map(r => `<div style="--rc:${r.color}"><i></i>${r.name}<b>${byR[r.id]}</b></div>`).join('')}</div>
        ${all.length ? '<button class="danger cg-clear" data-clear="1">Clear inventory</button>' : ''}
      </aside>
      <section class="grid">${list.length ? list.map(it => this.tile(it)).join('') : '<p class="empty">Nothing here yet. Open some cases!</p>'}</section>`;
    page.querySelector('select').onchange = (e) => { f.sort = e.target.value; this.go('inventory'); };
    page.onclick = (e) => {
      const c = e.target.closest('[data-cat]'); if (c) { f.cat = c.dataset.cat; return this.go('inventory'); }
      if (e.target.closest('[data-clear]')) { if (confirm('Delete every skin in your inventory?')) { S.clearAll(); this.go('inventory'); } return; }
      const t = e.target.closest('.tile'); if (!t) return;
      audio.init(); audio.ui();
      const it = S.find(t.dataset.uid); if (it) this.inspect(it);
    };
    this.lazyThumbs(page);
  }

  tile(it) {
    const d = SKINS[it.defId], r = RARITY[d.rarity], t = itemTitle(it);
    const pt = patternInfo(d, it.seed);
    return `<button class="tile skin" data-uid="${it.uid}" style="--rc:${r.color}">
      <img data-uid="${it.uid}" alt="">
      ${S.isEquipped(it) ? '<i class="eq">Equipped</i>' : ''}
      <i class="cond">${condition(it.float).id}</i>
      ${it.tally != null ? '<i class="tally">✓</i>' : ''}
      ${pt.special ? `<i class="gem">${h(pt.name)}</i>` : ''}
      <span class="w">${h(t.weapon)}</span><span class="n">${h(t.name)}</span>
    </button>`;
  }

  // ------------------------------------------------------------- codex
  render_codex(page) {
    const f = this.codex;
    page.innerHTML = `
      <aside class="filters codex-side">
        <h3>Codex</h3>
        <input class="cg-search" type="search" placeholder="Search · e.g. karambit sunset fade" value="${h(f.q)}" autocomplete="off" spellcheck="false">
        <div class="count cg-count"></div>
        ${CATS.map(([id, l]) => `<button data-cat="${id}" class="${f.cat === id ? 'on' : ''}">${l}</button>`).join('')}
        <h3 style="margin-top:16px">Rarity</h3>
        <button data-rar="all" class="${f.rarity === 'all' ? 'on' : ''}">All rarities</button>
        ${RARITIES.map(r => `<button data-rar="${r.id}" class="${f.rarity === r.id ? 'on' : ''}" style="--rc:${r.color}"><i class="dotc"></i>${r.name}</button>`).join('')}
      </aside>
      <section class="grid cg-codex"></section>`;
    const grid = page.querySelector('.cg-codex');
    const draw = () => {
      let list = Object.values(SKINS)
        .filter(d => f.cat === 'all' || categoryOf(d) === f.cat)
        .filter(d => f.rarity === 'all' || d.rarity === f.rarity);
      list = searchSkins(f.q, list).sort((a, b) => RARITY[b.rarity].tier - RARITY[a.rarity].tier || weaponLabel(a).localeCompare(weaponLabel(b)) || a.name.localeCompare(b.name));
      page.querySelector('.cg-count').textContent = `${list.length} of ${Object.keys(SKINS).length} skins`;
      const owned = {};
      for (const it of S.items()) owned[it.defId] = (owned[it.defId] || 0) + 1;
      grid.innerHTML = list.length ? list.map(d => `<button class="tile skin" data-def="${d.id}" style="--rc:${RARITY[d.rarity].color}">
          <img data-def="${d.id}" alt="">${owned[d.id] ? `<i class="eq">Owned × ${owned[d.id]}</i>` : ''}${hasPatterns(d) ? '<i class="cond">Patterns</i>' : ''}
          <span class="w">${h(weaponLabel(d))}</span><span class="n">${h(d.name)}</span></button>`).join('')
        : '<p class="empty">No skins match that search.</p>';
      this.lazyThumbs(grid);
    };
    draw();
    const input = page.querySelector('.cg-search');
    input.oninput = () => { f.q = input.value; clearTimeout(this.searchT); this.searchT = setTimeout(draw, 120); };
    input.onkeydown = (e) => { if (e.key === 'Enter') { const first = grid.querySelector('.tile'); if (first) this.codexDetail(first.dataset.def); } };
    setTimeout(() => input.focus(), 0);
    page.onclick = (e) => {
      const c = e.target.closest('[data-cat]'); if (c) { f.cat = c.dataset.cat; return this.go('codex'); }
      const r = e.target.closest('[data-rar]'); if (r) { f.rarity = r.dataset.rar; return this.go('codex'); }
      const t = e.target.closest('.tile'); if (!t) return;
      audio.init(); audio.ui();
      this.codexDetail(t.dataset.def);
    };
  }

  // Every pattern template for a finish: [name, chance, seeds].
  patternGroups(d) {
    if (!hasPatterns(d)) return [];
    const groups = new Map();
    for (let s = 0; s < 1000; s++) {
      const p = patternInfo(d, s);
      let name = p.name;
      // plain percentages are grouped into bands so the list stays readable
      const m = !p.special && name.match(/^(\d+)% (blue|fade)$/);
      if (m) { const lo = Math.floor(+m[1] / 10) * 10; name = `${lo}–${lo + 9}% ${m[2]}`; }
      if (!groups.has(name)) groups.set(name, { name, special: p.special, seeds: [] });
      groups.get(name).seeds.push(s);
    }
    return [...groups.values()].sort((a, b) => (b.special - a.special) || a.seeds.length - b.seeds.length || a.name.localeCompare(b.name));
  }

  codexDetail(defId, { float = null, seed = null } = {}) {
    this.closeModal();
    const d = SKINS[defId], r = RARITY[d.rarity];
    const [lo, hi] = d.floatRange;
    const st = this.cx = { float: float ?? Math.min(hi, Math.max(lo, 0.03)), seed: seed ?? 1 };
    const conds = CONDITIONS.map((c, i) => ({ ...c, lo: i ? CONDITIONS[i - 1].max : 0 })).filter(c => c.max > lo && c.lo < hi);
    const repFloat = (c) => Math.min(hi, Math.max(lo, (Math.max(c.lo, lo) + Math.min(c.max, hi)) / 2));
    const groups = this.patternGroups(d);
    const owned = S.items().filter(it => it.defId === defId);
    const layer = this.$('.modal-layer');
    const item = () => ({ kind: 'skin', defId, float: st.float, seed: st.seed, stickers: [] });
    layer.innerHTML = `
      <div class="modal inspect codex-detail" style="--rc:${r.color}">
        <div class="view"><div class="vp"></div>
          <div class="presets">${['left', 'right', 'top', 'muzzle'].map(v => `<button data-view="${v}">${v}</button>`).join('')}</div>
          <p class="hint">Drag to rotate · scroll to zoom</p>
          <div class="painting hidden">Painting finish…</div>
        </div>
        <div class="info">
          <button class="x" data-act="close">Close</button>
          <div class="rar"><i></i>${r.name}${d.knife ? ' · Knife' : ''} · Codex</div>
          <h2><small>${h(weaponLabel(d))}</small>${h(d.name)}</h2>
          <dl>
            <dt>Float range</dt><dd class="mono">${lo.toFixed(2)} – ${hi.toFixed(2)}</dd>
            <dt>Condition</dt><dd class="cx-cond"></dd>
            <dt>Float</dt><dd class="mono cx-float"></dd>
            <dt>Pattern</dt><dd class="mono cx-pat"></dd>
            <dt>Owned</dt><dd>${owned.length ? `${owned.length} in inventory` : 'None yet'}</dd>
          </dl>
          <h4>Wear</h4>
          <div class="cx-conds">${conds.map(c => `<button data-cond="${c.id}" title="${c.name}"><img data-wear="${c.id}" alt=""><span>${c.id}</span></button>`).join('')}</div>
          <input class="cx-slider" type="range" min="${lo}" max="${hi}" step="0.0005" value="${st.float}">
          <h4>Pattern <small>0 – 999</small></h4>
          <div class="cx-seed"><button data-seed="-1">◀</button><input type="number" min="0" max="999" value="${st.seed}"><button data-seed="1">▶</button><button data-seed="rand">Random</button></div>
          <p class="note">${groups.length ? 'This finish has pattern templates: each pattern number maps to one of the looks below. Click a number to see it.' : 'The pattern number moves the design around on the weapon: every number from 0 to 999 is a different placement.'}</p>
          ${groups.length ? `<div class="cx-groups">${groups.map(g => `<div class="cx-group ${g.special ? 'special' : ''}"><div class="gh"><b>${h(g.name)}</b><span>${(g.seeds.length / 10).toFixed(1)}% · ${g.seeds.length} patterns</span></div><div class="seeds">${g.seeds.slice(0, 14).map(s => `<button data-pick="${s}">${s}</button>`).join('')}${g.seeds.length > 14 ? `<em>+${g.seeds.length - 14}</em>` : ''}</div></div>`).join('')}</div>` : ''}
          ${owned.length ? `<h4>Your copies</h4><div class="cx-owned">${owned.map(it => `<button data-own="${it.uid}">${condition(it.float).id} · ${it.float.toFixed(4)} · #${it.seed}</button>`).join('')}</div>` : ''}
        </div>
      </div>`;
    const v = new Viewer(layer.querySelector('.vp'), { autoRotate: true });
    this.modalViewer = v;
    const painting = layer.querySelector('.painting');
    const paint = (size) => { v.setObject(modelFor(item(), { size })); };
    let wearSeed = -1;
    const refresh = (quick = false) => {
      const c = condition(st.float), pt = patternInfo(d, st.seed);
      layer.querySelector('.cx-cond').textContent = c.name;
      layer.querySelector('.cx-float').textContent = st.float.toFixed(6);
      layer.querySelector('.cx-pat').innerHTML = `${st.seed}${pt.name ? ` · <span class="${pt.special ? 'pat-special' : ''}">${h(pt.name)}</span>` : ''}`;
      layer.querySelector('.cx-slider').value = st.float;
      layer.querySelector('.cx-seed input').value = st.seed;
      for (const b of layer.querySelectorAll('[data-cond]')) b.classList.toggle('on', b.dataset.cond === c.id);
      for (const b of layer.querySelectorAll('[data-pick]')) b.classList.toggle('on', +b.dataset.pick === st.seed);
      // the 3D view: a quick low-res paint first, the full finish once you stop changing it
      clearTimeout(this.paintT);
      painting.classList.remove('hidden');
      this.paintT = setTimeout(() => {
        if (!d.finish) { paint(1024); painting.classList.add('hidden'); return; }
        if (quick) paint(256);
        this.paintT = setTimeout(() => { paint(1024); painting.classList.add('hidden'); }, quick ? 450 : 30);
      }, quick ? 60 : 20);
      // wear previews for this pattern
      if (wearSeed !== st.seed) {
        wearSeed = st.seed;
        for (const img of layer.querySelectorAll('img[data-wear]')) {
          const c2 = conds.find(x => x.id === img.dataset.wear);
          img.removeAttribute('src');
          thumbnail({ defId, float: +repFloat(c2).toFixed(4), seed: st.seed, stickers: [] }, url => { if (wearSeed === st.seed) img.src = url; }, { priority: true });
        }
      }
    };
    refresh();
    layer.oninput = (e) => {
      if (e.target.classList.contains('cx-slider')) { st.float = +e.target.value; refresh(true); }
      if (e.target.closest('.cx-seed')) { const n = Math.round(+e.target.value); if (n >= 0 && n <= 999) { st.seed = n; refresh(true); } }
    };
    layer.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) { if (e.target === layer) { this.closeModal(); if (this.tab === 'inventory') this.go('inventory'); } return; }
      audio.ui();
      if (b.dataset.view) return v.view(b.dataset.view);
      if (b.dataset.act === 'close') { this.closeModal(); if (this.tab === 'inventory') this.go('inventory'); return; }
      if (b.dataset.cond) { st.float = +repFloat(conds.find(c => c.id === b.dataset.cond)).toFixed(4); return refresh(); }
      if (b.dataset.seed) { st.seed = b.dataset.seed === 'rand' ? Math.floor(Math.random() * 1000) : (st.seed + +b.dataset.seed + 1000) % 1000; return refresh(); }
      if (b.dataset.pick) { st.seed = +b.dataset.pick; return refresh(); }
      if (b.dataset.own) { const it = S.find(b.dataset.own); if (it) { st.float = it.float; st.seed = it.seed; refresh(); } }
    };
  }
}
