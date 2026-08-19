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
- **Line up.** Pick a shape and tap *Line up*: the app fills it from the squad
  using each player's preferred positions. Sizes run 11v11 down to 5v5, and it
  opens on 8v8 / 4-1-2. The same controls sit in the squad sheet, alongside
  *Add on map* and *Remove all* for our side and for the opponents.
- **Drawings.** Solid arrow for a run, dashed arrow for a pass, freehand for
  everything else, in four colours. Erase taps a line away; undo steps back.
- **Ball.** One tap.
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
setting — into the URL itself, base64 in the fragment. Send that link over
WhatsApp and whoever opens it sees exactly your board, on any device, with no
server and no sign-in. It is a snapshot, not a live link: if you move a dot
afterwards, they still see the version you sent, and you send a fresh link.

**What we don't have** is true sync — one board that every phone sees update
live. That genuinely needs a server to hold the state; there is no way around
it in a static page. If we ever want it, the cheapest version is a Cloudflare
Worker with KV (or Firebase / Supabase) storing one JSON blob per team code,
polled every few seconds. That's roughly thirty lines on top of what's here —
`js/store.js` is already the only file that touches storage, so it would drop
in there.

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
coordinates (`x` from our goal line to theirs, `y` across the pitch).

## Layout

| File | What's in it |
| --- | --- |
| `index.html` | Markup and controls |
| `css/app.css` | All styling |
| `js/app.js` | State, rendering, dragging, drawing, wiring |
| `js/pitch.js` | Pitch geometry and the coordinate mapping |
| `js/players.js` | The squad |
| `js/formations.js` | Shapes, and the best-fit line-up |
| `js/store.js` | Auto-save, saved plays, share links |
| `sw.js` | Offline cache |

Positions are stored normalised to the pitch (0–1 along its length and width),
never in pixels, so a board looks the same on a phone, a tablet and a laptop,
and survives flipping between portrait and landscape.
