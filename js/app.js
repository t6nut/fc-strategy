import { ROSTER } from './players.js';
import { FORMATIONS, autoLineup } from './formations.js';
import { pitchSvg, toFrac, fromFrac, VIEW } from './pitch.js';
import * as store from './store.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = (v) => Math.round(v * 10) / 10;

const COLORS = ['#ffd23f', '#ffffff', '#ef4444', '#4fc3f7'];
const SIZES = ['11', '9', '8', '7', '5'];

const defaultState = () => ({
  v: 1,
  orient: 'auto',
  label: 'nr',
  size: '11',
  form: '4-4-2',
  color: COLORS[0],
  tokens: [],
  draws: [],
});

const board = $('#board');
const drawsSvg = $('#draws');
const tokenLayer = $('#tokens');

let state = defaultState();
let past = [];
let tool = 'move';
let orient = 'h';
let live = null;      // drawing in progress
let seq = 1;

const nextId = () => `t${seq++}`;
const snapshot = () => JSON.stringify(state);

function commit(before) {
  if (before) past.push(before);
  if (past.length > 60) past.shift();
  $('#undoBtn').disabled = past.length === 0;
  store.saveBoard(state);
}

function undo() {
  const prev = past.pop();
  if (!prev) return;
  state = JSON.parse(prev);
  syncControls();
  layout();
  renderRoster();
  $('#undoBtn').disabled = past.length === 0;
  store.saveBoard(state);
}

// ---------------------------------------------------------------- layout

const resolveOrient = () =>
  state.orient === 'auto' ? (innerHeight > innerWidth * 1.05 ? 'v' : 'h') : state.orient;

function layout() {
  orient = resolveOrient();
  $('#pitchLayer').innerHTML = pitchSvg(orient);
  sizeBoard();
  renderTokens();
  renderDraws();
}

function sizeBoard() {
  const vb = VIEW[orient];
  const stage = $('#stage').getBoundingClientRect();
  const scale = Math.min(stage.width / vb.w, stage.height / vb.h);
  const w = Math.max(120, Math.floor(vb.w * scale));
  const h = Math.max(120, Math.floor(vb.h * scale));
  board.style.width = `${w}px`;
  board.style.height = `${h}px`;
  const tok = Math.round(Math.min(w, h) * 0.088);
  board.style.setProperty('--tok', `${Math.max(20, Math.min(46, tok))}px`);
  drawsSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  drawsSvg.setAttribute('width', w);
  drawsSvg.setAttribute('height', h);
}

// ---------------------------------------------------------------- tokens

const place = (node, x, y) => {
  const { fx, fy } = toFrac(x, y, orient);
  node.style.left = `${fx * 100}%`;
  node.style.top = `${fy * 100}%`;
};

function tokenFace(t) {
  if (t.team === 'ball') return '';
  if (t.team === 'away') return String(t.nr ?? '');
  return state.label === 'name' ? esc(short(t.txt)) : String(t.nr ?? '');
}

const short = (name) => (name && name.length > 9 ? `${name.slice(0, 8)}.` : name || '');

function renderTokens() {
  const seen = new Set();
  for (const t of state.tokens) {
    seen.add(t.id);
    let node = tokenLayer.querySelector(`[data-id="${t.id}"]`);
    if (!node) {
      node = document.createElement('div');
      node.dataset.id = t.id;
      tokenLayer.appendChild(node);
      attachDrag(node);
    }
    const named = state.label === 'name' && t.team === 'home';
    node.className = `tok ${t.team}${named ? ' name-mode' : ''}`;
    const caption = t.team === 'home' && !named && t.txt
      ? `<span class="tok-label">${esc(short(t.txt))}</span>` : '';
    node.innerHTML = `${tokenFace(t)}${caption}`;
    place(node, t.x, t.y);
  }
  for (const node of [...tokenLayer.children]) {
    if (!seen.has(node.dataset.id)) node.remove();
  }
}

// ---------------------------------------------------------------- drawings

