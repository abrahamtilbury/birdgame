# Bird Flight — Willie Wagtail v0.12.7

Lightweight 2.5D browser game, no external JS dependencies.

## Run locally

From the `birdgame-main` directory:

```sh
python3 -m http.server 8001
```

Open http://localhost:8001/ (not `file://`). Hard-refresh after uploading new files.

## Flying

- **Tap 4 + 6** together, release, and tap again to climb. Holding both spreads the wings to glide, but does not repeatedly flap.
- **Tap 1 + 3** together for a more forward-thrust-oriented flap.
- **Hold 4 alone** to bank and turn right; **hold 6 alone** to bank and turn left.
- **While holding 4 + 6**, briefly tap **1** to nudge right or **3** to nudge left. A nudge persists briefly, but not forever.
- **7 + 9** flares. **8/5/2** selects forward/neutral/backward pitch.
- **W/A/S/D** hops on the ground. **Space** searches, grips or deposits; **X** drops carried material; **N** places material at the nest.

## Nest and family milestone

Collect one twig and one grass item. Perch on a branch, press N with the twig to choose the nest branch, return there with the grass item and press N to deposit. `nestStatus` shows progress. After the nest is built and the mate arrives, the milestone appears. Press **Preview family milestone** at any time to test the photo without unlocking it.

## Authentic media files (bundled)

```text
audio/wagtail-contact.mp3
images/wagtail-family-milestone.webp
```

Press **Bird calls: Off** once to enable sound (mobile browsers require a tap). No local-file picker required. Audio plays occasionally at a moderate level.

## Debugging

Open Chrome DevTools Console, run `birdFlightDebug()` for flight, nest, and audio state. If an asset fails, open its URL directly under `http://localhost:8001/`.

## Tests

```sh
npm test
```

This version uses manual, game-tuned aerodynamic approximations rather than a full physical bird-flight model. In-browser and iPhone performance still require device testing.

## Physics tuning in v0.12.7

- Manual paired wing strokes still require fresh taps within 160 ms. Holding a key never repeats a power stroke.
- Aerodynamic lift is now shaped by a speed-squared game-space term, a stall gate, wing area, pitch and bank. It is not a calibrated SI bird model because horizontal motion is pixels/s while altitude is gameplay metres.
- Wing asymmetry creates bank; bank curves the velocity vector. Fanning the tail increases airbraking and yaw damping.
- A carried twig adds approximately 3 g and grass 1 g to an approximate 20 g body. These values are gameplay tuning constants, not measured material weights.
- iOS Safari gesture suppression is restricted to the touch-control pads. The game canvas still uses `touch-action: manipulation` to preserve deliberate pinch zoom. Real-device verification is required.
- `npm test` runs the included Node.js integration checks (Node 18+).

## Project directories

This project intentionally stores media in the root-level `audio/` and `images/` folders. **Do not create an `assets/` folder.**
