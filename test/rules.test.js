import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, defaultTarget, checkShot, serveSetup, serveReceiver, depthOf, SHOT_ORDER } from '../src/rules.js';

const doublesPlayers = () => [
  { id: 'A1', x: 1.0, z: 5.0 },
  { id: 'A2', x: -0.5, z: 2.2 },
  { id: 'B1', x: -1.2, z: -3.2 },
  { id: 'B2', x: 1.2, z: -3.2 },
];

const singlesPlayers = () => [
  { id: 'A1', x: 0.8, z: 5.5 },
  { id: 'B1', x: 0, z: -3.5 },
];

function run(mode, shot, players, hitterId, direction = 'straight') {
  const hitter = players.find((p) => p.id === hitterId);
  const contact = { x: hitter.x, z: hitter.z };
  const target = defaultTarget({ mode, shot, contact, hitterTeam: hitterId[0], direction });
  return { r: recommend({ mode, shot, players, hitterId, target, contact }), target };
}

test('every shot produces a move for every active player', () => {
  for (const shot of SHOT_ORDER) {
    const d = run('doubles', shot, doublesPlayers(), 'A1').r;
    assert.deepEqual(Object.keys(d.moves).sort(), ['A1', 'A2', 'B1', 'B2'], shot);
    const s = run('singles', shot, singlesPlayers(), 'A1').r;
    assert.deepEqual(Object.keys(s.moves).sort(), ['A1', 'B1'], shot);
    for (const m of [...Object.values(d.moves), ...Object.values(s.moves)]) {
      assert.ok(Number.isFinite(m.x) && Number.isFinite(m.z), shot);
      assert.ok(m.text.length > 20, shot);
    }
  }
});

test('players never get sent to the wrong side of the net', () => {
  for (const shot of SHOT_ORDER) {
    const { moves } = run('doubles', shot, doublesPlayers(), 'A1').r;
    assert.ok(moves.A1.z > 0 && moves.A2.z > 0, shot);
    assert.ok(moves.B1.z < 0 && moves.B2.z < 0, shot);
  }
});

test('doubles lift: hitting side goes side-by-side, receivers go front-and-back', () => {
  const { r } = run('doubles', 'lift', doublesPlayers(), 'A1');
  const a = [r.moves.A1, r.moves.A2];
  // side-by-side: similar depth, clearly apart across the court
  assert.ok(Math.abs(a[0].z - a[1].z) < 0.6);
  assert.ok(Math.abs(a[0].x - a[1].x) > 2);
  const b = [r.moves.B1, r.moves.B2].map((m) => depthOf('B', m.z)).sort((x, y) => x - y);
  assert.ok(b[1] - b[0] > 2.5, 'one front, one back');
  assert.match(r.formation.A, /side-by-side/);
  assert.match(r.formation.B, /front-and-back/);
});

test('doubles smash from the back: smasher stays back, partner takes the net', () => {
  const { r } = run('doubles', 'smash', doublesPlayers(), 'A1');
  assert.ok(depthOf('A', r.moves.A1.z) > 3.5);
  assert.ok(depthOf('A', r.moves.A2.z) < 2.5);
  assert.match(r.formation.B, /side-by-side/);
});

test('straight defender sits on the attacker\'s side and slightly deeper', () => {
  const players = doublesPlayers();
  const { r } = run('doubles', 'smash', players, 'A1', 'straight'); // A1 at x = 1.0
  const straight = Object.values(r.moves).find((m) => m.role === 'Straight defender');
  const cross = Object.values(r.moves).find((m) => m.role === 'Cross defender');
  assert.ok(straight && cross);
  assert.ok(straight.x > 0, 'straight defender on the attacker\'s line');
  assert.ok(depthOf('B', straight.z) > depthOf('B', cross.z));
});

test('singles base shades toward the side you hit to', () => {
  const right = run('singles', 'clear', singlesPlayers(), 'A1', 'straight').r.moves.A1;
  const left = run('singles', 'clear', singlesPlayers(), 'A1', 'cross').r.moves.A1;
  assert.ok(right.x > 0 && left.x < 0);
  // and further forward after a net shot than after a clear
  const net = run('singles', 'net', [{ id: 'A1', x: 0.5, z: 1.5 }, { id: 'B1', x: 0, z: -3.5 }], 'A1').r.moves.A1;
  assert.ok(depthOf('A', net.z) < depthOf('A', right.z));
});

