// Play: an open field with the original Vantage movement, weapons and
// viewmodels. No rounds, no money, no bots: press B to pick any gun or knife,
// in any skin from your inventory (or stock).
import { Game } from '../game.js';
import { MAPS } from '../maps.js';
import { WEAPONS, WeaponState } from '../weapons.js';
import { SKINS, RARITY, condition, itemTitle } from '../items/catalog.js';
import { KNIFE_TYPES } from '../shared/knives.js';
import { thumbnail } from '../ui/studio.js';
import * as S from './store.js';

// ---------------------------------------------------------------- the field
// A big flat sand field (176 m square) with a few crate stacks to shoot at.
// Built procedurally by the same level builder as Vantage's maps.
function fieldGrid() {
  const N = 44, rows = [];
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let z = 0; z < N; z++) {
    let row = '';
    for (let x = 0; x < N; x++) {
      const edge = x === 0 || z === 0 || x === N - 1 || z === N - 1;
      const mid = Math.abs(x - N / 2) <= 1 && Math.abs(z - N / 2) <= 1;
      const near = Math.abs(x - N / 2) <= 5 && Math.abs(z - N / 2) <= 5;
      if (edge) row += '#';
      else if (mid) row += 'K';
      else if (!near && r() < 0.025) row += r() < 0.4 ? 'C' : 'c';
      else row += ',';
    }
    rows.push(row);
  }
  return rows;
}
MAPS.field = {
  id: 'field', name: 'Open Field', description: 'A flat open field for trying out weapons and skins.',
  cell: 4, wallHeight: 3, sun: { x: 0.55, y: 1, z: 0.35 }, grid: fieldGrid(),
};

// ---------------------------------------------------------------- picker
const GROUPS = [
  ['Pistols', w => w.cls === 'pistol'], ['SMGs', w => w.cls === 'smg'], ['Rifles', w => w.cls === 'rifle'],
  ['Snipers', w => w.cls === 'sniper'], ['Heavy', w => w.cls === 'shotgun' || w.cls === 'lmg'],
];
const h = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