function toPx(pts) {
  const w = board.clientWidth;
  const h = board.clientHeight;
  return pts.map(([x, y]) => {
    const f = toFrac(x, y, orient);
    return [f.fx * w, f.fy * h];
  });
}

function arrowHead(pts, color, weight) {
  const end = pts[pts.length - 1];
  let prev = null;
  for (let i = pts.length - 2; i >= 0; i--) {
    if (Math.hypot(end[0] - pts[i][0], end[1] - pts[i][1]) > 6) { prev = pts[i]; break; }
  }
  if (!prev) return '';
  const a = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const len = weight * 3.4;
  const wing = (off) => [end[0] - Math.cos(a + off) * len, end[1] - Math.sin(a + off) * len];
  const [lx, ly] = wing(-0.45);
  const [rx, ry] = wing(0.45);
  return `<path d="M ${r2(end[0])},${r2(end[1])} L ${r2(lx)},${r2(ly)} L ${r2(rx)},${r2(ry)} Z" fill="${color}"/>`;
}

function shapeMarkup(d) {
  const pts = toPx(d.pts);
  if (pts.length < 2) return '';
  const weight = Math.max(2.5, Math.min(board.clientWidth, board.clientHeight) * 0.009);
  const dash = d.type === 'pass' ? ` stroke-dasharray="${r2(weight * 3)} ${r2(weight * 2.4)}"` : '';
  const path = `M ${pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join(' L ')}`;
  return `<path d="${path}" fill="none" stroke="${d.color}" stroke-width="${r2(weight)}"
    stroke-linecap="round" stroke-linejoin="round"${dash}/>${arrowHead(pts, d.color, weight)}`;
}

function renderDraws() {
  drawsSvg.innerHTML = state.draws.map(shapeMarkup).join('') + (live ? shapeMarkup(live) : '');
}

function distToShape(d, px, py) {
  const pts = toPx(d.pts);
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

// ---------------------------------------------------------------- dragging

const trash = $('#trash');
const overTrash = (ev) => {
  const t = trash.getBoundingClientRect();
  return ev.clientX >= t.left - 24 && ev.clientX <= t.right + 24
      && ev.clientY >= t.top - 24 && ev.clientY <= t.bottom + 24;
};

function attachDrag(node) {
  node.addEventListener('pointerdown', (e) => {
    if (tool !== 'move') return;   // let the board underneath start a drawing
    const t = state.tokens.find((x) => x.id === node.dataset.id);
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();

    const before = snapshot();
    const rect = board.getBoundingClientRect();
    const start = toFrac(t.x, t.y, orient);
    const grabX = e.clientX - (rect.left + start.fx * rect.width);
    const grabY = e.clientY - (rect.top + start.fy * rect.height);
    let moved = false;

    node.setPointerCapture(e.pointerId);
    node.classList.add('dragging');
    trash.classList.add('show');

    const onMove = (ev) => {
      const p = fromFrac(
        (ev.clientX - grabX - rect.left) / rect.width,
        (ev.clientY - grabY - rect.top) / rect.height,
        orient,
      );
      t.x = p.x;
      t.y = p.y;
      place(node, t.x, t.y);
      moved = true;
      trash.classList.toggle('hot', overTrash(ev));
    };

    const onUp = (ev) => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      node.classList.remove('dragging');
      trash.classList.remove('show', 'hot');
      if (moved && overTrash(ev)) {
        state.tokens = state.tokens.filter((x) => x.id !== t.id);
        renderTokens();
        renderRoster();
        commit(before);
      } else if (moved) {
        commit(before);
      }
    };

    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
  });
}

// ---------------------------------------------------------------- drawing

