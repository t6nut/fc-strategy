// Roster from fcstrat sheet. `shirt` is the name printed on the jersey.
export const ROSTER = [
  { nr: 1,  name: 'Margus Vesiallik',  shirt: 'Vesiallik',   pos: ['GK'] },
  { nr: 87, name: 'Martin Lausmaa',    shirt: 'Lausmaa',     pos: ['GK'] },
  { nr: 5,  name: 'Stefan Zabolotnõi', shirt: 'Zabolotnõi',  pos: ['CB', 'LCB', 'RCB'] },
  { nr: 16, name: 'Siim Paisujõe',     shirt: 'Paisujõe',    pos: ['CB'] },
  { nr: 30, name: 'Kristjan Vahar',    shirt: 'Vahar',       pos: ['LB', 'RB', 'LM', 'RM'] },
  { nr: 32, name: 'Tõnn',              shirt: 'Tõnn',        pos: ['LB', 'RB', 'LM', 'RM'] },
  { nr: 14, name: 'Erik Öösalu',       shirt: 'Öösalu',      pos: ['LWB', 'RWB', 'LW', 'RW'] },
  { nr: 88, name: 'Jürgen Johannson',  shirt: 'Jürto',       pos: ['LW', 'RW', 'LWB', 'RWB'] },
  { nr: 97, name: 'Kristjan Illisson', shirt: 'Illusioon',   pos: ['CM', 'LWB', 'RWB'] },
  { nr: 18, name: 'Sander Saks',       shirt: 'CUL_DE_SAKS', pos: ['CM', 'CDM'] },
  { nr: 24, name: 'Martin Algus',      shirt: 'Algus',       pos: ['RM', 'LM', 'CM'] },
  { nr: 36, name: 'Helvar Kuhi',       shirt: 'Kuhi',        pos: ['LM', 'RM'] },
  { nr: 28, name: 'Henri Kuhi',        shirt: 'Henka',       pos: ['LM', 'LW', 'LS'] },
  { nr: 11, name: 'Martin Johannson',  shirt: 'Joh',         pos: ['CAM'] },
  { nr: 7,  name: 'Madis Kreevan',     shirt: 'Kreevan',     pos: ['ST'] },
  { nr: 9,  name: 'Kaspar Kaal',       shirt: 'Kapa',        pos: ['ST'] },
  { nr: 67, name: 'Joosep Järve',      shirt: 'Järve',       pos: ['ST'] },
  { nr: 77, name: 'Kaspar Kõivoste',   shirt: 'Kõivoste',    pos: ['ST', 'RW', 'LW'] },
];

export const byNr = (nr) => ROSTER.find((p) => p.nr === nr);
