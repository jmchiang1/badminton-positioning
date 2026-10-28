// Preset spots that dragged things snap to. All in world x/z (see rules.js).
import { zOf } from './rules.js';

// Shuttle (contact point) and target: a 3x3 grid per half,
// left / centre / right by front / mid / back.
export function shuttleSnaps(mode, team) {
  const xs = mode === 'singles' ? [-1.8, 0, 1.8] : [-2.2, 0, 2.2];
  const depths = [1.2, 3.6, 5.9];
  return depths.flatMap((d) => xs.map((x) => ({ x, z: zOf(team, d) })));
}

// Serve targets: a 3x3 grid inside the diagonal service court.
export function serveTargetSnaps(mode, team, serverX) {
  const sign = serverX >= 0 ? -1 : 1; // diagonally opposite keeps the opposite x sign
  const xs = mode === 'singles' ? [0.3, 1.25, 2.2] : [0.3, 1.5, 2.65];
  const depths = mode === 'singles' ? [2.4, 4.4, 6.3] : [2.4, 4.1, 5.6];
  return depths.flatMap((d) => xs.map((x) => ({ x: sign * x, z: zOf(team, d) })));
}

// Players: the nine places people actually stand.
// Front: front corners and the T. Middle: the two defence spots and the base.
// Back: the back corners and back-centre (behind a partner at the net).
export function playerSnaps(mode, team) {
  const spots = mode === 'singles'
    ? [[-1.4, 1.5], [0, 2.2], [1.4, 1.5], [-1.6, 3.5], [0, 3.6], [1.6, 3.5], [-1.8, 5.7], [0, 5.0], [1.8, 5.7]]
    : [[-1.6, 1.5], [0, 2.1], [1.6, 1.5], [-1.3, 3.3], [0, 3.4], [1.3, 3.3], [-2.0, 5.6], [0, 4.5], [2.0, 5.6]];
  return spots.map(([x, d]) => ({ x, z: zOf(team, d) }));
}

export function nearest(spots, p) {
  let best = spots[0];
  let bd = Infinity;
  for (const s of spots) {
    const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}
