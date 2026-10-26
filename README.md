# Bird Flight — Willie Wagtail, v0.4

A top-down 2.5D browser game. The world uses X/Y in pixels and independent Z altitude in gameplay metres. All rendering uses HTML Canvas, with no library dependencies.

## Run locally on a Mac

1. Extract `birdflight-v0.4.zip`. Open the extracted `birdflight_v04` folder in Finder.
2. Open Terminal; type `cd ` (including the space); drag `birdflight_v04` onto Terminal; press Return.
3. Enter `python3 -m http.server 8001` and press Return. If 8001 is already in use, use 8002 instead.
4. Open `http://localhost:8001/` (or `http://localhost:8002/`). **Don't double-click index.html** (ES modules need HTTP).
5. To stop the server, return to Terminal and press Control+C.

The same sources can be hosted on GitHub Pages. Upload the *contents* of the extracted directory at repository root; do not add a second `birdflight_v04` directory.

## Controls

| Keys | Action |
| --- | --- |
| 7 + 9, then 4 + 6, then 1 + 3 | Paired wing flap: up, out, power downstroke |
| 7, 4, 1 | Left wing, independently; completed stroke steers right |
| 9, 6, 3 | Right wing, independently; completed stroke steers left |
| 4 + 6 (held) | Spread wings and glide if airspeed is sufficient |
| 8 | Lean forward: accelerate and descend more readily |
| 5 | Neutral body posture |
| 2 | Lean backward: brake and gain more height from strokes |
| W / A / S / D | Ground hopping |
| Space | Peck/search one grass tile or pick up nearby nest material |
| F | Land on a nearby valid perch when within horizontal/vertical reach |
| E | Add carried materials at the marked nest site |

Digit-row keys and physical Numpad keys both work. Both paired wing buttons should be released before the next row to get fresh keydown events. The HUD shows `FLAPS`; if this doesn't increase, the stroke was not registered. A two-wing stroke adds **two** to that count.

## Debugging flight

- Start with pitch **5 (neutral)** and use `7+9 → 4+6 → 1+3`, releasing each pair. Repeat three times.
- Read `FLAPS` (2, 4, 6...), `ALT` (metres), `VZ` (vertical speed) and the 0–40 m altitude gauge.
- Altitude should increase after a completed stroke and eventually fall without repeated flapping. Being airborne does not require the bird to change its vertical *screen* position; the camera zooms out gently with height.
- Hold 4+6 to glide while moving horizontally. Gliding **slows descent**; it does not provide indefinite hovering.
- If FLAPS stays at zero, click inside the game and make sure your browser is receiving the number keys (both number row and numpad are accepted).
- For JavaScript errors, open Chrome Console with Command+Option+J.

## What's changed in v0.4

See [CHANGES.md](CHANGES.md) for an exact file-by-file breakdown and [ROADMAP.md](ROADMAP.md) for deferred features.

## Tests

If Node.js is installed, run `npm test` from this folder. No `npm install` is needed. The 11 tests cover wing-event capture, climbing, steering, gliding, hopping, tree generation, resources, searched tiles, perching, takeoff and camera centring.
