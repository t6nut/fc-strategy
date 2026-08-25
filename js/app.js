import { ROSTER, DEFAULT_STATUS } from './players.js';
import { FORMATIONS, autoLineup } from './formations.js';
import { pitchSvg, toFrac, fromFrac, VIEW, L, W } from './pitch.js';
import * as store from './store.js';
import { COLORS, encodeState, decodeState } from './share.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = (v) => Math.round(v * 10) / 10;

// FORMATIONS still carries 11v11 and 5v5; only these are offered in the picker.
const SIZES = ['8', '9', '7'];

const defaultState = () => ({
  v: 1,
  orient: 'auto',
  label: 'nr',
  size: '8',
  form: '4-1-2',
  color: COLORS[0],
  out: { ...DEFAULT_STATUS },
  tokens: [],
  draws: [],
});

// Availability, cycled from the squad sheet: fit to play, injured, or not
// around this week. Kept on the board rather than in the roster file so it can
// change week to week, and so a shared board carries who is missing.
const STATUS_CYCLE = [null, 'injured', 'out'];
const STATUS_MARK = { injured: '✚', out: '✕' };
const STATUS_NAME = { injured: 'Injured', out: 'Not playing' };

const statusOf = (nr) => state.out?.[nr] ?? null;
const availableRoster = () => ROSTER.filter((p) => !statusOf(p.nr));

const board = $('#board');
const drawsSvg = $('#draws');
const tokenLayer = $('#tokens');

let state = defaultState();
let past = [];
let tool = 'move';
let orient = 'h';
let live = null;      // drawing in progress
let passHints = null; // pass options shown while the ball carrier is dragged
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

// --- the ball ------------------------------------------------------------
// Distances here are in metres rather than normalised units: the pitch is
// 105 x 68, so a normalised step sideways is not the same length as one up the
// pitch, and "is anyone standing in the way" has to be judged on the ground.
const BALL_OFF_X = 3.4;   // where the ball sits relative to whoever has it
const BALL_OFF_Y = 2.4;
const BALL_REACH = 7;     // drop the ball this close and a player takes it
const PASS_LANE = 3;      // an opponent this near the line blocks the pass

const metres = (a, b) => Math.hypot((a.x - b.x) * L, (a.y - b.y) * W);
const ballToken = () => state.tokens.find((t) => t.team === 'ball');
const isPlayer = (t) => t.team === 'home' || t.team === 'away';

const ballSpotFor = (t) => ({
  x: t.x + (t.team === 'away' ? -BALL_OFF_X : BALL_OFF_X) / L,
  y: t.y + BALL_OFF_Y / W,
});

/** Keep the ball glued to its owner, and let go if that owner has left. */
function parkBall() {
  const ball = ballToken();
  if (!ball?.on) return;
  const owner = state.tokens.find((t) => t.id === ball.on);
  if (!owner) { ball.on = null; return; }
  Object.assign(ball, ballSpotFor(owner));
}

