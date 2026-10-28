// three.js scene: court, net, players, shuttle, markers.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COURT } from './rules.js';

export const COLORS = {
  A: 0x3b82f6,
  B: 0xf97316,
  court: 0x2f7d5b,
  surround: 0x1f2a33,
  line: 0xf4f4ef,
  target: 0xfacc15,
  path: 0xfde68a,
};

const LINE_W = 0.04;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e151b);
  scene.fog = new THREE.Fog(0x0e151b, 45, 90);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 9, 14);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = 4;
  controls.maxDistance = 40;

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1f2a33, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(5, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  scene.add(sun);

  buildCourt(scene);
  buildNet(scene);

  // Floor plane used for dragging.
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  return { renderer, scene, camera, controls, dragPlane, resize };
}

function buildCourt(scene) {
  const surround = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 30),
    new THREE.MeshStandardMaterial({ color: COLORS.surround, roughness: 0.95 }),
  );
  surround.rotation.x = -Math.PI / 2;
  surround.position.y = -0.002;
  surround.receiveShadow = true;
  scene.add(surround);

  const L = COURT.halfLength;
  const W = COURT.doublesHalfWidth;
  const court = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2 + 1.0, L * 2 + 1.6),
    new THREE.MeshStandardMaterial({ color: COLORS.court, roughness: 0.85 }),
  );
  court.rotation.x = -Math.PI / 2;
  court.receiveShadow = true;
  scene.add(court);

  const mat = new THREE.MeshBasicMaterial({ color: COLORS.line });
  const line = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1) + LINE_W;
    const g = new THREE.PlaneGeometry(x1 === x2 ? LINE_W : len, x1 === x2 ? len : LINE_W);
    const m = new THREE.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x1 + x2) / 2, 0.003, (z1 + z2) / 2);
    scene.add(m);
  };
  const S = COURT.singlesHalfWidth;
  // sidelines (doubles and singles)
  for (const x of [-W, W, -S, S]) line(x, -L, x, L);
  for (const sgn of [1, -1]) {
    line(-W, sgn * L, W, sgn * L); // back boundary (and singles long service line)
    line(-W, sgn * COURT.doublesLongService, W, sgn * COURT.doublesLongService);
    line(-W, sgn * COURT.shortService, W, sgn * COURT.shortService);
    line(0, sgn * COURT.shortService, 0, sgn * L); // centre line
  }
}

function netTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(20,20,20,0.9)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(120, 15);
  return t;
}

function buildNet(scene) {
  const W = COURT.doublesHalfWidth;
  const top = COURT.netHeight;
  const depth = 0.76;
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2, depth),
    new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  net.position.set(0, top - depth / 2, 0);
  scene.add(net);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.075, 0.02), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  tape.position.set(0, top - 0.0375, 0);
  scene.add(tape);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.4, roughness: 0.4 });
  for (const x of [-W, W]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.55, 12), postMat);
    post.position.set(x, 1.55 / 2, 0);
    post.castShadow = true;
    scene.add(post);
  }
}

function labelSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = 'white';
  g.stroke();
  g.fillStyle = 'white';
  g.font = 'bold 64px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 68);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sprite.scale.set(0.42, 0.42, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// A jointed athlete in a ready stance. The group faces -z (toward the net for
// team A). Joints rotate about x: positive swings a limb forward (toward -z).
// `pose(phase, amount)` drives a footwork cycle; amount 0 is the still ready stance.
const SKIN = 0xd9a27e;
const SHORTS = 0x1f2937;
const SHOE = 0xf3f4f6;
const HAIR = 0x2b1d14;

function capsule(r, len, color, y) {
  const m = new THREE.Mesh(
    new THREE.CapsuleGeometry(r, len, 6, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
  );
  m.position.y = y;
  m.castShadow = true;
  return m;
}

function createRacket() {
  const racket = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x111827 }));
  grip.position.y = 0.06;
  racket.add(grip);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.26, 6), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6 }));
  shaft.position.y = 0.29;
  racket.add(shaft);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 32), new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 }));
  frame.scale.set(0.82, 1.15, 1);
  frame.position.y = 0.53;
  racket.add(frame);
  const strings = new THREE.Mesh(
    new THREE.CircleGeometry(0.095, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
  );
  strings.scale.set(0.82, 1.15, 1);
  strings.position.y = 0.53;
  racket.add(strings);
  racket.traverse((m) => { m.castShadow = true; });
  return racket;
}

