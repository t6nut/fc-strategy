// Slot coordinates are normalised to the home team's own half being on the left:
//   x = 0 own goal line ... 1 opponent goal line
//   y = 0 one touchline  ... 1 the other
export const FORMATIONS = {
  '11': {
    '4-4-2': [
      ['GK', .06, .50],
      ['LB', .24, .15], ['CB', .21, .38], ['CB', .21, .62], ['RB', .24, .85],
      ['LM', .46, .15], ['CM', .43, .38], ['CM', .43, .62], ['RM', .46, .85],
      ['ST', .68, .42], ['ST', .68, .58],
    ],
    '4-3-3': [
      ['GK', .06, .50],
      ['LB', .24, .14], ['CB', .21, .38], ['CB', .21, .62], ['RB', .24, .86],
      ['CDM', .38, .50], ['CM', .48, .30], ['CM', .48, .70],
      ['LW', .70, .16], ['ST', .73, .50], ['RW', .70, .84],
    ],
    '4-2-3-1': [
      ['GK', .06, .50],
      ['LB', .24, .14], ['CB', .21, .38], ['CB', .21, .62], ['RB', .24, .86],
      ['CDM', .37, .38], ['CDM', .37, .62],
      ['LM', .56, .17], ['CAM', .56, .50], ['RM', .56, .83],
      ['ST', .74, .50],
    ],
    '4-1-4-1': [
      ['GK', .06, .50],
      ['LB', .24, .14], ['CB', .21, .38], ['CB', .21, .62], ['RB', .24, .86],
      ['CDM', .36, .50],
      ['LM', .55, .14], ['CM', .52, .38], ['CM', .52, .62], ['RM', .55, .86],
      ['ST', .74, .50],
    ],
    '3-5-2': [
      ['GK', .06, .50],
      ['CB', .22, .30], ['CB', .19, .50], ['CB', .22, .70],
      ['LWB', .44, .10], ['CM', .42, .34], ['CDM', .38, .50], ['CM', .42, .66], ['RWB', .44, .90],
      ['ST', .70, .42], ['ST', .70, .58],
    ],
    '5-3-2': [
      ['GK', .06, .50],
      ['LWB', .27, .10], ['CB', .21, .32], ['CB', .18, .50], ['CB', .21, .68], ['RWB', .27, .90],
      ['CM', .46, .30], ['CDM', .42, .50], ['CM', .46, .70],
      ['ST', .70, .42], ['ST', .70, .58],
    ],
  },
  '9': {
    '3-2-3': [
      ['GK', .07, .50],
      ['LB', .25, .20], ['CB', .22, .50], ['RB', .25, .80],
      ['CM', .45, .34], ['CM', .45, .66],
      ['LW', .69, .18], ['ST', .71, .50], ['RW', .69, .82],
    ],
    '3-4-1': [
      ['GK', .07, .50],
      ['LB', .25, .20], ['CB', .22, .50], ['RB', .25, .80],
      ['LM', .48, .15], ['CM', .45, .38], ['CM', .45, .62], ['RM', .48, .85],
      ['ST', .72, .50],
    ],
  },
  '8': {
    '4-1-2': [
      ['GK', .07, .50],
      ['LB', .26, .14], ['CB', .23, .38], ['CB', .23, .62], ['RB', .26, .86],
      ['CM', .45, .50],
      ['ST', .70, .36], ['ST', .70, .64],
    ],
    '4-2-1': [
      ['GK', .07, .50],
      ['LB', .26, .14], ['CB', .23, .38], ['CB', .23, .62], ['RB', .26, .86],
      ['CM', .46, .36], ['CM', .46, .64],
      ['ST', .72, .50],
    ],
    '3-3-1': [
      ['GK', .07, .50],
      ['LB', .25, .20], ['CB', .22, .50], ['RB', .25, .80],
      ['LM', .47, .20], ['CM', .45, .50], ['RM', .47, .80],
      ['ST', .71, .50],
    ],
    '3-2-2': [
      ['GK', .07, .50],
      ['LB', .25, .20], ['CB', .22, .50], ['RB', .25, .80],
      ['CM', .46, .36], ['CM', .46, .64],
      ['ST', .70, .36], ['ST', .70, .64],
    ],
    '2-3-2': [
      ['GK', .07, .50],
      ['CB', .23, .36], ['CB', .23, .64],
      ['LM', .47, .18], ['CM', .45, .50], ['RM', .47, .82],
      ['ST', .70, .38], ['ST', .70, .62],
    ],
  },
  '7': {
    '2-3-1': [
      ['GK', .07, .50],
      ['CB', .25, .34], ['CB', .25, .66],
      ['LM', .48, .17], ['CM', .45, .50], ['RM', .48, .83],
      ['ST', .72, .50],
    ],
    '3-2-1': [
      ['GK', .07, .50],
      ['LB', .26, .20], ['CB', .23, .50], ['RB', .26, .80],
      ['CM', .48, .36], ['CM', .48, .64],
      ['ST', .72, .50],
    ],
  },
  '5': {
    '1-2-1': [
      ['GK', .08, .50],
      ['CB', .28, .50],
      ['LM', .50, .28], ['RM', .50, .72],
      ['ST', .74, .50],
    ],
    '2-1-1': [
      ['GK', .08, .50],
      ['CB', .26, .34], ['CB', .26, .66],
      ['CM', .50, .50],
      ['ST', .74, .50],
    ],
  },
};

// Loose position families, used when auto-filling a formation from the roster.
const FAMILY = {
  GK: 'gk',
  LB: 'def', RB: 'def', CB: 'def', LCB: 'def', RCB: 'def', LWB: 'def', RWB: 'def',
  CDM: 'mid', CM: 'mid', CAM: 'mid', LM: 'mid', RM: 'mid',
  LW: 'att', RW: 'att', ST: 'att', LS: 'att', RS: 'att', CF: 'att',
};

const MIRROR = { L: 'R', R: 'L' };
const mirror = (code) =>
  MIRROR[code[0]] && code.length > 1 ? MIRROR[code[0]] + code.slice(1) : code;

/** How well a player suits a formation slot. Higher is better. */
export function fitScore(player, slotCode) {
  if (player.pos.includes(slotCode)) return 3;
  if (player.pos.includes(mirror(slotCode))) return 2;
  const want = FAMILY[slotCode];
  if (player.pos.some((p) => FAMILY[p] === want)) return 1;
  // A keeper should never drift outfield just to fill a gap.
  return want === 'gk' || player.pos.includes('GK') ? -1 : 0;
}

/** Greedy best-fit assignment of roster players to the slots of a formation. */
export function autoLineup(slots, roster) {
  const pool = [...roster];
  const picks = [];
  for (const [code, x, y] of slots) {
    let best = -Infinity;
    let bestIdx = -1;
    pool.forEach((p, i) => {
      const s = fitScore(p, code);
      if (s > best) { best = s; bestIdx = i; }
    });
    if (bestIdx === -1) break;
    picks.push({ player: pool.splice(bestIdx, 1)[0], code, x, y });
  }
  return picks;
}