/** After the ball is dropped, hand it to whoever is standing close enough. */
function claimBall() {
  const ball = ballToken();
  if (!ball) return;
  let best = null;
  let bestDist = BALL_REACH;
  for (const t of state.tokens) {
    if (!isPlayer(t)) continue;
    const d = metres(t, ball);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  ball.on = best?.id ?? null;
  parkBall();
}

/**
 * Who, if anyone, is standing within PASS_LANE of the line between two
 * players. An opponent there intercepts; one of your own gets in the way just
 * as effectively, which is worth seeing rather than hiding, so the two are
 * reported apart. An opponent wins - that lane is shut either way.
 */
function laneBlocker(from, to) {
  const ax = from.x * L;
  const ay = from.y * W;
  const dx = to.x * L - ax;
  const dy = to.y * W - ay;
  const len2 = dx * dx + dy * dy || 1;
  let ownInTheWay = false;
  for (const o of state.tokens) {
    if (!isPlayer(o) || o.id === from.id || o.id === to.id) continue;
    const ox = o.x * L;
    const oy = o.y * W;
    const along = ((ox - ax) * dx + (oy - ay) * dy) / len2;
    // Someone level with either player is a marker, not an interception.
    if (along <= 0.05 || along >= 0.95) continue;
    if (Math.hypot(ox - (ax + along * dx), oy - (ay + along * dy)) >= PASS_LANE) continue;
    if (o.team !== from.team) return 'opponent';
    ownInTheWay = true;
  }
  return ownInTheWay ? 'own' : null;
}

/** Nearest team-mate the ball can actually reach, and the pass drawn to them. */
function passFrom(owner) {
  const target = state.tokens
    .filter((t) => t.team === owner.team && t.id !== owner.id)
    .sort((a, b) => metres(owner, a) - metres(owner, b))
    .find((t) => !laneBlocker(owner, t));

  if (!target) { toast('Nobody free - every lane is blocked'); return; }

  const before = snapshot();
  const ball = ballToken();
  const from = { x: ball.x, y: ball.y };
  ball.on = target.id;
  state.draws.push({
    type: 'pass',
    color: state.color,
    pts: [[owner.x, owner.y], [target.x, target.y]],
  });
  renderTokens();
  renderDraws();
  flyBall(from);
  commit(before);
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Fly the ball from where it was to where it has just been put. State and
 * layout are already final by the time this runs - the animation only offsets
 * the ball backwards to its old spot and lets it travel into place, so an
 * interrupted flight can never leave it somewhere it does not belong.
 *
 * Reduced motion shortens the flight rather than removing it. Where the ball
 * went is the substance of the interaction, not decoration: teleporting it
 * loses the one thing the movement is there to say.
 */
function flyBall(from) {
  const ball = ballToken();
  const node = ball && tokenLayer.querySelector(`[data-id="${ball.id}"]`);
  if (!node?.animate) return;

  const start = toFrac(from.x, from.y, orient);
  const end = toFrac(ball.x, ball.y, orient);
  const dx = (start.fx - end.fx) * board.clientWidth;
  const dy = (start.fy - end.fy) * board.clientHeight;
  if (Math.hypot(dx, dy) < 3) return;

  const at = (k, scale) =>
    `translate(-50%, -50%) translate(${r2(dx * k)}px, ${r2(dy * k)}px) scale(${scale})`;
  const travel = Math.hypot((from.x - ball.x) * L, (from.y - ball.y) * W);
  const calm = reducedMotion.matches;

  // Struck, not slid: three quarters of the ground goes in the first 40% of
  // the flight, then it settles into the receiver.
  const flight = node.animate(
    calm
      ? [{ transform: at(1, 1) }, { transform: at(0, 1) }]
      : [
        { transform: at(1, 1) },
        { transform: at(0.25, 1.28), offset: 0.4 },
        { transform: at(0, 1) },
      ],
    {
      duration: calm ? 140 : Math.min(460, 110 + travel * 6.5),
      easing: 'linear',
    },
  );

  // A ball in flight passes straight over other players; letting it swallow
  // taps on the way would mean grabbing the ball when you meant the player.
  node.style.pointerEvents = 'none';
  const land = () => { node.style.pointerEvents = ''; };
  flight.finished.then(land, land);
}

// Opacity follows the real distance in metres rather than the ranking, so a
// line genuinely brightens as you carry the ball towards someone and dies away
// as the gap opens. Ranking against the other lanes would rescale every line
// whenever any one of them moved, which reads as flicker rather than distance.
const FADE_NEAR = 8;         // metres, and closer: full strength
const FADE_FAR = 45;         // metres, and further: as faint as it gets
const FADE_FLOOR = 0.22;
const BLOCKED_FLOOR = 0.4;   // black lines need more to stay legible on grass

function fadeFor(dist, floor) {
  const t = (dist - FADE_NEAR) / (FADE_FAR - FADE_NEAR);
  return Math.min(1, Math.max(floor, 1 - t * (1 - floor)));
}

/**
 * Every lane out of the carrier worth drawing, nearest first. Ones shut by a
 * team-mate come back marked, to be drawn black; ones an opponent covers are
 * left out entirely. Shown live while dragging, so the shape opens and closes
 * as a player moves.
 */
function passOptions(owner) {
  const lanes = [];
  for (const t of state.tokens) {
    if (t.team !== owner.team || t.id === owner.id) continue;
    const blocker = laneBlocker(owner, t);
    if (blocker === 'opponent') continue;
    lanes.push({
      from: [owner.x, owner.y], to: [t.x, t.y],
      dist: metres(owner, t), own: blocker === 'own',
    });
  }
  lanes.sort((a, b) => a.dist - b.dist);

  const nearestOpen = lanes.find((l) => !l.own);
  for (const lane of lanes) {
    lane.best = lane === nearestOpen;
    lane.fade = lane.own ? fadeFor(lane.dist, BLOCKED_FLOOR)
      : lane.best ? 1 : fadeFor(lane.dist, FADE_FLOOR);
  }

  // Returned in paint order rather than distance order: shut lanes go down
  // first, then open ones furthest to nearest, so the pass you would actually
  // play ends up on top of everything instead of under a black line.
  return [
    ...lanes.filter((l) => l.own).reverse(),
    ...lanes.filter((l) => !l.own).reverse(),
  ];
}

let hintFrame = 0;

/** Recompute the options at most once a frame - onMove fires far faster. */
function scheduleHints(owner) {
  if (hintFrame) return;
  hintFrame = requestAnimationFrame(() => {
    hintFrame = 0;
    passHints = passOptions(owner);
    renderDraws();
  });
}

function clearHints() {
  cancelAnimationFrame(hintFrame);
  hintFrame = 0;
  if (!passHints) return;
  passHints = null;
  renderDraws();
}

let lastTap = { id: null, at: 0 };

/** Double tap a player: pass if they have the ball, take it if they don't. */
function onTokenTap(t) {
  const now = Date.now();
  const isDouble = lastTap.id === t.id && now - lastTap.at < 350;
  lastTap = { id: t.id, at: isDouble ? 0 : now };
  if (!isDouble || !isPlayer(t)) return;

  const ball = ballToken();
  if (!ball) { toast('No ball on the pitch yet'); return; }
  if (ball.on === t.id) { passFrom(t); return; }

  const before = snapshot();
  const from = { x: ball.x, y: ball.y };
  ball.on = t.id;
  renderTokens();
  flyBall(from);
  commit(before);
}

function renderTokens() {
  parkBall();
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
    const carrying = ballToken()?.on === t.id;
    // Someone ruled out can still be sitting in a lineup drawn up before they
    // were, so say so on the pitch rather than only in the squad sheet.
    const unfit = t.team === 'home' && statusOf(t.nr);
    node.className = `tok ${t.team}${named ? ' name-mode' : ''}`
      + `${carrying ? ' has-ball' : ''}${unfit ? ' unfit' : ''}`;
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

/** Pull a line's end back so its head lands outside the token it points at. */
function trimEnd(pts, by) {
  const [a, b] = pts;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len <= by) return pts;
  const k = (len - by) / len;
  return [a, [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]];
}

function hintMarkup(hint) {
  const radius = (parseFloat(getComputedStyle(board).getPropertyValue('--tok')) || 32) / 2;
  const pts = trimEnd(toPx([hint.from, hint.to]), radius + 2);
  const base = Math.max(2.5, Math.min(board.clientWidth, board.clientHeight) * 0.009);
  // Shut lanes are drawn under the open ones, but a faint open lane crossing a
  // black one still blends dark, so keep the black ones thinner as well.
  const weight = hint.best ? base : base * (hint.own ? 0.55 : 0.7);
  const stroke = hint.own ? '#000000' : state.color;
  const opacity = Math.round(hint.fade * 100) / 100;
  const path = `M ${r2(pts[0][0])},${r2(pts[0][1])} L ${r2(pts[1][0])},${r2(pts[1][1])}`;
  return `<g opacity="${opacity}">
    <path d="${path}" fill="none" stroke="${stroke}" stroke-width="${r2(weight)}"
      stroke-linecap="round" stroke-dasharray="${r2(weight * 3)} ${r2(weight * 2.4)}"/>
    ${hint.best ? arrowHead(pts, stroke, weight) : ''}
  </g>`;
}

function renderDraws() {
  drawsSvg.innerHTML = state.draws.map(shapeMarkup).join('')
    + (live ? shapeMarkup(live) : '')
    + (passHints ?? []).map(hintMarkup).join('');
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
    node.getAnimations?.().forEach((a) => a.cancel());

    const before = snapshot();
    // Picking the ball up breaks possession; dropping it decides who has it.
    if (t.team === 'ball') t.on = null;
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
      const ball = ballToken();
      if (ball?.on === t.id) {
        Object.assign(ball, ballSpotFor(t));
        const ballNode = tokenLayer.querySelector(`[data-id="${ball.id}"]`);
        if (ballNode) place(ballNode, ball.x, ball.y);
        scheduleHints(t);
      }
      moved = true;
      trash.classList.toggle('hot', overTrash(ev));
    };

    const onUp = (ev) => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      node.classList.remove('dragging');
      trash.classList.remove('show', 'hot');
      clearHints();
      if (moved && overTrash(ev)) {
        // Taking a player off should not drag the ball to the bin with them:
        // leave it where it was when the drag started.
        const ball = ballToken();
        if (ball?.on === t.id) {
          const was = JSON.parse(before).tokens.find((x) => x.id === ball.id);
          if (was) { ball.x = was.x; ball.y = was.y; }
          ball.on = null;
        }
        state.tokens = state.tokens.filter((x) => x.id !== t.id);
        renderTokens();
        renderRoster();
        commit(before);
      } else if (moved) {
        if (t.team === 'ball') { claimBall(); renderTokens(); }
        commit(before);
      } else {
        onTokenTap(t);
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
    const status = statusOf(p.nr);
    const label = status ? STATUS_NAME[status] : 'Fit';
    return `<div class="pcard${on ? ' on' : ''}${status ? ` ${status}` : ''}">
      <button class="pick" data-nr="${p.nr}">
        <span class="num">${p.nr}</span>
        <span class="who">
          <span class="nm">${esc(p.shirt)}</span>
          <span class="ps">${esc(p.pos.join(' / '))}</span>
        </span>
      </button>
      <button class="pstatus" data-status="${p.nr}" title="${label} - tap to change"
        aria-label="${esc(p.shirt)}: ${label}">${STATUS_MARK[status] ?? '✓'}</button>
    </div>`;
  }).join('');
}

