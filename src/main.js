import * as THREE from 'three';
import './styles.css';
import {
  createScene, createPlayer, createShuttle, createTarget, createArrow, createGhost,
  createPath, flightCurve, COLORS, CAMERAS,
} from './scene.js';
import {
  SHOTS, SHOT_ORDER, TEAMS, recommend, defaultTarget, checkShot, serveSetup, teamOf, depthOf,
} from './rules.js';
import { RULES_DOC } from './rulesDoc.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#court');
const { renderer, scene, camera, controls, dragPlane, resize } = createScene(canvas);

// ------------------------------------------------------------------ state

const START = {
  doubles: { A1: { x: 1.1, z: 5.3 }, A2: { x: -0.6, z: 2.2 }, B1: { x: -1.3, z: -3.3 }, B2: { x: 1.3, z: -3.3 } },
  singles: { A1: { x: 0.9, z: 5.5 }, B1: { x: 0, z: -3.6 } },
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
  phase: 'setup',
  result: null,
};

const activeIds = () => (state.mode === 'doubles' ? [...ALL_IDS] : ['A1', 'B1']);

// ------------------------------------------------------------------ objects

const players = {};
for (const id of ALL_IDS) {
  const p = createPlayer(id);
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

// ------------------------------------------------------------------ helpers

function contactFor(id) {
  const p = state.setup[id];
  const sign = TEAMS[teamOf(id)].sign;
  // a little to the player's right and in front of them
  return { x: p.x + 0.42 * sign, z: p.z - 0.35 * sign };
}

function nearestOnSide(pt) {
  const side = pt.z >= 0 ? 'A' : 'B';
  let best = null;
  for (const id of activeIds()) {
    if (teamOf(id) !== side) continue;
    const p = state.setup[id];
    const d = (p.x - pt.x) ** 2 + (p.z - pt.z) ** 2;
    if (!best || d < best.d) best = { id, d };
  }
  return best?.id ?? state.hitterId;
}

function refreshTarget() {
  if (state.targetManual) return;
  state.target = defaultTarget({
    mode: state.mode, shot: state.shot, contact: state.contact,
    hitterTeam: teamOf(state.hitterId), direction: state.direction,
  });
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
  shuttle.model.rotation.set(0, 0, 0);
  shuttle.handle.position.set(state.contact.x, 0.011, state.contact.z);
  shuttle.stem.position.set(state.contact.x, 0, state.contact.z);
  shuttle.stem.scale.y = h;
  shuttle.stem.computeLineDistances();
  target.group.position.set(state.target.x, 0, state.target.z);
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
}

// ------------------------------------------------------------------ tweens

const tweens = [];
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
function tween(dur, update, delay = 0) {
  return new Promise((resolve) => {
    tweens.push({ start: performance.now() + delay, dur, update, resolve });
  });
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
  if (highlightId) {
    const ring = players[highlightId].ring;
    const k = 1 + 0.18 * Math.sin(now / 120);
    ring.scale.set(k, k, k);
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
  result.notes = checkShot({
    mode: state.mode, shot: state.shot, contact: state.contact,
    hitterTeam: teamOf(state.hitterId), target: state.target, score: state.score,
  });
  state.result = result;
  state.phase = 'shown';
  renderResult();
  syncButtons();

  clearOverlay();
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
    const p = curve.getPoint(t);
    shuttle.group.position.copy(p);
    curve.getTangent(Math.min(t, 0.999), dir);
    shuttle.model.quaternion.setFromUnitVectors(down, dir.normalize());
  });
  const moves = activeIds().map((id) => {
    const from = { ...state.setup[id] };
    const to = result.moves[id];
    if (!to) return null;
    const g = players[id].group;
    return tween(1300, (t) => {
      const e = ease(t);
      g.position.set(from.x + (to.x - from.x) * e, 0, from.z + (to.z - from.z) * e);
    }, 150);
  });
  await Promise.all([shuttleFlight, ...moves]);
  animating = false;
}

function backToSetup() {
  state.phase = 'setup';
  state.result = null;
  clearOverlay();
  placeAll();
  renderResult();
  syncButtons();
}

const NEXT_SHOT = { up: 'smash', attack: 'block', net: 'lift', flat: 'drive' };

function nextShot() {
  if (state.phase !== 'shown' || !state.result) return;
  const s = SHOTS[state.shot];
  for (const id of activeIds()) {
    const m = state.result.moves[id];
    if (m) state.setup[id] = { x: m.x, z: m.z };
  }
  // The receiver nearest the shuttle plays the next shot from where it arrived.
  const arrive = { ...state.target };
  const recvTeam = arrive.z >= 0 ? 'A' : 'B';
  const lim = (v, a) => Math.max(-a, Math.min(a, v));
  arrive.x = lim(arrive.x, 3.0);
  arrive.z = recvTeam === 'A' ? lim(Math.max(arrive.z, 0.6), 6.6) : lim(Math.min(arrive.z, -0.6), 6.6);
  state.contact = arrive;
  state.hitterId = nearestOnSide(arrive);
  state.shot = state.shot === 'drop' || state.shot === 'net' ? 'lift' : NEXT_SHOT[s.cls];
  if (state.shot === 'block' && state.mode === 'singles') state.shot = 'lift';
  state.direction = 'straight';
  state.targetManual = false;
  refreshTarget();
  backToSetup();
  renderControls();
}

