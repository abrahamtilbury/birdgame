# Bird Flight — Willie Wagtail v0.12.4

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

Collect one twig and three separate grass items. Perch on a branch, press N with the twig to choose the nest branch, return there with each grass item and press N to deposit. `nestStatus` shows progress. After the nest is built and the mate arrives, the milestone appears. Press **Preview family milestone** at any time to test the photo without unlocking it.

## Authentic media files (bundled)

```text
assets/audio/wagtail-contact.mp3
assets/images/wagtail-family-milestone.webp
```

Press **Bird calls: Off** once to enable sound (mobile browsers require a tap). No local-file picker required. Audio plays occasionally at a moderate level.

## Debugging

Open Chrome DevTools Console, run `birdFlightDebug()` for flight, nest, and audio state. If an asset fails, open its URL directly under `http://localhost:8001/`.

## Tests

```sh
npm test
```

This version uses manual, game-tuned aerodynamic approximations rather than a full physical bird-flight model. In-browser and iPhone performance still require device testing.
