# FC Strategy Board

A drag-and-drop tactics board for our Sunday league side. Built for a phone at
the side of the pitch: open it, drag the dots, talk. No build step, no
dependencies, no account.

Open `index.html` — that's the whole app.

## What it does

- **Real pitch.** Drawn to proper proportions (105 x 68 m) with penalty areas,
  goal areas, penalty spots and arcs, centre circle, corner arcs and goals.
  It flips between portrait and landscape automatically, or you can pin it.
- **Our squad.** Light blue dots carrying each player's shirt number, with the
  name from the jersey underneath. The roster lives in `js/players.js`.
- **Opponents.** Red dots — add them one at a time, or drop in a full mirrored
  team in the selected shape.
- **Line up.** Pick a size and a shape and the pitch follows immediately — no
  button to press. It opens on 8v8 / 4-1-2; 9v9 and 7v7 are the other sizes.
  Changing the shape leaves a hand-placed red team alone, but changing the size
  re-forms both, since the number of players changes. *Line up* is still there
  for a manual re-apply, along with *Add on map* and *Remove all* in the squad
  sheet, for our side and for the opponents.
- **Drawings.** Solid arrow for a run, dashed arrow for a pass, freehand for
  everything else, in four colours. Erase taps a line away; undo steps back.
- **The ball.** One tap to put it on. Drop it next to someone and they take it
  — a gold ring marks who has it, and it travels with them when you drag them.
  **Double tap the player holding it** and they play the ball to the nearest
  team-mate with a clear lane: an opponent standing within about three metres
  of the line blocks it, so the ball goes to whoever is actually free, and the
  pass is drawn as a dashed arrow. Double tap anyone else and they take the
  ball instead. If every lane is shut, it says so and nothing moves.
- **Live pass options.** Drag the player holding the ball and every team-mate
  he can still reach is drawn as you move — the nearest one bright, the rest
  faded, blocked ones not drawn at all. It is the quickest way to see an angle
  open up. The lines are only a preview: they vanish on release and are never
  saved. Double tap plays the bright one.
- **Saves itself.** Every move is written to the device straight away, so
  closing the tab or locking the phone loses nothing.
- **Saved plays.** Name a set-up ("Corner — near post") and load it back later.
- **Works offline.** It installs as a home-screen app and caches itself, which
  matters on a pitch with one bar of signal.

## Getting a board onto someone else's phone

There are two mechanisms, and they cover different needs:

**Auto-save (on by default)** uses `localStorage`. It is per browser, per
device. Your phone remembers your board; it does not travel.

**Copy share link** packs the entire board — every dot, every arrow, every
setting — into the URL itself. Send that link over WhatsApp and whoever opens
it sees exactly your board, on any device, with no server and no sign-in. It is
a snapshot, not a live link: if you move a dot afterwards, they still see the
version you sent, and you send a fresh one.

The link is short because `js/share.js` earns it. Anything derivable is left
out — token ids are regenerated on open, and shirt names are looked up from the
squad by number — and what remains is written as fixed-width base64url fields
that need no separators. A full board with both teams, the ball and two arrows
comes to about 190 characters, against roughly 1900 for the base64'd JSON it
replaced. Links handed out in the old format still open.

**What we don't have** is anything that needs a server to remember something:
true sync (one board every phone sees update live), a `/korner-lahipost` style
named link, or a short `fcb.ee/x7k2` one. All three need somewhere to store the
mapping between a name and a board — a static page has nowhere to put it. The
share link avoids the problem by carrying the board itself rather than pointing
at one.

If we do want them, the cheapest version is a Cloudflare Worker or a Vercel
function with a key-value store holding one JSON blob per code, which buys all
three at once. That's a small amount of code, but it turns a file you can open
from disk into a service someone has to keep running. `js/share.js` and
`js/store.js` are the only files that would change.

## Updates and the offline cache

The service worker is **network first**: it always tries the server, and only
falls back to its cache when there's no signal. That's deliberate. The first
version cached first and only fell back to the network, which meant a deploy
never reached anyone who already had the app open — you had to hard-refresh to
see new code.

So a normal reload picks up a deploy. The one exception is the reload that
carries this change itself: a browser still running the old cache-first worker
serves the old page once while the new worker installs, and the reload after
that is current. From then on it's a single reload, every time.

If you ever need to be certain, DevTools → Application → Service Workers →
Unregister, or Empty Cache and Hard Reload.

## Hosting it

Any static host works — it's plain files. GitHub Pages: push this branch and
point Pages at it. On the phone, use *Add to Home Screen* so it opens
full-screen and works without signal.

Locally:

```sh
python3 -m http.server 8777    # then open http://localhost:8777
```

Open it over `http://`, not `file://` — the app uses ES modules and a service
worker, and both need a real origin.

## Editing the squad

`js/players.js` is one array. Add, remove or renumber a player and the roster
sheet, the shirt labels and the auto line-up all follow:

```js
{ nr: 9, name: 'Kaspar Kaal', shirt: 'Kapa', pos: ['ST'] },
```

`pos` drives the auto line-up. Recognised codes: `GK`, `LB`, `RB`, `CB`, `LCB`,
`RCB`, `LWB`, `RWB`, `CDM`, `CM`, `CAM`, `LM`, `RM`, `LW`, `RW`, `ST`, `LS`,
`RS`, `CF`. Put the position someone actually plays first — it decides where
they land when you tap them onto the pitch from the squad list.

Formations live in `js/formations.js`, as slot lists in normalised pitch
coordinates (`x` from our goal line to theirs, `y` across the pitch). The file
still holds 11v11 and 5v5 shapes; `SIZES` at the top of `js/app.js` decides
which sizes the picker offers, so putting them back is a one-line change.

## Layout

| File | What's in it |
| --- | --- |
| `index.html` | Markup and controls |
| `css/app.css` | All styling |
| `js/app.js` | State, rendering, dragging, drawing, wiring |
| `js/pitch.js` | Pitch geometry and the coordinate mapping |
| `js/players.js` | The squad |
| `js/formations.js` | Shapes, and the best-fit line-up |
| `js/store.js` | Auto-save and saved plays |
| `js/share.js` | Packing a board into a link, and back out |
| `sw.js` | Offline cache |

Positions are stored normalised to the pitch (0–1 along its length and width),
never in pixels, so a board looks the same on a phone, a tablet and a laptop,
and survives flipping between portrait and landscape.
