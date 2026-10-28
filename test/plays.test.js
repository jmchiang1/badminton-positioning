import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, defaultTarget, checkShot, serveSetup, depthOf, zOf, TEAMS } from '../src/rules.js';
import { PLAYS } from '../src/plays.js';
import { shuttleSnaps, serveTargetSnaps, playerSnaps, nearest } from '../src/snaps.js';

const START = {
  doubles: { A1: { x: 2.2, z: 5.9 }, A2: { x: 0, z: 2.1 }, B1: { x: -1.3, z: -3.3 }, B2: { x: 1.3, z: -3.3 } },
  singles: { A1: { x: 1.8, z: 5.9 }, B1: { x: 0, z: -3.6 } },
};
// Mirrors main.js: the shuttle sits to the hitter's right and in front of them.
const contactFor = (p, team) => ({ x: p.x + 0.42 * TEAMS[team].sign, z: p.z - 0.35 * TEAMS[team].sign });

for (const def of PLAYS) {
  test(`play "${def.title}" runs cleanly through the rule engine`, () => {
    const ids = def.mode === 'doubles' ? ['A1', 'A2', 'B1', 'B2'] : ['A1', 'B1'];
    let setup = structuredClone(START[def.mode]);
    let hitterId;
    if (def.start.serve) {
      Object.assign(setup, serveSetup({ mode: def.mode, servingTeam: def.start.serve, score: def.start.score }));
      hitterId = `${def.start.serve}1`;
    } else {
      Object.assign(setup, def.start.setup);
      hitterId = def.start.hitter;
    }
    let contact = contactFor(setup[hitterId], hitterId[0]);

    def.steps.forEach((step, i) => {
      const H = hitterId[0];
      const R = H === 'A' ? 'B' : 'A';
      const target = step.to
        ? { x: step.to.x, z: zOf(R, step.to.d) }
        : defaultTarget({ mode: def.mode, shot: step.shot, contact, hitterTeam: H, direction: step.dir, server: setup[hitterId] });
      const warns = checkShot({ mode: def.mode, shot: step.shot, contact, hitterTeam: H, target, score: def.start.score ?? 'even', server: setup[hitterId] })
        .filter((n) => n.level === 'warn');
      assert.deepEqual(warns, [], `step ${i + 1} (${step.shot}) should be legal`);
      const r = recommend({ mode: def.mode, shot: step.shot, players: ids.map((id) => ({ id, ...setup[id] })), hitterId, target, contact });
      assert.deepEqual(Object.keys(r.moves).sort(), [...ids].sort(), `step ${i + 1}`);
      assert.ok(step.note && step.note.length < 60, `step ${i + 1} note stays short`);
      // advance, as main.js does
      setup = Object.fromEntries(ids.map((id) => [id, { x: r.moves[id].x, z: r.moves[id].z }]));
      const d = Math.max(0.6, Math.min(6.6, depthOf(R, target.z)));
      contact = { x: Math.max(-3, Math.min(3, target.x)), z: zOf(R, d) };
      hitterId = ids.filter((id) => id[0] === R)
        .sort((a, b) => ((setup[a].x - contact.x) ** 2 + (setup[a].z - contact.z) ** 2) - ((setup[b].x - contact.x) ** 2 + (setup[b].z - contact.z) ** 2))[0];
    });
  });
}

test('snap grids: 3x3, on the right side of the net, inside the court', () => {
  for (const mode of ['singles', 'doubles']) {
    for (const team of ['A', 'B']) {
      for (const spots of [shuttleSnaps(mode, team), playerSnaps(mode, team), serveTargetSnaps(mode, team, 1)]) {
        assert.equal(spots.length, 9);
        for (const s of spots) {
          assert.equal(Math.sign(s.z), TEAMS[team].sign);
          assert.ok(Math.abs(s.x) < (mode === 'singles' ? 2.59 : 3.05));
          assert.ok(Math.abs(s.z) < 6.7);
        }
      }
    }
  }
  assert.deepEqual(nearest(shuttleSnaps('doubles', 'A'), { x: 2.0, z: 5.5 }), { x: 2.2, z: 5.9 });
});

test('serve target snaps are all legal serves', () => {
  for (const mode of ['singles', 'doubles']) {
    const server = serveSetup({ mode, servingTeam: 'A', score: 'even' }).A1;
    for (const t of serveTargetSnaps(mode, 'B', server.x)) {
      for (const shot of ['serveShort', 'serveHigh']) {
        const warns = checkShot({ mode, shot, contact: server, hitterTeam: 'A', target: t, score: 'even' }).filter((n) => n.level === 'warn');
        assert.deepEqual(warns, [], `${mode} ${shot} to ${JSON.stringify(t)}`);
      }
    }
  }
});
