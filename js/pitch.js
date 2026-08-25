// A full-size pitch in metres: 105 x 68, drawn to real proportions.
export const L = 105;      // length, goal line to goal line
export const W = 68;       // width, touchline to touchline
const MARGIN_LONG = 6;     // run-off behind each goal (fits the 2 m goal box)
const MARGIN_SHORT = 5;    // run-off outside each touchline

export const VIEW = {
  h: { x: -MARGIN_LONG, y: -MARGIN_SHORT, w: L + MARGIN_LONG * 2, h: W + MARGIN_SHORT * 2 },
  v: { x: -MARGIN_SHORT, y: -MARGIN_LONG, w: W + MARGIN_SHORT * 2, h: L + MARGIN_LONG * 2 },
};

const PEN_D = 16.5;                 // penalty area depth
const PEN_W = 40.32;                // penalty area width
const GOALA_D = 5.5;                // goal area depth
const GOALA_W = 18.32;              // goal area width
const SPOT = 11;                    // penalty spot distance
const R = 9.15;                     // centre circle / penalty arc radius
const GOAL_W = 7.32;
const GOAL_D = 2;

const penY = (W - PEN_W) / 2;       // 13.84
const goalaY = (W - GOALA_W) / 2;   // 24.84
const goalY = (W - GOAL_W) / 2;     // 30.34
// Where the penalty arc crosses the edge of the box.
const arcDy = Math.sqrt(R * R - (PEN_D - SPOT) ** 2);
const n = (v) => Math.round(v * 1000) / 1000;

function stripes(count = 10) {
  const band = L / count;
  let out = '';
  for (let i = 0; i < count; i += 2) {
    out += `<rect class="stripe" x="${n(i * band)}" y="0" width="${n(band)}" height="${W}"/>`;
  }
  return out;
}

function halfMarkings(side) {
  // side = 1 for the left-hand goal, -1 mirrors everything to the right-hand goal.
  const at = (x) => (side === 1 ? x : L - x);
  const sweep = side === 1 ? 1 : 0;
  return `
    <rect class="line" x="${n(Math.min(at(0), at(PEN_D)))}" y="${n(penY)}"
          width="${PEN_D}" height="${PEN_W}"/>
    <rect class="line" x="${n(Math.min(at(0), at(GOALA_D)))}" y="${n(goalaY)}"
          width="${GOALA_D}" height="${GOALA_W}"/>
    <circle class="spot" cx="${n(at(SPOT))}" cy="${n(W / 2)}" r="0.35"/>
    <path class="line" d="M ${n(at(PEN_D))},${n(W / 2 - arcDy)}
          A ${R} ${R} 0 0 ${sweep} ${n(at(PEN_D))},${n(W / 2 + arcDy)}"/>
    <rect class="goal" x="${n(side === 1 ? -GOAL_D : L)}" y="${n(goalY)}"
          width="${GOAL_D}" height="${GOAL_W}"/>`;
}

const CORNERS = [
  'M 1,0 A 1 1 0 0 1 0,1',
  `M ${L - 1},0 A 1 1 0 0 0 ${L},1`,
  `M 0,${W - 1} A 1 1 0 0 1 1,${W}`,
  `M ${L - 1},${W} A 1 1 0 0 1 ${L},${W - 1}`,
];

/** Build the pitch SVG for the given orientation ('h' landscape | 'v' portrait). */
export function pitchSvg(orient) {
  const vb = VIEW[orient];
  // In portrait the whole pitch is rotated a quarter turn so it runs bottom-to-top.
  const rot = orient === 'v' ? ` transform="translate(0 ${L}) rotate(-90)"` : '';
  return `<svg class="pitch" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"
      preserveAspectRatio="none" aria-hidden="true">
    <rect class="grass" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}"/>
    <g${rot}>
      ${stripes()}
      <rect class="line" x="0" y="0" width="${L}" height="${W}"/>
      <line class="line" x1="${L / 2}" y1="0" x2="${L / 2}" y2="${W}"/>
      <circle class="line" cx="${L / 2}" cy="${W / 2}" r="${R}"/>
      <circle class="spot" cx="${L / 2}" cy="${W / 2}" r="0.35"/>
      ${halfMarkings(1)}
      ${halfMarkings(-1)}
      ${CORNERS.map((d) => `<path class="line" d="${d}"/>`).join('')}
    </g>
  </svg>`;
}

/** Normalised pitch coords (0..1 along length / width) -> fraction of the board box. */
export function toFrac(x, y, orient) {
  const vb = VIEW[orient];
  const xm = x * L;
  const ym = y * W;
  return orient === 'h'
    ? { fx: (xm - vb.x) / vb.w, fy: (ym - vb.y) / vb.h }
    : { fx: (ym - vb.x) / vb.w, fy: (L - xm - vb.y) / vb.h };
}

/** Fraction of the board box -> normalised pitch coords, clamped to the run-off area. */
export function fromFrac(fx, fy, orient) {
  const vb = VIEW[orient];
  const a = vb.x + fx * vb.w;
  const b = vb.y + fy * vb.h;
  const xm = orient === 'h' ? a : L - b;
  const ym = orient === 'h' ? b : a;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return {
    x: clamp(xm, VIEW.h.x, VIEW.h.x + VIEW.h.w) / L,
    y: clamp(ym, VIEW.h.y, VIEW.h.y + VIEW.h.h) / W,
  };
}
