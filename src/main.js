import * as THREE from 'three';
import './styles.css';
import {
  createScene, createPlayer, createShuttle, createTarget, createArrow, createGhost,
  createPath, createSnapMarker, textSprite, flightCurve, COLORS, CAMERAS,
} from './scene.js';
import {
  SHOTS, SHOT_ORDER, TEAMS, recommend, defaultTarget, checkShot, serveSetup, teamOf, depthOf, zOf,
} from './rules.js';
import { shuttleSnaps, serveTargetSnaps, playerSnaps, nearest } from './snaps.js';
import { PLAYS } from './plays.js';
import { RULES_DOC } from './rulesDoc.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#court');
const { renderer, scene, camera, controls, dragPlane, resize } = createScene(canvas);

// ------------------------------------------------------------------ state

const START = {
  doubles: { A1: { x: 2.2, z: 5.9 }, A2: { x: 0, z: 2.1 }, B1: { x: -1.3, z: -3.3 }, B2: { x: 1.3, z: -3.3 } },
  singles: { A1: { x: 1.8, z: 5.9 }, B1: { x: 0, z: -3.6 } },
};
const ALL_IDS = ['A1', 'A2', 'B1', 'B2'];
const NAMES = { A1: 'Blue 1', A2: 'Blue 2', B1: 'Orange 1', B2: 'Orange 2' };

const state = {
  mode: 'doubles',
  setup: structuredClone(START.doubles), // positions the user arranged
  hitterId: 'A1',
  contact: { x: 0, z: 0 },
  shot: 'smash',
  direction: 'straight',
  target: { x: 0, z: 0 },
  targetManual: false,
  score: 'even',
  snap: true,
  phase: 'setup',
  result: null,
};

const activeIds = () => (state.mode === 'doubles' ? [...ALL_IDS] : ['A1', 'B1']);
const lim = (v, a) => Math.max(-a, Math.min(a, v));

// ------------------------------------------------------------------ objects

const players = {};
for (const id of ALL_IDS) {
  const p = createPlayer(id);
  p.walk = 0; // footwork cycle phase
  players[id] = p;
  scene.add(p.group);
}
const shuttle = createShuttle();
scene.add(shuttle.group, shuttle.handle, shuttle.stem);
const target = createTarget();
scene.add(target.group);
let pathMesh = null;
const overlay = new THREE.Group(); // ghosts + arrows
scene.add(overlay);
const tags = {}; // role tags above players

const markers = Array.from({ length: 9 }, () => {
  const m = createSnapMarker();
  m.visible = false;
  scene.add(m);
  return m;
});

// ------------------------------------------------------------------ helpers

// The shuttle sits a little to the hitter's right and in front of them.
const OFFSET = { side: 0.42, fwd: 0.35 };
function contactFor(id) {
  const p = state.setup[id];
  const sign = TEAMS[teamOf(id)].sign;
  return { x: p.x + OFFSET.side * sign, z: p.z - OFFSET.fwd * sign };
}
// Where the hitter stands to play a shuttle at contact point c.
function standFor(id, c) {
  const team = teamOf(id);
  const sign = TEAMS[team].sign;
  const d = Math.max(0.5, Math.min(7.0, depthOf(team, c.z) + OFFSET.fwd));
  return { x: lim(c.x - OFFSET.side * sign, 3.3), z: zOf(team, d) };
}

function nearestOnSide(pt, positions = state.setup) {
  const side = pt.z >= 0 ? 'A' : 'B';
  let best = null;
  for (const id of activeIds()) {
    if (teamOf(id) !== side) continue;
    const p = positions[id];
    const d = (p.x - pt.x) ** 2 + (p.z - pt.z) ** 2;
    if (!best || d < best.d) best = { id, d };
  }
  return best?.id ?? state.hitterId;
}

function refreshTarget() {
  if (state.targetManual) return;
  state.target = defaultTarget({
    mode: state.mode, shot: state.shot, contact: state.contact,
    hitterTeam: teamOf(state.hitterId), direction: state.direction, server: state.setup[state.hitterId],
  });
}