board.addEventListener('pointerdown', (e) => {
  if (tool === 'move') return;
  e.preventDefault();
  const rect = board.getBoundingClientRect();
  const at = (ev) => fromFrac((ev.clientX - rect.left) / rect.width,
                              (ev.clientY - rect.top) / rect.height, orient);

  if (tool === 'erase') {
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let hit = -1;
    let best = 18;
    state.draws.forEach((d, i) => {
      const dist = distToShape(d, px, py);
      if (dist < best) { best = dist; hit = i; }
    });
    if (hit >= 0) {
      const before = snapshot();
      state.draws.splice(hit, 1);
      renderDraws();
      commit(before);
    }
    return;
  }

  const before = snapshot();
  const p = at(e);
  live = { type: tool, color: state.color, pts: [[p.x, p.y], [p.x, p.y]] };
  board.setPointerCapture(e.pointerId);

  const onMove = (ev) => {
    const q = at(ev);
    if (tool === 'free') {
      const last = live.pts[live.pts.length - 1];
      const [lx, ly] = toPx([last])[0];
      const [qx, qy] = toPx([[q.x, q.y]])[0];
      if (Math.hypot(qx - lx, qy - ly) > 4) live.pts.push([q.x, q.y]);
      else live.pts[live.pts.length - 1] = [q.x, q.y];
    } else {
      live.pts[1] = [q.x, q.y];
    }
    renderDraws();
  };

  const onUp = () => {
    board.removeEventListener('pointermove', onMove);
    board.removeEventListener('pointerup', onUp);
    board.removeEventListener('pointercancel', onUp);
    const pts = toPx(live.pts);
    const long = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]) > 10;
    if (long) {
      state.draws.push(live);
      live = null;
      renderDraws();
      commit(before);
    } else {
      live = null;
      renderDraws();
    }
  };

  board.addEventListener('pointermove', onMove);
  board.addEventListener('pointerup', onUp);
  board.addEventListener('pointercancel', onUp);
});

// ---------------------------------------------------------------- squad

const FAMILY_X = { GK: 0.06, LB: 0.22, RB: 0.22, CB: 0.2, LCB: 0.2, RCB: 0.2, LWB: 0.3, RWB: 0.3,
  CDM: 0.38, CM: 0.45, CAM: 0.55, LM: 0.46, RM: 0.46, LW: 0.68, RW: 0.68, ST: 0.7, LS: 0.68, RS: 0.68 };
const SPREAD = [0.5, 0.28, 0.72, 0.14, 0.86, 0.38, 0.62, 0.06, 0.94];

function freeSpot(player) {
  const x = FAMILY_X[player.pos[0]] ?? 0.45;
  const taken = (yy) => state.tokens.some((t) => Math.abs(t.x - x) < 0.06 && Math.abs(t.y - yy) < 0.06);
  const y = SPREAD.find((yy) => !taken(yy));
  return { x, y: y ?? 0.1 + Math.random() * 0.8 };
}

function togglePlayer(nr) {
  const before = snapshot();
  const existing = state.tokens.find((t) => t.team === 'home' && t.nr === nr);
  if (existing) {
    state.tokens = state.tokens.filter((t) => t !== existing);
  } else {
    const p = ROSTER.find((x) => x.nr === nr);
    const spot = freeSpot(p);
    state.tokens.push({ id: nextId(), team: 'home', nr: p.nr, txt: p.shirt, x: spot.x, y: spot.y });
  }
  renderTokens();
  renderRoster();
  commit(before);
}

function renderRoster() {
  $('#roster').innerHTML = ROSTER.map((p) => {
    const on = state.tokens.some((t) => t.team === 'home' && t.nr === p.nr);
    return `<button class="pcard${on ? ' on' : ''}" data-nr="${p.nr}">
      <span class="num">${p.nr}</span>
      <span class="who">
        <span class="nm">${esc(p.shirt)}</span>
        <span class="ps">${esc(p.pos.join(' / '))}</span>
      </span>
    </button>`;
  }).join('');
}

function applyFormation() {
  const slots = FORMATIONS[state.size]?.[state.form];
  if (!slots) return;
  const before = snapshot();
  state.tokens = state.tokens.filter((t) => t.team !== 'home');
  for (const pick of autoLineup(slots, ROSTER)) {
    state.tokens.push({
      id: nextId(), team: 'home', nr: pick.player.nr, txt: pick.player.shirt, x: pick.x, y: pick.y,
    });
  }
  renderTokens();
  renderRoster();
  commit(before);
}

