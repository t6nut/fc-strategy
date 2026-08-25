// Roster from fcstrat sheet. `shirt` is the name printed on the jersey.
//
// Order is the depth chart: where two players fit a slot equally well, the one
// listed first gets it, so the first-choice keeper heads the list.
//
// `status` is who is unavailable as things stand - 'injured' or 'out'. It only
// seeds a fresh board; from there it is edited in the squad sheet and travels
// with the board, so a weekly change needs no code.
export const ROSTER = [
  { nr: 87, name: 'Martin Lausmaa',    shirt: 'Lausmaa',     pos: ['GK'] },
  { nr: 1,  name: 'Margus Vesiallik',  shirt: 'Vesiallik',   pos: ['GK'], status: 'injured' },
  { nr: 5,  name: 'Stefan Zabolotnõi', shirt: 'Zabolotnõi',  pos: ['CB', 'LCB', 'RCB'] },
  { nr: 16, name: 'Siim Paisujõe',     shirt: 'Paisujõe',    pos: ['CB'] },
  { nr: 30, name: 'Kristjan Vahar',    shirt: 'Vahar',       pos: ['LB', 'RB', 'LM', 'RM'] },
  { nr: 32, name: 'Tõnn',              shirt: 'Tõnn',        pos: ['LB', 'RB', 'LM', 'RM'] },
  { nr: 14, name: 'Erik Öösalu',       shirt: 'Öösalu',      pos: ['LWB', 'RWB', 'LW', 'RW'] },
  { nr: 88, name: 'Jürgen Johannson',  shirt: 'Jürto',       pos: ['LW', 'RW', 'LWB', 'RWB'] },
  { nr: 97, name: 'Kristjan Illisson', shirt: 'Illusioon',   pos: ['CM', 'LWB', 'RWB'] },
  { nr: 18, name: 'Sander Saks',       shirt: 'CUL_DE_SAKS', pos: ['CM', 'CDM'] },
  { nr: 24, name: 'Martin Algus',      shirt: 'Algus',       pos: ['RM', 'LM', 'CM'], status: 'out' },
  { nr: 36, name: 'Helvar Kuhi',       shirt: 'Kuhi',        pos: ['LM', 'RM'] },
  { nr: 28, name: 'Henri Kuhi',        shirt: 'Henka',       pos: ['LM', 'LW', 'LS'] },
  { nr: 11, name: 'Martin Johannson',  shirt: 'Joh',         pos: ['CAM'] },
  { nr: 7,  name: 'Madis Kreevan',     shirt: 'Kreevan',     pos: ['ST'] },
  { nr: 9,  name: 'Kaspar Kaal',       shirt: 'Kapa',        pos: ['ST'], status: 'injured' },
  { nr: 67, name: 'Joosep Järve',      shirt: 'Järve',       pos: ['ST'] },
  { nr: 77, name: 'Kaspar Kõivoste',   shirt: 'Kõivoste',    pos: ['ST', 'RW', 'LW'] },
];

export const byNr = (nr) => ROSTER.find((p) => p.nr === nr);

/** Who is unavailable on a board nobody has edited yet. */
export const DEFAULT_STATUS = Object.fromEntries(
  ROSTER.filter((p) => p.status).map((p) => [p.nr, p.status]),
);