// Face a point. Players never turn their back on the net: if the point is on their
// own side (their partner hitting), they look across at the opponents instead.
function face(id, pt) {
  const team = teamOf(id);
  const g = players[id].group.position;
  let look = pt;
  if (Math.sign(pt.z) === TEAMS[team].sign && id !== state.hitterId) look = { x: pt.x * 0.5, z: zOf(team === 'A' ? 'B' : 'A', 3.5) };
  if (id === state.hitterId && state.phase === 'setup') look = state.target;
  const dx = look.x - g.x;
  const dz = look.z - g.z;
  if (Math.hypot(dx, dz) < 0.1) return;
  players[id].body.rotation.y = Math.atan2(-dx, -dz);
}

function placeAll() {
  for (const id of ALL_IDS) {
    const on = activeIds().includes(id);
    players[id].group.visible = on;
    if (on && state.phase === 'setup') {
      players[id].group.position.set(state.setup[id].x, 0, state.setup[id].z);
    }
  }
  const h = SHOTS[state.shot].contact;
  shuttle.group.position.set(state.contact.x, h, state.contact.z);
  shuttle.model.quaternion.identity();
  shuttle.handle.position.set(state.contact.x, 0.011, state.contact.z);
  shuttle.stem.position.set(state.contact.x, 0, state.contact.z);
  shuttle.stem.scale.y = h;
  shuttle.stem.computeLineDistances();
  target.group.position.set(state.target.x, 0, state.target.z);
  for (const id of activeIds()) face(id, state.contact);
  drawPath();
}

function curveFor() {
  const s = SHOTS[state.shot];
  const from = new THREE.Vector3(state.contact.x, s.contact, state.contact.z);
  const endY = ['smash', 'drive', 'kill', 'push'].includes(state.shot) ? 0.9 : 0.05;
  const to = new THREE.Vector3(state.target.x, endY, state.target.z);
  return flightCurve(from, to, s.apex);
}

function drawPath() {
  if (pathMesh) {
    scene.remove(pathMesh);
    pathMesh.geometry.dispose();
  }
  pathMesh = createPath(curveFor());
  scene.add(pathMesh);
}

function clearOverlay() {
  for (const c of [...overlay.children]) {
    overlay.remove(c);
    c.traverse((o) => o.geometry?.dispose());
  }
  for (const id of Object.keys(tags)) {
    players[id].group.remove(tags[id]);
    tags[id].material.map.dispose();
    delete tags[id];
  }
  $('#notes').innerHTML = '';
}

// ------------------------------------------------------------------ tweens

const tweens = [];
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
function tween(dur, update, delay = 0) {
  return new Promise((resolve) => {
    tweens.push({ start: performance.now() + delay, dur, update, resolve });
  });
}

// Move a player to `to`, with footwork, over `dur` ms.
function walk(id, to, dur = 1300, delay = 150) {
  const p = players[id];
  const from = { x: p.group.position.x, z: p.group.position.z };
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  if (dist < 0.05) return Promise.resolve();
  let last = 0;
  return tween(dur, (t) => {
    const e = ease(t);
    p.group.position.set(from.x + (to.x - from.x) * e, 0, from.z + (to.z - from.z) * e);
    p.walk += (e - last) * dist * 7; // about one stride cycle per 0.9 m
    last = e;
    const amount = Math.min(1, dist / 1.2) * Math.sin(Math.PI * t);
    p.pose(p.walk, amount);
  }, delay).then(() => p.pose(0, 0));
}

function tick(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    const t = Math.min(Math.max((now - tw.start) / tw.dur, 0), 1);
    if (now >= tw.start) tw.update(t);
    if (t >= 1) {
      tweens.splice(i, 1);
      tw.resolve();
    }
  }
  if (animating) {
    // Everyone watches the shuttle in flight.
    const sp = shuttle.group.position;
    for (const id of activeIds()) face(id, { x: sp.x, z: sp.z });
  }
  resize();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------------ show / next

let animating = false;