/** Fit -> injured -> not playing -> fit. Anyone ruled out also leaves the pitch. */
function cycleStatus(nr) {
  const before = snapshot();
  const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(statusOf(nr)) + 1) % STATUS_CYCLE.length];
  state.out = { ...state.out };
  if (next) state.out[nr] = next;
  else delete state.out[nr];
  if (next) state.tokens = state.tokens.filter((t) => !(t.team === 'home' && t.nr === nr));
  renderTokens();
  renderRoster();
  commit(before);
}

const currentSlots = () => FORMATIONS[state.size]?.[state.form];

function layoutHome() {
  const slots = currentSlots();
  if (!slots) return;
  state.tokens = state.tokens.filter((t) => t.team !== 'home');
  for (const pick of autoLineup(slots, availableRoster())) {
    state.tokens.push({
      id: nextId(), team: 'home', nr: pick.player.nr, txt: pick.player.shirt, x: pick.x, y: pick.y,
    });
  }
}

function layoutAway() {
  const slots = currentSlots();
  if (!slots) return;
  state.tokens = state.tokens.filter((t) => t.team !== 'away');
  // Mirror our shape through the centre spot so it reads as a team facing us.
  slots.forEach(([, x, y], i) => {
    state.tokens.push({ id: nextId(), team: 'away', nr: i + 1, x: 1 - x, y: 1 - y });
  });
}

