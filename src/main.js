// Entry point for Vantage Cases: the case menu, plus the open-field Play mode.
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import { audio } from './audio.js';
import { loadAssets } from './assets.js';
import { App } from './cases/app.js';
import { Sandbox } from './cases/sandbox.js';
import * as S from './cases/store.js';
import { GUN_IDS } from './weapons.js';

const SETTINGS_KEY = 'vantage.settings';
const defaults = { sensitivity: 2.0, volume: 0.6, fov: 74, crosshairColor: '#4dff6a', crosshairSize: 6, crosshairDot: false };
function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { /* storage unavailable */ }
  const out = { ...defaults, ...s, name: 'You' };
  out.save = () => { try { const { save, ...rest } = out; localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest)); } catch { /* ignore */ } };
  return out;
}

const settings = loadSettings();
audio.setVolume(settings.volume);
const root = document.getElementById('menu');
const view = () => document.getElementById('view');
let game = null;

const app = new App(root, play);

function play() {
  audio.init();
  app.hide();
  // a fresh canvas every time, so a lost graphics context can't leave it black
  const old = view();
  const canvas = old.cloneNode(false);
  old.replaceWith(canvas);
  canvas.style.visibility = 'visible';
  const loading = document.createElement('div');
  loading.className = 'match-loading';
  loading.innerHTML = '<b>VANTAGE</b><span>Loading the field…</span>';
  document.body.appendChild(loading);
  const eq = S.equippedAll();
  const skins = {};
  for (const slot of [...GUN_IDS, 'knife']) skins[slot] = eq[slot] || null;
  const back = () => { game = null; window.__game = null; loading.remove(); view().style.visibility = 'hidden'; app.show(); };
  try {
    game = new Sandbox(canvas, { skins }, settings, (result) => {
      back();
      if (result?.crashed) app.toast('The field stopped because of an error');
    });
  } catch (e) {
    console.error(e);
    back();
    app.toast('The field failed to start');
    return;
  }
  window.__game = game;
  game.ready.then(() => loading.remove());
  canvas.requestPointerLock()?.catch?.(() => { /* clicking the game takes the mouse later */ });
}

view().style.visibility = 'hidden';
root.style.display = 'block';
root.innerHTML = '<div class="loading"><b>VANTAGE</b><span>Loading models</span><i><em style="width:0%"></em></i></div>';
await loadAssets((f) => { const e = root.querySelector('.loading em'); if (e) e.style.width = Math.round(f * 100) + '%'; });
app.show();
window.__app = app;