async function show() {
  if (animating) return;
  const s = SHOTS[state.shot];
  const playersArr = activeIds().map((id) => ({ id, ...state.setup[id] }));
  const result = recommend({
    mode: state.mode, shot: state.shot, players: playersArr,
    hitterId: state.hitterId, target: state.target, contact: state.contact,
  });
  const notes = checkShot({
    mode: state.mode, shot: state.shot, contact: state.contact,
    hitterTeam: teamOf(state.hitterId), target: state.target, score: state.score, server: state.setup[state.hitterId],
  }).filter((n) => n.level === 'warn');
  state.result = result;
  state.phase = 'shown';
  syncButtons();

  clearOverlay();
  $('#notes').innerHTML = notes.map((n) => `<p>${esc(n.text)}</p>`).join('');
  for (const id of activeIds()) {
    const from = state.setup[id];
    const to = result.moves[id];
    if (!to) continue;
    const color = COLORS[teamOf(id)];
    overlay.add(createGhost(from, color));
    overlay.add(createArrow(from, to, color));
  }

  animating = true;
  const curve = curveFor();
  const flight = state.shot === 'smash' || state.shot === 'kill' ? 550 : s.cls === 'up' ? 1500 : 1000;
  const dir = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const shuttleFlight = tween(flight, (t) => {
    shuttle.group.position.copy(curve.getPoint(t));
    curve.getTangent(Math.min(t, 0.999), dir);
    shuttle.model.quaternion.setFromUnitVectors(down, dir.normalize());
  });
  const moves = activeIds().map((id) => (result.moves[id] ? walk(id, result.moves[id]) : null));
  await Promise.all([shuttleFlight, ...moves]);
  animating = false;

  for (const id of activeIds()) {
    face(id, state.target);
    const m = result.moves[id];
    if (!m) continue;
    const tag = textSprite(m.role);
    tag.position.y = 2.32;
    players[id].group.add(tag);
    tags[id] = tag;
  }
}

function backToSetup() {
  state.phase = 'setup';
  state.result = null;
  clearOverlay();
  for (const id of ALL_IDS) players[id].pose(0, 0);
  placeAll();
  syncButtons();
}

// Commit the shown positions and hand the shuttle to whoever receives it.
function advance(nextShotKey) {
  for (const id of activeIds()) {
    const m = state.result?.moves[id];
    if (m) state.setup[id] = { x: m.x, z: m.z };
  }
  const arrive = { ...state.target };
  const recvTeam = arrive.z >= 0 ? 'A' : 'B';
  arrive.x = lim(arrive.x, 3.0);
  arrive.z = zOf(recvTeam, Math.max(0.6, Math.min(6.6, depthOf(recvTeam, arrive.z))));
  state.contact = arrive;
  state.hitterId = nearestOnSide(arrive);
  state.shot = nextShotKey;
  state.targetManual = false;
}

const NEXT_SHOT = { up: 'smash', attack: 'block', net: 'lift', flat: 'drive' };

function nextShot() {
  if (state.phase !== 'shown' || !state.result) return;
  const s = SHOTS[state.shot];
  let next = state.shot === 'drop' || state.shot === 'net' ? 'lift' : NEXT_SHOT[s.cls];
  if (next === 'block' && state.mode === 'singles') next = 'lift';
  advance(next);
  state.direction = 'straight';
  refreshTarget();
  backToSetup();
  renderControls();
}

function resetAll() {
  stopPlay();
  state.setup = structuredClone(START[state.mode]);
  state.hitterId = 'A1';
  state.shot = 'smash';
  state.direction = 'straight';
  state.targetManual = false;
  state.contact = contactFor('A1');
  refreshTarget();
  backToSetup();
  renderControls();
}

function applyServeSetup() {
  const team = teamOf(state.hitterId);
  const pos = serveSetup({ mode: state.mode, servingTeam: team, score: state.score });
  Object.assign(state.setup, pos);
  state.hitterId = `${team}1`;
  state.contact = contactFor(`${team}1`);
  state.targetManual = false;
  if (!['t', 'body', 'wide'].includes(state.direction)) state.direction = 't';
  refreshTarget();
  backToSetup();
  renderControls();
}

// ------------------------------------------------------------------ plays

let play = null; // { def, i, paused, snapshots, timer }

function snapshot() {
  return structuredClone({
    setup: state.setup, hitterId: state.hitterId, contact: state.contact, shot: state.shot,
    direction: state.direction, target: state.target, score: state.score,
  });
}
function restore(snap) {
  Object.assign(state, structuredClone(snap));
  state.targetManual = true;
}

