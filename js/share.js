import { ROSTER } from './players.js';

/**
 * Packs a board into the shortest string that still fits in a URL fragment.
 *
 * base64'd JSON ran to ~1800 characters for a full board, which is unpleasant
 * to paste into a chat. Everything derivable is dropped instead of encoded:
 * token ids are regenerated on open and shirt names are looked up from the
 * squad by number. What is left is written as fixed-width base64url fields, so
 * records need no separators.
 *
 *   1 ~ <orient><label><colour> ~ <size> ~ <formation> ~ <tokens> ~ <drawings>
 *
 * A token is 7 chars: team, number, x, y. A drawing is 4 + 4n: kind, colour,
 * point count, then each point. Coordinates keep 12 bits over -0.1..1.1, which
 * is about 3 cm on a full-size pitch - far finer than anyone can drag.
 */

// The index into this list is part of the wire format; append, don't reorder.
export const COLORS = ['#ffd23f', '#ffffff', '#ef4444', '#4fc3f7'];

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const IDX = new Map([...A].map((c, i) => [c, i]));

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const put12 = (n) => A[(n >> 6) & 63] + A[n & 63];
const get12 = (s, i) => ((IDX.get(s[i]) ?? 0) << 6) | (IDX.get(s[i + 1]) ?? 0);

const POS_LO = -0.1;
const POS_SPAN = 1.2;
const putPos = (v) => put12(Math.round(clamp((v - POS_LO) / POS_SPAN, 0, 1) * 4095));
const getPos = (s, i) => (get12(s, i) / 4095) * POS_SPAN + POS_LO;

const TEAM_OUT = { home: 'h', away: 'a', ball: 'b', cone: 'c' };
const TEAM_IN = { h: 'home', a: 'away', b: 'ball', c: 'cone' };
const KIND_OUT = { run: 'r', pass: 'p', free: 'f' };
const KIND_IN = { r: 'run', p: 'pass', f: 'free' };
const ORIENT_OUT = { auto: 'a', h: 'h', v: 'v' };
const ORIENT_IN = { a: 'auto', h: 'h', v: 'v' };

const TOKEN_LEN = 7;
const shirtOf = (nr) => ROSTER.find((p) => p.nr === nr)?.shirt ?? '';

export function encodeState(state) {
  const flags = (ORIENT_OUT[state.orient] ?? 'a')
    + (state.label === 'name' ? 'm' : 'n')
    + A[Math.max(0, COLORS.indexOf(state.color))];

  const tokens = (state.tokens ?? [])
    .map((t) => (TEAM_OUT[t.team] ?? 'h') + put12(clamp(t.nr ?? 0, 0, 4095))
      + putPos(t.x) + putPos(t.y))
    .join('');

  const draws = (state.draws ?? [])
    .map((d) => {
      const pts = d.pts.slice(0, 4095);
      return (KIND_OUT[d.type] ?? 'r')
        + A[Math.max(0, COLORS.indexOf(d.color))]
        + put12(pts.length)
        + pts.map(([x, y]) => putPos(x) + putPos(y)).join('');
    })
    .join('');

  return ['1', flags, state.size, state.form, tokens, draws].join('~');
}

function decodeCompact(payload) {
  const [, flags = 'an0', size = '8', form = '4-1-2', tokenBlob = '', drawBlob = ''] =
    payload.split('~');

  const tokens = [];
  for (let i = 0; i + TOKEN_LEN <= tokenBlob.length; i += TOKEN_LEN) {
    const team = TEAM_IN[tokenBlob[i]] ?? 'home';
    const nr = get12(tokenBlob, i + 1);
    tokens.push({
      team,
      nr: team === 'ball' ? undefined : nr,
      txt: team === 'home' ? shirtOf(nr) : undefined,
      x: getPos(tokenBlob, i + 3),
      y: getPos(tokenBlob, i + 5),
    });
  }

  const draws = [];
  for (let i = 0; i + 4 <= drawBlob.length;) {
    const type = KIND_IN[drawBlob[i]] ?? 'run';
    const color = COLORS[IDX.get(drawBlob[i + 1]) ?? 0] ?? COLORS[0];
    const count = get12(drawBlob, i + 2);
    const start = i + 4;
    const end = start + count * 4;
    if (end > drawBlob.length) break;
    const pts = [];
    for (let p = start; p < end; p += 4) pts.push([getPos(drawBlob, p), getPos(drawBlob, p + 2)]);
    draws.push({ type, color, pts });
    i = end;
  }

  return {
    v: 1,
    orient: ORIENT_IN[flags[0]] ?? 'auto',
    label: flags[1] === 'm' ? 'name' : 'nr',
    color: COLORS[IDX.get(flags[2]) ?? 0] ?? COLORS[0],
    size,
    form,
    tokens,
    draws,
  };
}

// Links handed out before the compact format existed carry base64'd JSON.
function decodeLegacy(payload) {
  const bin = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function decodeState(hash) {
  const m = /[#&]s=([A-Za-z0-9_~-]+)/.exec(hash || '');
  if (!m) return null;
  try {
    return m[1].startsWith('1~') ? decodeCompact(m[1]) : decodeLegacy(m[1]);
  } catch {
    return null;
  }
}