function applyFormation() {
  const before = snapshot();
  layoutHome();
  renderTokens();
  renderRoster();
  commit(before);
}

function addOpponents() {
  const before = snapshot();
  layoutAway();
  renderTokens();
  commit(before);
}

/**
 * Redraw the pitch in the newly picked shape, so changing the size or the
 * formation takes effect without a trip to the Line up button. Opponents only
 * move when the team size changed, since that changes how many of them there
 * should be - a formation change leaves a hand-placed red team alone.
 */
function reshape({ opponents }) {
  const before = snapshot();
  layoutHome();
  if (opponents && state.tokens.some((t) => t.team === 'away')) layoutAway();
  renderTokens();
  renderRoster();
  commit(before);
}

function clearOurTeam() {
  const before = snapshot();
  state.tokens = state.tokens.filter((t) => t.team !== 'home');
  renderTokens();
  renderRoster();
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
  const mark = e.target.closest('[data-status]');
  if (mark) { cycleStatus(Number(mark.dataset.status)); return; }
  const pick = e.target.closest('[data-nr]');
  if (pick) togglePlayer(Number(pick.dataset.nr));
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

const SIZE_OPTIONS = SIZES.map((s) => `<option value="${s}">${s}v${s}</option>`).join('');
$$('[data-role="size"]').forEach((sel) => {
  sel.innerHTML = SIZE_OPTIONS;
  sel.addEventListener('change', (e) => {
    state.size = e.target.value;
    state.form = Object.keys(FORMATIONS[state.size])[0];
    syncControls();
    reshape({ opponents: true });
  });
});
$$('[data-role="form"]').forEach((sel) => {
  sel.addEventListener('change', (e) => {
    state.form = e.target.value;
    syncControls();
    reshape({ opponents: false });
  });
});

$('#applyForm').addEventListener('click', applyFormation);
$('#teamAdd').addEventListener('click', applyFormation);
$('#teamNone').addEventListener('click', clearOurTeam);
$('#addOpp').addEventListener('click', addOneOpponent);
$('#oppTeam').addEventListener('click', addOpponents);
$('#oppOne').addEventListener('click', addOneOpponent);
$('#oppNone').addEventListener('click', clearOpponents);
$('#addBall').addEventListener('click', toggleBall);
$('#undoBtn').addEventListener('click', undo);
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
});

