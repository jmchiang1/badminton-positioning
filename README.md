# Courtwise

An interactive 3D badminton court for answering "where should I stand?". Place the players
and the shuttle, pick a shot and its direction, and Courtwise moves everyone to where they
should go next, with a short explanation for each player. It works for singles and doubles.

## Using it

1. Choose **Singles** or **Doubles**.
2. Pick **who's hitting**. You can tap a player, or drag the shuttle (the white floor disc) next to them.
3. Pick the **shot**: short serve, high / flick serve, clear, lift, smash, drop, net kill, drive,
   push, net shot or block.
4. Pick a **direction**: straight, middle or cross-court (for serves: to the T, body or wide).
   You can also drag the yellow target ring anywhere.
5. Press **Show where to go**. The shuttle flies, the players move to their spots (with ghosts
   and arrows from where they started), and each player gets a card explaining their role.
6. **Next shot from here** carries the rally on: the receiver now has the shuttle where it landed.

Drag players to rearrange them. Drag empty space to orbit the camera, and pinch or scroll to zoom.
The camera buttons jump to either end, top-down or side-on. For serves, choose the serving
side's score (even means the right court, odd the left) and **Place players for this serve**
puts everyone where the Laws say they stand.

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
- `src/scene.js`: the three.js court, net, players, shuttle, arrows and flight paths.
- `src/main.js`: app state, dragging, animation and the side panel.
- `src/rulesDoc.js`: the plain-language rules shown in the app.

Built with [three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).