function startPlay(def) {
  stopPlay();
  if (state.mode !== def.mode) state.mode = def.mode;
  state.setup = structuredClone(START[def.mode]);
  if (def.start.serve) {
    state.score = def.start.score;
    state.hitterId = `${def.start.serve}1`;
    Object.assign(state.setup, serveSetup({ mode: def.mode, servingTeam: def.start.serve, score: def.start.score }));
  } else {
    Object.assign(state.setup, structuredClone(def.start.setup));
    state.hitterId = def.start.hitter;
  }
  state.contact = contactFor(state.hitterId);
  play = { def, i: 0, paused: false, snapshots: [] };
  backToSetup();
  renderControls();
  $('#playbar').hidden = false;
  renderPlays();
  runStep();
}

function aimStep(step) {
  state.shot = step.shot;
  state.direction = step.dir;
  state.targetManual = false;
  if (step.to) {
    const recv = teamOf(state.hitterId) === 'A' ? 'B' : 'A';
    state.target = { x: step.to.x, z: zOf(recv, step.to.d) };
    state.targetManual = true;
  } else {
    refreshTarget();
  }
}

async function runStep() {
  if (!play) return;
  const { def } = play;
  const step = def.steps[play.i];
  play.snapshots[play.i] = snapshot();
  aimStep(step);
  backToSetup();
  renderControls();
  updateCaption();
  const token = (play.token = Symbol('step'));
  await new Promise((r) => setTimeout(r, 350));
  if (!play || play.token !== token) return;
  await show();
  if (!play || play.token !== token) return;
  const queued = play.queued;
  play.queued = null;
  if (queued === 'next') stepForward();
  else if (queued === 'prev') stepBack();
  else schedule();
}

function schedule() {
  clearTimeout(play.timer);
  if (play.paused) return;
  play.timer = setTimeout(() => stepForward(), 2200);
}

function stepForward() {
  if (!play) return;
  if (animating) {
    play.queued = 'next';
    return;
  }
  clearTimeout(play.timer);
  if (play.i >= play.def.steps.length - 1) {
    play.paused = true;
    updateCaption(true);
    return;
  }
  advance(play.def.steps[play.i + 1].shot);
  play.i += 1;
  runStep();
}

function stepBack() {
  if (!play || play.i === 0) return;
  if (animating) {
    play.queued = 'prev';
    return;
  }
  clearTimeout(play.timer);
  play.i -= 1;
  restore(play.snapshots[play.i]);
  runStep();
}

function togglePause() {
  if (!play) return;
  if (play.paused && play.i >= play.def.steps.length - 1) {
    startPlay(play.def); // replay from the start
    return;
  }
  play.paused = !play.paused;
  updateCaption();
  if (!play.paused && !animating) stepForward();
}

function stopPlay() {
  if (!play) return;
  clearTimeout(play.timer);
  play = null;
  $('#playbar').hidden = true;
  renderPlays();
}

function updateCaption(done = false) {
  if (!play) return;
  const { def, i } = play;
  $('#stepCount').innerHTML = `<i class="ptitle">${esc(def.title)} · </i>Shot ${i + 1} of ${def.steps.length}`;
  $('#stepNote').textContent = def.steps[i].note;
  const pp = $('#playPause');
  const ended = done || (play.paused && i >= def.steps.length - 1);
  pp.textContent = ended ? 'Replay' : play.paused ? 'Play' : 'Pause';
  pp.setAttribute('aria-label', pp.textContent);
}

function renderPlays() {
  const el = $('#plays');
  el.innerHTML = '';
  for (const def of PLAYS) {
    const b = document.createElement('button');
    b.className = `play${play?.def.id === def.id ? ' on' : ''}`;
    b.innerHTML = `<em>${def.mode}</em><b>${esc(def.title)}</b><span>${esc(def.blurb)}</span>`;
    b.onclick = () => startPlay(def);
    el.append(b);
  }
}

// ------------------------------------------------------------------ drag + snap

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null;

function pick(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}

function floorPoint() {
  const v = new THREE.Vector3();
  return raycaster.ray.intersectPlane(dragPlane, v) ? v : null;
}

function snapSet(id, pt) {
  if (id === 'target') {
    const recv = teamOf(state.hitterId) === 'A' ? 'B' : 'A';
    return SHOTS[state.shot].serve
      ? serveTargetSnaps(state.mode, recv, state.setup[state.hitterId].x)
      : shuttleSnaps(state.mode, recv);
  }
  if (id === 'shuttle') return shuttleSnaps(state.mode, pt.z >= 0 ? 'A' : 'B');
  return playerSnaps(state.mode, teamOf(id));
}