function clearDrawings() {
  const before = snapshot();
  state.draws = [];
  renderDraws();
  commit(before);
}

function emptyPitch() {
  const before = snapshot();
  state.tokens = [];
  state.draws = [];
  renderTokens();
  renderDraws();
  renderRoster();
  commit(before);
}

async function shareBoard() {
  const url = `${location.origin}${location.pathname}#s=${encodeState(state)}`;
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
}

// These four sit in the top bar on a wide screen and in the menu on a phone,
// so they are wired by intent rather than by id.
const ACTIONS = {
  share: shareBoard,
  clearDraws: clearDrawings,
  clearAway: clearOpponents,
  reset: emptyPitch,
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (btn) ACTIONS[btn.dataset.act]?.();
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
  const forms = Object.keys(FORMATIONS[state.size] ?? FORMATIONS['8']);
  if (!forms.includes(state.form)) state.form = forms[0];
  const options = forms.map((f) => `<option value="${f}">${f}</option>`).join('');
  $$('[data-role="size"]').forEach((sel) => { sel.value = state.size; });
  $$('[data-role="form"]').forEach((sel) => {
    sel.innerHTML = options;
    sel.value = state.form;
  });
}

function adopt(loaded) {
  state = { ...defaultState(), ...loaded };
  if (!SIZES.includes(state.size)) {
    state.size = defaultState().size;
    state.form = defaultState().form;
  }
  state.tokens = (state.tokens ?? []).map((t) => ({ ...t, id: t.id || nextId() }));
  seq = state.tokens.reduce((m, t) => Math.max(m, Number(String(t.id).slice(1)) || 0), 0) + 1;
  syncControls();
  layout();
  renderRoster();
  store.saveBoard(state);
}

function init() {
  const shared = decodeState(location.hash);
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
    // When a new worker takes over an already-controlled page, the code on
    // screen is the old one - reload once so a deploy actually shows up.
    const controlled = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!controlled || reloading) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js')
      .then((reg) => reg.update())
      .catch(() => {});
  }
}

init();