function resetAll() {
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
  state.contact = { ...pos[`${team}1`] };
  state.contact.z -= 0.2 * TEAMS[team].sign;
  state.targetManual = false;
  if (!['t', 'body', 'wide'].includes(state.direction)) state.direction = 't';
  refreshTarget();
  backToSetup();
  renderControls();
}

// ------------------------------------------------------------------ drag

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

canvas.addEventListener('pointerdown', (e) => {
  if (animating) return;
  pick(e);
  // Shuttle and target win over players, which stand close to them.
  const hit = raycaster.intersectObjects([target.hit, shuttle.handle], false)[0]
    ?? raycaster.intersectObjects(activeIds().map((id) => players[id].hit), false)[0];
  if (!hit) return;
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
  const p = floorPoint();
  if (!p) return;
  const lim = (v, a) => Math.max(-a, Math.min(a, v));
  if (drag.id === 'target') {
    const hitSide = TEAMS[teamOf(state.hitterId)].sign;
    state.target = { x: lim(p.x, 3.9), z: hitSide > 0 ? lim(Math.min(p.z, -0.2), 7.6) : lim(Math.max(p.z, 0.2), 7.6) };
    state.targetManual = true;
  } else if (drag.id === 'shuttle') {
    state.contact = { x: lim(p.x, 3.6), z: lim(p.z, 7.4) };
    if (Math.abs(state.contact.z) < 0.15) state.contact.z = state.contact.z < 0 ? -0.15 : 0.15;
    const prevTeam = teamOf(state.hitterId);
    state.hitterId = nearestOnSide(state.contact);
    if (teamOf(state.hitterId) !== prevTeam) state.targetManual = false;
    refreshTarget();
    renderHitters();
  } else {
    const sign = TEAMS[teamOf(drag.id)].sign;
    const z = sign > 0 ? Math.max(p.z, 0.35) : Math.min(p.z, -0.35);
    state.setup[drag.id] = { x: lim(p.x, 3.6), z: lim(z, 7.6) };
    if (drag.id === state.hitterId) {
      state.contact = contactFor(drag.id);
      refreshTarget();
    }
  }
  placeAll();
});

function endDrag(e) {
  if (!drag) return;
  // A tap on a player gives them the shuttle.
  if (!drag.moved && ALL_IDS.includes(drag.id)) setHitter(drag.id);
  drag = null;
  controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ------------------------------------------------------------------ UI

function setHitter(id) {
  if (state.phase === 'shown') backToSetup();
  const changedTeam = teamOf(id) !== teamOf(state.hitterId);
  state.hitterId = id;
  state.contact = contactFor(id);
  if (changedTeam || !state.targetManual) state.targetManual = false;
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

let highlightId = null;
function setHighlight(id) {
  if (highlightId) players[highlightId].ring.scale.set(1, 1, 1);
  highlightId = id;
}

const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function renderResult() {
  const el = $('#result');
  const r = state.result;
  if (!r) {
    el.innerHTML = '';
    return;
  }
  const form = Object.entries(r.formation)
    .map(([t, f]) => `<span>${t === 'A' ? 'Blue' : 'Orange'}: ${esc(f)}</span>`).join('');
  const notes = (r.notes ?? []).map((n) => `<p class="note ${n.level}">${esc(n.text)}</p>`).join('');
  // Hitting side first.
  const H = teamOf(state.hitterId);
  const order = activeIds().sort((a, b) => (teamOf(a) === H ? 0 : 1) - (teamOf(b) === H ? 0 : 1));
  const cards = order.map((id) => {
    const m = r.moves[id];
    if (!m) return '';
    const who = id === state.hitterId ? ' (hit the shot)' : '';
    return `<article class="card ${teamOf(id)}" data-id="${id}">
      <h3>${NAMES[id]}${who}<em>${esc(m.role)}</em></h3>
      <p>${esc(m.text)}</p></article>`;
  }).join('');
  el.innerHTML = `<div class="summary">${esc(r.summary)}<div class="formation">${form}</div></div>${notes}${cards}`;
  const panel = el.closest('.panel');
  panel.scrollTo({ top: el.offsetTop - panel.offsetTop - 12, behavior: 'smooth' });
  for (const c of el.querySelectorAll('.card')) {
    c.addEventListener('mouseenter', () => setHighlight(c.dataset.id));
    c.addEventListener('mouseleave', () => setHighlight(null));
    c.addEventListener('click', () => setHighlight(highlightId === c.dataset.id ? null : c.dataset.id));
  }
}

for (const b of document.querySelectorAll('[data-mode]')) {
  b.onclick = () => {
    if (state.mode === b.dataset.mode) return;
    state.mode = b.dataset.mode;
    resetAll();
  };
}
for (const b of document.querySelectorAll('[data-score]')) {
  b.onclick = () => {
    state.score = b.dataset.score;
    applyServeSetup();
  };
}
$('#setupServe').onclick = applyServeSetup;
$('#show').onclick = () => (state.phase === 'shown' ? backToSetup() : show());
$('#next').onclick = nextShot;
$('#reset').onclick = resetAll;

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
window.__courtwise = { state, show, nextShot, resetAll, depthOf, camera, THREE };

// ------------------------------------------------------------------ boot

resetAll();
requestAnimationFrame(tick);
setTimeout(() => $('#hint').classList.add('gone'), 9000);
