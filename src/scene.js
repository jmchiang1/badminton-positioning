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
  scene.fog = new THREE.Fog(0x0e151b, 30, 60);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 9, 14);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = 4;
  controls.maxDistance = 35;

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

// A simple player: body, head, racket, label, floor ring.
export function createPlayer(id) {
  const team = id[0];
  const color = COLORS[team];
  const group = new THREE.Group();
  group.userData = { id, kind: 'player' };

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 6, 16), mat);
  body.position.y = 0.22 + 0.85 / 2 + 0.05;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), new THREE.MeshStandardMaterial({ color: 0xf1d3b3, roughness: 0.6 }));
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);

  // Racket on the right hand. The group faces -z (toward the net for team A).
  const racket = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  handle.position.y = 0.17;
  racket.add(handle);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 24), new THREE.MeshStandardMaterial({ color: 0xe5e7eb }));
  frame.scale.set(0.85, 1.15, 1);
  frame.position.y = 0.47;
  racket.add(frame);
  racket.position.set(0.32, 1.05, -0.05);
  racket.rotation.z = -0.35;
  group.add(racket);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.42, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  group.add(ring);

  // Larger invisible hit target makes dragging easy on touch screens.
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2, 12), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1;
  hit.userData = { dragId: id };
  group.add(hit);

  const label = labelSprite(id[1], team === 'A' ? '#3b82f6' : '#f97316');
  label.position.y = 2.05;
  group.add(label);

  group.rotation.y = team === 'A' ? 0 : Math.PI;
  return { group, ring, hit, mat };
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

  const handle = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
  );
  handle.rotation.x = -Math.PI / 2;
  handle.userData = { dragId: 'shuttle' };
  const stemMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.7 });
  const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), stemMat);
  return { group, model: s, handle, stem };
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

export const CAMERAS = {
  blue: { pos: [0, 8.5, 13.5], target: [0, 0, -0.5] },
  orange: { pos: [0, 8.5, -13.5], target: [0, 0, 0.5] },
  top: { pos: [0, 19, 0.01], target: [0, 0, 0] },
  side: { pos: [13, 6.5, 0], target: [0, 0, 0] },
};
