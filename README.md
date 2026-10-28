# Courtwise

An interactive 3D badminton court for answering "where should I stand?". Place the players
and the shuttle, pick a shot and its direction, and Courtwise moves everyone to where they
should go next, with a short explanation for each player. It works for singles and doubles.

## Using it

1. Choose **Singles** or **Doubles**.
2. Pick **who's hitting**: tap a player, or drag the shuttle to where it's being hit. When you
   drop the shuttle, the nearest player steps in behind it.
3. Pick the **shot**: short serve, high / flick serve, clear, lift, smash, drop, net kill, drive,
   push, net shot or block.
4. Pick a **direction**: straight, middle or cross-court (for serves: to the T, body or wide).
   You can also drag the yellow target ring.
5. Press **Show where to go**. The shuttle flies, and the players move to their spots with
   footwork, leaving ghosts and arrows where they started. A short role tag floats over each
   player, such as "Straight defender" or "Front: net". Faults and out shots show as a banner.
6. **Next shot from here** carries the rally on: the receiver now has the shuttle where it landed.

**Snapping.** With "Snap to common spots" on, dragged things lock to preset spots, which
light up while you drag:
- the shuttle and target ring: a 3×3 grid per half (left / centre / right × front / mid / back),
  or inside the diagonal service court for serves;
- players: front corners and the T, the two defence spots and the base, and the back corners
  and back-centre.

Turn it off to place things freely.

**Plays.** Replays of common high-level patterns: a short serve followed by a third-shot attack,
punishing the flick serve, drop–net–kill, turning defence into attack, and singles clear–drop and
four-corner rallies. Each shot pauses with everyone at their new spot. Use ‹ › to step and
Pause / Play to control the replay. The plays run through the same rule engine, so they always
agree with the setup mode. They're defined in `src/plays.js`, and adding one is a few lines.

Drag empty space to orbit the camera, and pinch or scroll to zoom. The camera buttons jump to
either end, top-down or side-on. For serves, choose the serving side's score (even means the
right court, odd the left) and **Place players for this serve** puts everyone where the Laws say.

The rules, and the sources they came from, are in [RULES.md](RULES.md).

## Running it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm run build` writes a static site to `dist/` with relative paths, so it can be hosted
anywhere: GitHub Pages, Vercel, Netlify, or a folder.

## Code

- `src/rules.js`: the positioning engine. Pure functions with no three.js, unit tested in `test/`.
- `src/scene.js`: the three.js court, net, jointed player models, shuttle, arrows and flight paths.
- `src/snaps.js`: the preset snap spots.
- `src/plays.js`: the scripted rallies.
- `src/main.js`: app state, dragging, animation and the side panel.
- `src/rulesDoc.js`: the plain-language rules shown in the app.

Built with [three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).