export function createPlayer(id) {
  const team = id[0];
  const color = COLORS[team];
  const group = new THREE.Group();
  group.userData = { id, kind: 'player' };
  const shirt = color;

  const body = new THREE.Group(); // rotates to face the shuttle
  group.add(body);
  const hips = new THREE.Group();
  body.add(hips);
  const pelvis = capsule(0.13, 0.12, SHORTS, 0);
  pelvis.rotation.z = Math.PI / 2;
  pelvis.scale.set(1, 1, 0.8);
  hips.add(pelvis);

  const legs = [];
  for (const s of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.x = s * 0.1;
    hips.add(hip);
    const shortsLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.085, 0.24, 12), new THREE.MeshStandardMaterial({ color: SHORTS, roughness: 0.8 }));
    shortsLeg.position.y = -0.11;
    shortsLeg.castShadow = true;
    hip.add(shortsLeg);
    hip.add(capsule(0.068, 0.3, SKIN, -0.22));
    const knee = new THREE.Group();
    knee.position.y = -0.43;
    hip.add(knee);
    knee.add(capsule(0.056, 0.3, SKIN, -0.18));
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.048, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    sock.position.y = -0.36;
    knee.add(sock);
    const ankle = new THREE.Group();
    ankle.position.y = -0.42;
    knee.add(ankle);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.27), new THREE.MeshStandardMaterial({ color: SHOE, roughness: 0.5 }));
    shoe.position.set(0, -0.035, -0.06);
    shoe.castShadow = true;
    ankle.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.02, 0.275), new THREE.MeshStandardMaterial({ color: 0x6b7280 }));
    sole.position.set(0, -0.07, -0.06);
    ankle.add(sole);
    legs.push({ hip, knee, ankle, s });
  }

  const torso = new THREE.Group();
  hips.add(torso);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.145, 0.5, 16), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.6 }));
  chest.scale.z = 0.62;
  chest.position.y = 0.3;
  chest.castShadow = true;
  torso.add(chest);
  const shoulders = capsule(0.075, 0.3, shirt, 0.52);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.scale.set(1, 1, 0.8);
  torso.add(shoulders);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), new THREE.MeshStandardMaterial({ color: SKIN }));
  neck.position.y = 0.62;
  torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 }));
  head.scale.set(0.9, 1.08, 0.97);
  head.position.y = 0.77;
  head.castShadow = true;
  torso.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.9 }),
  );
  hair.scale.set(0.92, 1.05, 1.0);
  hair.position.set(0, 0.785, 0.008);
  hair.rotation.x = 0.25;
  torso.add(hair);

  const arms = [];
  for (const s of [1, -1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.22, 0.52, 0);
    torso.add(shoulder);
    shoulder.add(capsule(0.058, 0.07, shirt, -0.05)); // sleeve
    shoulder.add(capsule(0.045, 0.2, SKIN, -0.15));
    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    shoulder.add(elbow);
    elbow.add(capsule(0.04, 0.19, SKIN, -0.13));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshStandardMaterial({ color: SKIN }));
    hand.position.y = -0.27;
    elbow.add(hand);
    let racket = null;
    if (s === 1) {
      racket = createRacket();
      racket.position.y = -0.27;
      elbow.add(racket);
    }
    arms.push({ shoulder, elbow, racket, s });
  }

  // Thigh 0.43 m, shin 0.42 m, ankle to floor 0.075 m.
  const reach = (a, b) => 0.43 * Math.cos(a) + 0.42 * Math.cos(a - b) + 0.075;

  function pose(phase = 0, amount = 0) {
    const sw = Math.sin(phase) * amount;
    let lowest = 0;
    for (const leg of legs) {
      const k = leg.s === 1 ? sw : -sw;
      const a = 0.38 + 0.5 * k; // hip flexion
      const b = 0.75 + 0.45 * Math.max(0, -Math.cos(phase + (leg.s === 1 ? 0 : Math.PI))) * amount; // knee bend
      leg.hip.rotation.x = a;
      leg.hip.rotation.z = leg.s * 0.12; // feet a little wider than the hips
      leg.knee.rotation.x = -b;
      leg.ankle.rotation.x = b - a;
      leg.ankle.rotation.z = -leg.s * 0.12;
      lowest = Math.max(lowest, reach(a, b));
    }
    hips.position.y = lowest * Math.cos(0.12);
    hips.position.y += Math.abs(Math.sin(phase)) * 0.02 * amount;
    torso.rotation.x = -0.22 - 0.06 * amount; // lean forward
    for (const arm of arms) {
      const k = arm.s === 1 ? -sw : sw;
      if (arm.s === 1) {
        // racket arm: up in front, racket head up
        arm.shoulder.rotation.set(0.85 + 0.15 * k, 0, 0.55);
        arm.elbow.rotation.set(1.25, 0, 0);
        arm.racket.rotation.set(-(0.85 + 0.15 * k + 1.25) + 0.15 - torso.rotation.x, 0, -0.35);
      } else {
        // balance arm: forward, relaxed
        arm.shoulder.rotation.set(0.55 + 0.25 * k, 0, -0.35);
        arm.elbow.rotation.set(0.9, 0, 0);
      }
    }
  }
  pose();

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.42, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  group.add(ring);

  // Larger invisible hit target makes dragging easy on touch screens.
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.9, 12), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.95;
  hit.userData = { dragId: id };
  group.add(hit);

  const label = labelSprite(id[1], team === 'A' ? '#3b82f6' : '#f97316');
  label.scale.set(0.34, 0.34, 1);
  label.position.y = 2.0;
  group.add(label);

  body.rotation.y = team === 'A' ? 0 : Math.PI;
  return { group, body, ring, hit, pose, team };
}