function addOpponents() {
  const slots = FORMATIONS[state.size]?.[state.form];
  if (!slots) return;
  const before = snapshot();
  state.tokens = state.tokens.filter((t) => t.team !== 'away');
  // Mirror our shape through the centre spot so it reads as a team facing us.
  slots.forEach(([, x, y], i) => {
    state.tokens.push({ id: nextId(), team: 'away', nr: i + 1, x: 1 - x, y: 1 - y });
  });
  renderTokens();
  commit(before);
}

function addOneOpponent() {
  const before = snapshot();
  const reds = state.tokens.filter((t) => t.team === 'away');
  const x = 0.78;
  const taken = (yy) => reds.some((t) => Math.abs(t.x - x) < 0.06 && Math.abs(t.y - yy) < 0.06);
  const y = SPREAD.find((yy) => !taken(yy)) ?? 0.1 + Math.random() * 0.8;
  state.tokens.push({ id: nextId(), team: 'away', nr: reds.length + 1, x, y });
  renderTokens();
  commit(before);
}

function clearOpponents() {
  const before = snapshot();
  state.tokens = state.tokens.filter((t) => t.team !== 'away');
  renderTokens();
  commit(before);
}

function toggleBall() {
  const before = snapshot();
  const ball = state.tokens.find((t) => t.team === 'ball');
  if (ball) state.tokens = state.tokens.filter((t) => t !== ball);
  else state.tokens.push({ id: nextId(), team: 'ball', x: 0.5, y: 0.5 });
  renderTokens();
  commit(before);
}

// ---------------------------------------------------------------- sheets & chrome

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function openSheet(id) {
  $$('.sheet').forEach((s) => { s.hidden = s.id !== id; });
  $('#scrim').hidden = false;
}

function closeSheets() {
  $$('.sheet').forEach((s) => { s.hidden = true; });
  $('#scrim').hidden = true;
}

$('#scrim').addEventListener('click', closeSheets);
$$('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
$('#benchBtn').addEventListener('click', () => { renderRoster(); openSheet('sheet'); });
$('#menuBtn').addEventListener('click', () => { renderPlays(); openSheet('menu'); });

$('#roster').addEventListener('click', (e) => {
  const card = e.target.closest('.pcard');
  if (card) togglePlayer(Number(card.dataset.nr));
});

$('#tools').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  tool = btn.dataset.tool;
  $$('#tools button').forEach((b) => b.classList.toggle('on', b === btn));
});

$('#colors').innerHTML = COLORS
  .map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`)
  .join('');
$('#colors').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  state.color = btn.dataset.color;
  $$('#colors button').forEach((b) => b.classList.toggle('on', b === btn));
  store.saveBoard(state);
});

$('#labelSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  state.label = btn.dataset.label;
  syncControls();
  renderTokens();
  store.saveBoard(state);
});

$('#orientSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  state.orient = btn.dataset.orient;
  syncControls();
  layout();
  store.saveBoard(state);
});

$('#sizeSel').innerHTML = SIZES.map((s) => `<option value="${s}">${s}v${s}</option>`).join('');
$('#sizeSel').addEventListener('change', (e) => {
  state.size = e.target.value;
  state.form = Object.keys(FORMATIONS[state.size])[0];
  syncControls();
  store.saveBoard(state);
});
$('#formSel').addEventListener('change', (e) => {
  state.form = e.target.value;
  store.saveBoard(state);
});

$('#applyForm').addEventListener('click', applyFormation);
$('#addOpp').addEventListener('click', addOneOpponent);
$('#oppTeam').addEventListener('click', addOpponents);
$('#oppOne').addEventListener('click', addOneOpponent);
$('#oppNone').addEventListener('click', clearOpponents);
$('#addBall').addEventListener('click', toggleBall);
$('#undoBtn').addEventListener('click', undo);
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
});

$('#clearDraws').addEventListener('click', () => {
  const before = snapshot();
  state.draws = [];
  renderDraws();
  commit(before);
});

$('#clearAway').addEventListener('click', clearOpponents);

$('#resetBtn').addEventListener('click', () => {
  const before = snapshot();
  state.tokens = [];
  state.draws = [];
  renderTokens();
  renderDraws();
  renderRoster();
  commit(before);
});

$('#shareBtn').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#s=${store.encodeState(state)}`;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: 'FC Strategy Board', url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast('Link copied - anyone who opens it sees this board');
  } catch {
    prompt('Copy this link:', url);
  }
});