function showMarkers(spots, active) {
  markers.forEach((m, i) => {
    const s = spots[i];
    m.visible = !!s;
    if (!s) return;
    m.position.set(s.x, 0.014, s.z);
    m.material.opacity = s === active ? 0.95 : 0.35;
    m.scale.setScalar(s === active ? 1.35 : 1);
  });
}
const hideMarkers = () => markers.forEach((m) => { m.visible = false; });

canvas.addEventListener('pointerdown', (e) => {
  if (animating) return;
  pick(e);
  // Shuttle and target win over players, which stand close to them.
  const hit = raycaster.intersectObjects([target.hit, shuttle.handle, shuttle.grab], false)[0]
    ?? raycaster.intersectObjects(activeIds().map((id) => players[id].hit), false)[0];
  if (!hit) return;
  stopPlay();
  if (state.phase === 'shown') backToSetup();
  drag = { id: hit.object.userData.dragId, moved: false, sx: e.clientX, sy: e.clientY };
  controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  $('#hint').classList.add('gone');
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
  drag.moved = true;
  pick(e);
  const raw = floorPoint();
  if (!raw) return;
  let p = { x: raw.x, z: raw.z };

  if (drag.id === 'target') {
    const hitSide = TEAMS[teamOf(state.hitterId)].sign;
    p = { x: lim(p.x, 3.9), z: hitSide > 0 ? lim(Math.min(p.z, -0.2), 7.6) : lim(Math.max(p.z, 0.2), 7.6) };
  } else if (drag.id === 'shuttle') {
    p = { x: lim(p.x, 3.6), z: lim(p.z, 7.4) };
    if (Math.abs(p.z) < 0.15) p.z = p.z < 0 ? -0.15 : 0.15;
  } else {
    const sign = TEAMS[teamOf(drag.id)].sign;
    p = { x: lim(p.x, 3.6), z: lim(sign > 0 ? Math.max(p.z, 0.35) : Math.min(p.z, -0.35), 7.6) };
  }
  if (state.snap) {
    const spots = snapSet(drag.id, p);
    const s = nearest(spots, p);
    showMarkers(spots, s);
    p = { x: s.x, z: s.z };
  }

  if (drag.id === 'target') {
    state.target = p;
    state.targetManual = true;
  } else if (drag.id === 'shuttle') {
    state.contact = p;
    const prevTeam = teamOf(state.hitterId);
    state.hitterId = nearestOnSide(p);
    if (teamOf(state.hitterId) !== prevTeam) state.targetManual = false;
    refreshTarget();
    renderHitters();
  } else {
    state.setup[drag.id] = p;
    if (drag.id === state.hitterId) {
      state.contact = contactFor(drag.id);
      refreshTarget();
    }
  }
  placeAll();
});

