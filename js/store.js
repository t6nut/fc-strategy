const BOARD_KEY = 'fcstrat.board.v1';
const PLAYS_KEY = 'fcstrat.plays.v1';

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // private mode / quota - the board still works, it just won't persist
  }
};

let pending = 0;
/** Debounced autosave of the working board. */
export function saveBoard(state) {
  clearTimeout(pending);
  pending = setTimeout(() => write(BOARD_KEY, state), 250);
}
export const loadBoard = () => read(BOARD_KEY, null);

export const loadPlays = () => read(PLAYS_KEY, []);

export function savePlay(name, state) {
  const plays = loadPlays().filter((p) => p.name !== name);
  plays.unshift({ name, at: Date.now(), state });
  write(PLAYS_KEY, plays.slice(0, 40));
  return plays;
}

export function deletePlay(name) {
  const plays = loadPlays().filter((p) => p.name !== name);
  write(PLAYS_KEY, plays);
  return plays;
}