// ---------------------------------------------------------------- saved plays

function renderPlays() {
  const plays = store.loadPlays();
  $('#plays').innerHTML = plays.length
    ? plays.map((p) => `<div class="play">
        <button data-load="${esc(p.name)}">${esc(p.name)}</button>
        <button class="del" data-del="${esc(p.name)}" aria-label="Delete">✕</button>
      </div>`).join('')
    : '<p class="hint">Nothing saved yet.</p>';
}

$('#savePlay').addEventListener('click', () => {
  const name = $('#playName').value.trim();
  if (!name) { toast('Give the play a name first'); return; }
  store.savePlay(name, JSON.parse(snapshot()));
  $('#playName').value = '';
  renderPlays();
  toast(`Saved "${name}"`);
});

$('#plays').addEventListener('click', (e) => {
  const load = e.target.closest('[data-load]');
  const del = e.target.closest('[data-del]');
  if (load) {
    const play = store.loadPlays().find((p) => p.name === load.dataset.load);
    if (!play) return;
    past.push(snapshot());
    $('#undoBtn').disabled = false;
    adopt(play.state);
    closeSheets();
    toast(`Loaded "${play.name}"`);
  } else if (del) {
    store.deletePlay(del.dataset.del);
    renderPlays();
  }
});

// ---------------------------------------------------------------- wake lock

let wakeLock = null;
$('#wakeBtn').addEventListener('click', async () => {
  const btn = $('#wakeBtn');
  if (wakeLock) {
    await wakeLock.release().catch(() => {});
    wakeLock = null;
    btn.textContent = 'Off';
    btn.classList.remove('primary');
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
      btn.textContent = 'Off';
      btn.classList.remove('primary');
    });
    btn.textContent = 'On';
    btn.classList.add('primary');
  } catch {
    toast('This browser will not keep the screen on');
  }
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && $('#wakeBtn').textContent === 'On' && !wakeLock) {
    wakeLock = await navigator.wakeLock.request('screen').catch(() => null);
  }
});

// ---------------------------------------------------------------- boot

function syncControls() {
  $$('#labelSeg button').forEach((b) => b.classList.toggle('on', b.dataset.label === state.label));
  $$('#orientSeg button').forEach((b) => b.classList.toggle('on', b.dataset.orient === state.orient));
  $$('#colors button').forEach((b) => b.classList.toggle('on', b.dataset.color === state.color));
  $('#sizeSel').value = state.size;
  const forms = Object.keys(FORMATIONS[state.size] ?? FORMATIONS['11']);
  $('#formSel').innerHTML = forms.map((f) => `<option value="${f}">${f}</option>`).join('');
  if (!forms.includes(state.form)) state.form = forms[0];
  $('#formSel').value = state.form;
}

function adopt(loaded) {
  state = { ...defaultState(), ...loaded };
  state.tokens = (state.tokens ?? []).map((t) => ({ ...t, id: t.id || nextId() }));
  seq = state.tokens.reduce((m, t) => Math.max(m, Number(String(t.id).slice(1)) || 0), 0) + 1;
  syncControls();
  layout();
  renderRoster();
  store.saveBoard(state);
}

function init() {
  const shared = store.decodeState(location.hash);
  const saved = store.loadBoard();
  adopt(shared ?? saved ?? defaultState());
  if (shared) {
    history.replaceState(null, '', location.pathname + location.search);
    toast('Opened a shared board');
  }
  $('#undoBtn').disabled = true;

  let raf = 0;
  const relayout = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(layout);
  };
  new ResizeObserver(relayout).observe($('#stage'));
  addEventListener('orientationchange', relayout);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