class Picker {
  constructor(game) {
    this.g = game;
    this.open = false;
    this.sel = 'ak47';
    this.el = document.createElement('div');
    this.el.className = 'sbx-picker hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
  }
  toggle(force) {
    this.open = force ?? !this.open;
    this.g.hud.buyOpen = this.open;          // freezes firing/moving and stops the pause screen, like the buy menu
    this.el.classList.toggle('hidden', !this.open);
    if (this.open) { document.exitPointerLock(); this.render(); }
    else if (!this.g.paused && this.g.running) this.g.canvas.requestPointerLock();
  }
  render() {
    const guns = Object.values(WEAPONS).filter(w => w.slot === 1 || w.slot === 2);
    const knifeTypes = Object.keys(KNIFE_TYPES);
    const isKnife = this.sel.startsWith('knife:');
    const owned = S.items().filter(it => {
      const d = SKINS[it.defId];
      return isKnife ? d.knife === this.sel.slice(6) : !d.knife && d.weapon === this.sel;
    }).sort((a, b) => RARITY[SKINS[b.defId].rarity].tier - RARITY[SKINS[a.defId].rarity].tier || a.float - b.float);
    const selName = isKnife ? KNIFE_TYPES[this.sel.slice(6)] : WEAPONS[this.sel].name;
    this.el.innerHTML = `
      <div class="sbx-box">
        <div class="sbx-head"><h2>Pick a weapon</h2><span>Any gun or knife · skins come from your inventory</span><button data-close="1" class="x">Close · B</button></div>
        <div class="sbx-cols">
          <div class="sbx-weapons">
            ${GROUPS.map(([name, f]) => `<section><h4>${name}</h4>${guns.filter(f).map(w => `<button data-w="${w.id}" class="${this.sel === w.id ? 'on' : ''}">${h(w.name)}<em>${S.items().filter(it => SKINS[it.defId].weapon === w.id).length || ''}</em></button>`).join('')}</section>`).join('')}
            <section><h4>Knives</h4>${knifeTypes.map(k => `<button data-w="knife:${k}" class="${this.sel === 'knife:' + k ? 'on' : ''}">${h(KNIFE_TYPES[k])}<em>${S.items().filter(it => SKINS[it.defId].knife === k).length || ''}</em></button>`).join('')}</section>
          </div>
          <div class="sbx-skins">
            <h3>${isKnife ? '★ ' : ''}${h(selName)}</h3>
            <div class="sbx-grid">
              ${this.sel === 'knife:standard' || !isKnife ? `<button class="sbx-skin" data-stock="1" style="--rc:#6d6a62"><div class="ph">STOCK</div><span class="n">Stock</span><span class="w">No finish</span></button>` : `<button class="sbx-skin" data-stock="1" style="--rc:#e7b53c"><div class="ph">★</div><span class="n">Vanilla</span><span class="w">No finish</span></button>`}
              ${owned.map(it => { const t = itemTitle(it), d = SKINS[it.defId]; return `<button class="sbx-skin" data-uid="${it.uid}" style="--rc:${RARITY[d.rarity].color}"><img data-t="${it.uid}" alt=""><span class="n">${h(t.name)}</span><span class="w">${condition(it.float).name} · #${it.seed}</span></button>`; }).join('')}
            </div>
            ${owned.length ? '' : '<p class="note">You don’t own a skin for this yet. Open cases in the menu to get some.</p>'}
          </div>
        </div>
      </div>`;
    for (const img of this.el.querySelectorAll('img[data-t]')) { const it = S.find(img.dataset.t); if (it) thumbnail(it, url => { img.src = url; }); }
  }
  click(e) {
    const b = e.target.closest('button'); if (!b) return;
    this.g.audio.ui();
    if (b.dataset.close) return this.toggle(false);
    if (b.dataset.w) { this.sel = b.dataset.w; return this.render(); }
    const isKnife = this.sel.startsWith('knife:');
    let item = null;
    if (b.dataset.uid) item = S.find(b.dataset.uid);
    else if (isKnife && this.sel !== 'knife:standard') item = { kind: 'skin', defId: `knife:${this.sel.slice(6)}:vanilla`, float: 0, seed: 0, stickers: [] };
    this.g.give(isKnife ? 'knife' : this.sel, item);
    this.toggle(false);
  }
  dispose() { this.el.remove(); }
}

// ---------------------------------------------------------------- game
export class Sandbox extends Game {
  constructor(canvas, opts, settings, onExit) {
    super(canvas, { ...opts, map: 'field', teamSize: 0, side: 'CT', freezeTime: 0, roundTime: 1e9, winRounds: 1e9 }, settings, onExit);
    document.body.classList.add('sandbox');
    this.picker = new Picker(this);
    const hud = this.hud;
    hud.toggleBuy = (force) => this.picker.toggle(force);
    hud.buyKey = () => {};
    hud.refreshBuy = () => {};
    hud.goLive = () => {};
    const quit = hud.$('[data-a="quit"]'); if (quit) quit.textContent = 'Back to menu';
    this.ready.then(() => hud.message('Open field', 'Press B to pick any gun or knife', 4));
  }
  // no bots, bomb, rounds or economy
  planRound() {}
  checkRoundEnd() {}
  endRound() {}
  canBuy() { return this.player.alive; }
  tick(dt) { if (this.state === 'live') this.stateTimer = 1e9; super.tick(dt); }

  startRound() {
    this.hud.roundStart = () => {};
    super.startRound();
    // start with your equipped AK (or the stock one) and your equipped knife
    if (this.round === 1) this.give('ak47', this.opts.skins.ak47 || null, true);
  }

  onAction(a, isDown) {
    if (a === 'buy') { if (isDown && this.player.alive) this.picker.toggle(); return; }
    super.onAction(a, isDown);
  }

  // Puts a weapon in its slot with a finish and switches to it.
  give(id, item, quiet = false) {
    const p = this.player, def = WEAPONS[id];
    this.opts.skins[id] = item || null;
    const ws = new WeaponState(id);
    if (ws.isGun) ws.reserve = Math.max(ws.reserve, def.magSize * 4);
    p.weapons[def.slot] = ws;
    p.slot = 0;
    this.switchWeapon(def.slot);
    if (!quiet) {
      const t = item?.defId ? itemTitle(item) : null;
      const label = t ? `${t.weapon} | ${t.name}` : id === 'knife' ? 'Field Knife' : def.name;
      this.hud.notice(label, 1.6);
    }
  }

  // ammo never runs out on the field
  reload() {
    const w = this.player.weapon;
    if (w?.isGun) w.reserve = Math.max(w.reserve, w.def.magSize * 4);
    super.reload();
  }

  dispose() {
    document.body.classList.remove('sandbox');
    this.picker?.dispose();
    super.dispose();
  }
}