test('serve setup follows the even/odd rule and the diagonal', () => {
  const even = serveSetup({ mode: 'doubles', servingTeam: 'A', score: 'even' });
  assert.ok(even.A1.x > 0, 'Blue serves from their right (+x) on even');
  assert.ok(even.B1.x < 0, 'receiver diagonally opposite');
  const odd = serveSetup({ mode: 'doubles', servingTeam: 'B', score: 'odd' });
  assert.ok(odd.B1.x > 0, 'Orange\'s left is +x');
  const notes = checkShot({
    mode: 'doubles', shot: 'serveShort', contact: even.A1, hitterTeam: 'A',
    target: defaultTarget({ mode: 'doubles', shot: 'serveShort', contact: even.A1, hitterTeam: 'A', direction: 't' }),
    score: 'even',
  });
  assert.equal(notes.filter((n) => n.level === 'warn').length, 0);
  const wrongBox = checkShot({
    mode: 'doubles', shot: 'serveShort', contact: even.A1, hitterTeam: 'A',
    target: { x: -0.5, z: -2.5 }, score: 'odd',
  });
  assert.ok(wrongBox.some((n) => /left service court/.test(n.text)));
});

test('out calls: singles tramline and doubles long service line', () => {
  const wide = checkShot({ mode: 'singles', shot: 'clear', contact: { x: 0, z: 5 }, hitterTeam: 'A', target: { x: 2.8, z: -6 } });
  assert.ok(wide.some((n) => /tramlines/.test(n.text)));
  const longServe = checkShot({ mode: 'doubles', shot: 'serveHigh', contact: { x: 0.5, z: 2.2 }, hitterTeam: 'A', target: { x: -1, z: -6.3 }, score: 'even' });
  assert.ok(longServe.some((n) => /long service line/.test(n.text)));
});

test('only the receiver may return a serve, even when the partner is nearer', () => {
  for (const score of ['even', 'odd']) {
    for (const shot of ['serveHigh', 'serveShort']) {
      const pos = serveSetup({ mode: 'doubles', servingTeam: 'A', score });
      const players = Object.entries(pos).map(([id, p]) => ({ id, ...p }));
      const server = pos.A1;
      const contact = { x: server.x + 0.42, z: server.z - 0.35 };
      const target = defaultTarget({ mode: 'doubles', shot, contact, hitterTeam: 'A', direction: 'wide', server });
      const r = recommend({ mode: 'doubles', shot, players, hitterId: 'A1', target, contact });
      assert.equal(serveReceiver('doubles', 'A', server, players).id, 'B1', `${score} ${shot}`);
      assert.equal(r.receiverId, 'B1', `${score} ${shot}: the receiver plays the return`);
      if (shot === 'serveHigh') {
        // the receiver goes back to attack it; their partner takes the front
        assert.ok(depthOf('B', r.moves.B1.z) > 5, `${score}: receiver goes back`);
        assert.ok(depthOf('B', r.moves.B2.z) < 2.5, `${score}: partner takes the front`);
      }
    }
  }
});

test('a serve warns when nobody stands in the receiving service court', () => {
  const pos = serveSetup({ mode: 'doubles', servingTeam: 'A', score: 'even' });
  const players = Object.entries(pos).map(([id, p]) => ({ id, ...p }));
  const ok = checkShot({ mode: 'doubles', shot: 'serveShort', contact: pos.A1, hitterTeam: 'A', target: { x: -0.5, z: -2.5 }, score: 'even', server: pos.A1, players });
  assert.ok(!ok.some((n) => /receiver must stand/.test(n.text)));
  // move the receiver over to the wrong half
  const moved = players.map((p) => (p.id === 'B1' ? { ...p, x: 1.2 } : p.id === 'B2' ? { ...p, x: 1.0 } : p));
  const bad = checkShot({ mode: 'doubles', shot: 'serveShort', contact: pos.A1, hitterTeam: 'A', target: { x: -0.5, z: -2.5 }, score: 'even', server: pos.A1, players: moved });
  assert.ok(bad.some((n) => /receiver must stand/.test(n.text)));
});

test('the server must stand inside their service court', () => {
  const t = { x: -0.5, z: -3 };
  const wide = checkShot({ mode: 'doubles', shot: 'serveHigh', contact: { x: 3.3, z: 3 }, hitterTeam: 'A', target: t, score: 'even', server: { x: 3.3, z: 3 } });
  assert.ok(wide.some((n) => /inside their service court/.test(n.text)), 'past the sideline');
  const deep = checkShot({ mode: 'doubles', shot: 'serveHigh', contact: { x: 1, z: 6.3 }, hitterTeam: 'A', target: t, score: 'even', server: { x: 1, z: 6.3 } });
  assert.ok(deep.some((n) => /inside their service court/.test(n.text)), 'behind the doubles long service line');
  const singlesDeep = checkShot({ mode: 'singles', shot: 'serveHigh', contact: { x: 1, z: 6.3 }, hitterTeam: 'A', target: { x: -1, z: -6 }, score: 'even', server: { x: 1, z: 6.3 } });
  assert.ok(!singlesDeep.some((n) => /inside their service court/.test(n.text)), 'singles court runs to the back line');
});