// Floating text tag, e.g. a player's role.
export function textSprite(text, color = '#0e151b', bg = 'rgba(255,255,255,0.92)') {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '600 44px Inter, system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 48;
  c.width = w;
  c.height = 76;
  g.font = font;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(0, 0, w, 76, 38);
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  const h = 0.3;
  sprite.scale.set((h * w) / 76, h, 1);
  sprite.renderOrder = 11;
  return sprite;
}

// Faint floor markers for snap spots.
export function createSnapMarker() {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.21, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.014;
  return m;
}

// Shuttle: cork + skirt, plus a floor handle and a stem so its spot is readable.
export function createShuttle() {
  const group = new THREE.Group();
  const s = new THREE.Group();
  const cork = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  s.add(cork);
  const skirt = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.2, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xfafafa, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
  );
  skirt.rotation.x = Math.PI; // open end up, away from the cork
  skirt.position.y = 0.12;
  s.add(skirt);
  s.traverse((m) => { m.castShadow = true; });
  group.add(s);
  // Invisible sphere around the shuttle so it can be grabbed in the air too.
  const grab = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  grab.userData = { dragId: 'shuttle' };
  group.add(grab);

  const handle = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
  );
  handle.rotation.x = -Math.PI / 2;
  handle.userData = { dragId: 'shuttle' };
  const stemMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.7 });
  const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), stemMat);
  return { group, model: s, handle, stem, grab };
}

export function createTarget() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.target, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  group.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), mat);
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = 0.012;
  group.add(dot);
  const hit = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
  hit.rotation.x = -Math.PI / 2;
  hit.position.y = 0.02;
  hit.userData = { dragId: 'target' };
  group.add(hit);
  return { group, hit, ring };
}

// Floor arrow from a to b (both {x,z}) in a team colour.
export function createArrow(a, b, color) {
  const group = new THREE.Group();
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.25) return group;
  const head = 0.28;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false });
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.07, Math.max(len - head - 0.35, 0.01)), mat);
  shaft.rotation.x = -Math.PI / 2;
  const shaftLen = Math.max(len - head - 0.35, 0.01);
  shaft.position.set(0, 0.015, -(0.15 + shaftLen / 2));
  group.add(shaft);
  const tri = new THREE.Shape();
  tri.moveTo(-0.16, 0);
  tri.lineTo(0.16, 0);
  tri.lineTo(0, head);
  const tip = new THREE.Mesh(new THREE.ShapeGeometry(tri), mat);
  tip.rotation.x = -Math.PI / 2;
  tip.position.set(0, 0.016, -(0.15 + shaftLen));
  group.add(tip);
  group.position.set(a.x, 0, a.z);
  group.rotation.y = Math.atan2(-dx, -dz);
  return group;
}

export function createGhost(p, color) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(p.x, 0.012, p.z);
  return m;
}

// Flight path that clears the net and peaks near `apex`.
export function flightCurve(from, to, apex) {
  const mid = new THREE.Vector3((from.x + to.x) / 2, 0, (from.z + to.z) / 2);
  let ctrlY = Math.max(2 * apex - (from.y + to.y) / 2, Math.max(from.y, to.y));
  let curve;
  for (let i = 0; i < 12; i++) {
    mid.y = ctrlY;
    curve = new THREE.QuadraticBezierCurve3(from.clone(), mid.clone(), to.clone());
    // height where it crosses the net (z = 0)
    const t = from.z === to.z ? 0.5 : from.z / (from.z - to.z);
    const y = curve.getPoint(Math.min(Math.max(t, 0), 1)).y;
    if (y > COURT.netHeight + 0.12) break;
    ctrlY += 0.35;
  }
  return curve;
}

export function createPath(curve) {
  const geo = new THREE.TubeGeometry(curve, 64, 0.018, 8, false);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLORS.path, transparent: true, opacity: 0.75 }));
}

// fov is the vertical field of view. The TV view is the broadcast angle: high behind
// one baseline, looking down, on a long lens so both halves of the court look similar.
export const CAMERAS = {
  tv: { pos: [0, 14.5, 20.5], target: [0, 0, 1.3], fov: 30 },
  blue: { pos: [0, 8.5, 13.5], target: [0, 0, -0.5], fov: 45 },
  orange: { pos: [0, 8.5, -13.5], target: [0, 0, 0.5], fov: 45 },
  top: { pos: [0, 19, 0.01], target: [0, 0, 0], fov: 45 },
  side: { pos: [13, 6.5, 0], target: [0, 0, 0], fov: 45 },
};