function endDrag(e) {
  if (!drag) return;
  const { id, moved } = drag;
  drag = null;
  hideMarkers();
  controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  // A tap on a player gives them the shuttle.
  if (!moved && ALL_IDS.includes(id)) setHitter(id);
  // Dropping the shuttle: the hitter steps in behind it.
  if (moved && id === 'shuttle') {
    const h = state.hitterId;
    state.setup[h] = standFor(h, state.contact);
    walk(h, state.setup[h], 450, 0).then(() => face(h, state.target));
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ------------------------------------------------------------------ UI

function setHitter(id) {
  stopPlay();
  if (state.phase === 'shown') backToSetup();
  const changedTeam = teamOf(id) !== teamOf(state.hitterId);
  state.hitterId = id;
  state.contact = contactFor(id);
  if (changedTeam) state.targetManual = false;
  refreshTarget();
  placeAll();
  renderHitters();
}

function renderHitters() {
  const el = $('#hitters');
  el.innerHTML = '';
  for (const id of activeIds()) {
    const b = document.createElement('button');
    b.className = `chip${id === state.hitterId ? ' on' : ''}`;
    b.innerHTML = `<i style="background:${teamOf(id) === 'A' ? 'var(--blue)' : 'var(--orange)'}"></i>${NAMES[id]}`;
    b.setAttribute('aria-pressed', id === state.hitterId);
    b.onclick = () => setHitter(id);
    el.append(b);
  }
}

function renderShots() {
  const el = $('#shots');
  el.innerHTML = '';
  for (const key of SHOT_ORDER) {
    const b = document.createElement('button');
    b.textContent = SHOTS[key].label;
    b.className = key === state.shot ? 'on' : '';
    b.setAttribute('aria-pressed', key === state.shot);
    b.onclick = () => {
      stopPlay();
      const wasServe = SHOTS[state.shot].serve;
      state.shot = key;
      state.targetManual = false;
      if (SHOTS[key].serve && !wasServe) {
        applyServeSetup();
        return;
      }
      if (!SHOTS[key].serve && ['t', 'body', 'wide'].includes(state.direction)) state.direction = 'straight';
      refreshTarget();
      backToSetup();
      renderControls();
    };
    el.append(b);
  }
}

function renderDirections() {
  const serve = SHOTS[state.shot].serve;
  const opts = serve
    ? [['t', 'To the T'], ['body', 'Body'], ['wide', 'Wide']]
    : [['straight', 'Straight'], ['middle', 'Middle'], ['cross', 'Cross-court']];
  const el = $('#directions');
  el.innerHTML = '';
  for (const [key, label] of opts) {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = key === state.direction && !state.targetManual ? 'on' : '';
    b.onclick = () => {
      stopPlay();
      state.direction = key;
      state.targetManual = false;
      refreshTarget();
      backToSetup();
      renderDirections();
    };
    el.append(b);
  }
  $('#serveBox').hidden = !serve;
}

function renderControls() {
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.classList.toggle('on', b.dataset.mode === state.mode);
    b.setAttribute('aria-checked', b.dataset.mode === state.mode);
  }
  for (const b of document.querySelectorAll('[data-score]')) b.classList.toggle('on', b.dataset.score === state.score);
  renderHitters();
  renderShots();
  renderDirections();
}

function syncButtons() {
  $('#show').textContent = state.phase === 'shown' ? 'Back to setup' : 'Show where to go';
  $('#next').disabled = state.phase !== 'shown';
}

const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

for (const b of document.querySelectorAll('[data-mode]')) {
  b.onclick = () => {
    if (state.mode === b.dataset.mode) return;
    state.mode = b.dataset.mode;
    resetAll();
  };
}
for (const b of document.querySelectorAll('[data-score]')) {
  b.onclick = () => {
    stopPlay();
    state.score = b.dataset.score;
    applyServeSetup();
  };
}
$('#setupServe').onclick = () => { stopPlay(); applyServeSetup(); };
$('#show').onclick = () => {
  stopPlay();
  if (state.phase === 'shown') backToSetup();
  else show();
};
$('#next').onclick = () => { stopPlay(); nextShot(); };
$('#reset').onclick = resetAll;
$('#snap').onchange = (e) => { state.snap = e.target.checked; };
$('#playPause').onclick = togglePause;
$('#nextStep').onclick = () => { if (play) { play.paused = true; stepForward(); updateCaption(); } };
$('#prevStep').onclick = () => { if (play) { play.paused = true; stepBack(); } };
$('#stopPlay').onclick = () => { stopPlay(); backToSetup(); };

// Camera presets, eased.
for (const b of document.querySelectorAll('[data-cam]')) {
  b.onclick = () => {
    for (const o of document.querySelectorAll('[data-cam]')) o.classList.toggle('on', o === b);
    const c = CAMERAS[b.dataset.cam];
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    const p1 = new THREE.Vector3(...c.pos);
    const t1 = new THREE.Vector3(...c.target);
    tween(700, (t) => {
      const e = ease(t);
      camera.position.lerpVectors(p0, p1, e);
      controls.target.lerpVectors(t0, t1, e);
    });
  };
}

// Rules dialog.
$('#rulesBody').innerHTML = RULES_DOC.map((s) => `<h3>${esc(s.title)}</h3><ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('');
$('#openRules').onclick = () => $('#rules').showModal();
$('#closeRules').onclick = () => $('#rules').close();

// Debug handle for the console.
window.__courtwise = { state, show, nextShot, resetAll, startPlay, PLAYS, camera, THREE, get play() { return play; }, get animating() { return animating; } };

// ------------------------------------------------------------------ boot

renderPlays();
resetAll();
requestAnimationFrame(tick);
setTimeout(() => $('#hint').classList.add('gone'), 9000);
