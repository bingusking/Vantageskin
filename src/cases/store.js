// Inventory for the case game: every skin you unbox, what you have equipped
// for Play, and a few counters. Kept in this browser (localStorage).
import { SKINS, RARITIES } from '../items/catalog.js';
import { makeSkin } from '../shared/economy.js';

const KEY = 'vantage.cases.inventory.v1';
const listeners = new Set();

function fresh() { return { items: [], equipped: {}, stats: { opened: 0, byCase: {} } }; }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.items)) {
      const out = { ...fresh(), ...s, stats: { ...fresh().stats, ...s.stats } };
      out.items = out.items.filter(it => SKINS[it.defId]);
      for (const [slot, id] of Object.entries(out.equipped)) if (!out.items.some(i => i.uid === id)) delete out.equipped[slot];
      return out;
    }
  } catch { /* storage unavailable or corrupt */ }
  return fresh();
}
let state = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode / full */ }
  for (const fn of listeners) fn(state);
}

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const items = () => state.items;
export const stats = () => state.stats;
export const find = (uid) => state.items.find(i => i.uid === uid) || null;
export const slotOf = (item) => { const d = SKINS[item.defId]; return d.knife ? 'knife' : d.weapon; };
export const isEquipped = (item) => state.equipped[slotOf(item)] === item.uid;
export const equippedFor = (slot) => find(state.equipped[slot]);
export function equippedAll() {
  const out = {};
  for (const [slot, id] of Object.entries(state.equipped)) { const it = find(id); if (it) out[slot] = it; }
  return out;
}

export function toggleEquip(item) {
  const slot = slotOf(item);
  if (state.equipped[slot] === item.uid) delete state.equipped[slot]; else state.equipped[slot] = item.uid;
  save();
}
export function remove(item) {
  state.items = state.items.filter(i => i.uid !== item.uid);
  for (const [k, v] of Object.entries(state.equipped)) if (v === item.uid) delete state.equipped[k];
  save();
}
export function clearAll() { state = fresh(); save(); }

// ---------------------------------------------------------------- cases
// Each colour case is locked to one rarity of the original game, so the
// colour tells you exactly what you'll get. The pools are every finish of
// that rarity in Vantage (all weapons), and the Gold Case is every knife and
// every knife finish. Float, pattern and tally roll exactly like Vantage.
export const COLOR_CASES = [
  { id: 'blue', name: 'Blue Case', rarity: 'standard', blurb: 'Guaranteed Standard (blue) finish' },
  { id: 'purple', name: 'Purple Case', rarity: 'superior', blurb: 'Guaranteed Superior (purple) finish' },
  { id: 'pink', name: 'Pink Case', rarity: 'exotic', blurb: 'Guaranteed Exotic (pink) finish' },
  { id: 'red', name: 'Red Case', rarity: 'mythic', blurb: 'Guaranteed Mythic (red) finish' },
  { id: 'gold', name: 'Gold Case', rarity: 'legendary', blurb: 'Guaranteed ★ knife: random knife, random finish' },
].map(c => ({ ...c, color: RARITIES.find(r => r.id === c.rarity).color }));
export const CASE = Object.fromEntries(COLOR_CASES.map(c => [c.id, c]));

const poolCache = {};
export function casePool(caseId) {
  const r = CASE[caseId].rarity;
  return (poolCache[caseId] ||= Object.values(SKINS).filter(s => s.rarity === r));
}

// A random item from the case (not added to the inventory: used for the reel too).
export function rollCase(caseId, r = Math.random) {
  const pool = casePool(caseId);
  if (caseId === 'gold') {
    // knife type first, then the finish, so every knife is equally likely
    // whatever number of finishes it has
    const types = [...new Set(pool.map(s => s.knife))];
    const type = types[Math.floor(r() * types.length)];
    const fins = pool.filter(s => s.knife === type);
    return makeSkin(fins[Math.floor(r() * fins.length)].id, r);
  }
  return makeSkin(pool[Math.floor(r() * pool.length)].id, r);
}

export function openCase(caseId) {
  const item = rollCase(caseId);
  state.items.push(item);
  state.stats.opened++;
  state.stats.byCase[caseId] = (state.stats.byCase[caseId] || 0) + 1;
  save();
  return item;
}
