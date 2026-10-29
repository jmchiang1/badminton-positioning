// Tournament arena around the court: LED advertising boards, tiered stands with a
// crowd, overhead light rigs and an end screen at each end. All drawn in code.
//
// The sponsors are made up on purpose. Real brand names and logos would make the
// public site look endorsed by that company; swap them in only with permission.
import * as THREE from 'three';

export const SPONSORS = [
  { name: 'COURTWISE OPEN', bg: '#00873f', fg: '#ffffff' },
  { name: 'FEATHERLITE', bg: '#ffffff', fg: '#0b2a5b' },
  { name: 'SMASHPOINT', bg: '#0b2a5b', fg: '#ffffff' },
  { name: 'NETCORD', bg: '#1d5fd1', fg: '#ffffff' },
  { name: 'RALLY WATER', bg: '#ffffff', fg: '#00873f' },
  { name: 'SHUTTLE AIR', bg: '#0b2a5b', fg: '#7ee2a8' },
];

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// One strip of sponsor panels, starting at a given sponsor so neighbouring boards differ.
function boardTexture(offset, panels) {
  return canvasTexture(512 * panels, 128, (g, w, h) => {
    for (let i = 0; i < panels; i++) {
      const s = SPONSORS[(i + offset) % SPONSORS.length];
      g.fillStyle = s.bg;
      g.fillRect(i * 512, 0, 512, h);
      g.fillStyle = s.fg;
      g.font = '800 64px "Barlow Condensed", Inter, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s.name, i * 512 + 256, h / 2 + 4, 460); // shrink to fit the panel
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(i * 512 + 510, 0, 2, h);
    }
  });
}

// Rows of seats with people in them, seen from a distance.
function crowdTexture(seed) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const shirts = ['#3a4a63', '#c9d2de', '#2b4f8f', '#2f6b4f', '#7a5a3a', '#1c2435', '#5b4a6e', '#36708f', '#8a4b3b', '#566377'];
  const skins = ['#f1c9a5', '#d9a27e', '#a86f4c', '#6b4329', '#e8b892'];
  return canvasTexture(1024, 512, (g, w, h) => {
    const rows = 16;
    const rowH = h / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      g.fillStyle = r % 2 ? '#141f33' : '#17233a';
      g.fillRect(0, y, w, rowH);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, y + rowH - 3, w, 3);
      for (let x = 4; x < w; x += 12) {
        if (rand() < 0.22) continue; // empty seat
        const cx = x + rand() * 4;
        g.fillStyle = shirts[Math.floor(rand() * shirts.length)];
        g.fillRect(cx - 4, y + rowH * 0.48, 8, rowH * 0.46);
        g.fillStyle = skins[Math.floor(rand() * skins.length)];
        g.beginPath();
        g.arc(cx, y + rowH * 0.34, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
}

function screenTexture() {
  return canvasTexture(1024, 384, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#123a7a');
    grad.addColorStop(1, '#0b2a5b');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#00a650';
    g.fillRect(0, h - 26, w, 26);
    g.fillStyle = '#ffffff';
    g.font = '800 120px "Barlow Condensed", Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('COURTWISE OPEN', w / 2, h * 0.42, w - 80);
    g.fillStyle = '#9fe3bd';
    g.font = '600 52px "Barlow Condensed", Inter, sans-serif';
    g.fillText('CENTRE COURT', w / 2, h * 0.75, w - 80);
  });
}

// An LED board: a slightly tilted glowing panel on a dark frame.
function addBoard(group, { x, z, length, rotY, offset }) {
  const panels = Math.max(1, Math.round(length / 3.2));
  const board = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(length, 0.8),
    new THREE.MeshBasicMaterial({ map: boardTexture(offset, panels), toneMapped: false }),
  );
  face.position.y = 0.45;
  face.rotation.x = -0.12;
  board.add(face);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(length + 0.08, 0.9, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x0d1830, roughness: 0.8 }),
  );
  frame.position.set(0, 0.45, -0.2);
  board.add(frame);
  board.position.set(x, 0, z);
  board.rotation.y = rotY;
  group.add(board);
}

// A stand: three sloped tiers of seats with a lit fascia between them.
function addStand(group, { length, start, rotY, seed }) {
  const stand = new THREE.Group();
  const crowd = crowdTexture(seed);
  crowd.wrapS = THREE.RepeatWrapping;
  crowd.repeat.set(length / 12, 1);
  const seatMat = new THREE.MeshStandardMaterial({ map: crowd, color: 0xb8c2d0, roughness: 0.95 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x1b2a45, roughness: 1 });
  const fascia = new THREE.MeshBasicMaterial({ color: 0x00a650, toneMapped: false });

  const tiers = [
    { depth: 6, rise: 3.2, base: 0.9 },
    { depth: 6, rise: 3.6, base: 4.9 },
    { depth: 6, rise: 4.0, base: 9.3 },
  ];
  let d = start;
  for (const [i, t] of tiers.entries()) {
    const slope = Math.hypot(t.depth, t.rise);
    const seats = new THREE.Mesh(new THREE.PlaneGeometry(length, slope), seatMat);
    seats.rotation.x = -Math.atan2(t.depth, t.rise);
    seats.position.set(0, t.base + t.rise / 2, -(d + t.depth / 2));
    stand.add(seats);
    // front wall of the tier with a glowing band
    const wall = new THREE.Mesh(new THREE.BoxGeometry(length, t.base, 0.4), concrete);
    wall.position.set(0, t.base / 2, -d);
    stand.add(wall);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.18), fascia);
    band.position.set(0, t.base - 0.2, -d + 0.21);
    if (i > 0) stand.add(band);
    d += t.depth + 0.6;
  }
  // back wall up to the roof
  const back = new THREE.Mesh(new THREE.PlaneGeometry(length + 20, 30), concrete);
  back.position.set(0, 14, -(d + 0.5));
  stand.add(back);

  stand.rotation.y = rotY;
  group.add(stand);
}

export function buildArena(scene) {
  const arena = new THREE.Group();

  // Hall floor beyond the court surround.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 90),
    new THREE.MeshStandardMaterial({ color: 0x0c1a33, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  arena.add(floor);

  // LED boards: behind each baseline and along each side, with a gap at the
  // umpire's side for the chairs and a gap at each end for player entry.
  let off = 0;
  for (const sgn of [1, -1]) {
    addBoard(arena, { x: -2.9, z: sgn * 9.2, length: 4.8, rotY: sgn > 0 ? Math.PI : 0, offset: off++ });
    addBoard(arena, { x: 2.9, z: sgn * 9.2, length: 4.8, rotY: sgn > 0 ? Math.PI : 0, offset: off++ });
    addBoard(arena, { x: sgn * 5.4, z: -4.6, length: 8.0, rotY: sgn > 0 ? -Math.PI / 2 : Math.PI / 2, offset: off++ });
    addBoard(arena, { x: sgn * 5.4, z: 4.6, length: 8.0, rotY: sgn > 0 ? -Math.PI / 2 : Math.PI / 2, offset: off++ });
  }

  // Stands: sides run the long way, ends sit behind the baselines.
  addStand(arena, { length: 44, start: 11, rotY: -Math.PI / 2, seed: 11 }); // +x side, faces -x
  addStand(arena, { length: 44, start: 11, rotY: Math.PI / 2, seed: 23 }); // -x side
  addStand(arena, { length: 26, start: 14, rotY: Math.PI, seed: 37 }); // Blue end (+z)
  addStand(arena, { length: 26, start: 14, rotY: 0, seed: 53 }); // Orange end (-z)

  // Light rigs over the court and a dark roof.
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const truss = new THREE.MeshStandardMaterial({ color: 0x24334f, roughness: 0.7 });
  for (const x of [-7, 7]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 22), truss);
    bar.position.set(x, 19, 0);
    arena.add(bar);
    for (let z = -9; z <= 9; z += 3) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.5), lamp);
      l.position.set(x, 18.8, z);
      arena.add(l);
    }
  }
  const roof = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshBasicMaterial({ color: 0x050c1a, side: THREE.DoubleSide }),
  );
  roof.rotation.x = Math.PI / 2;
  roof.position.y = 26;
  arena.add(roof);

  // A big screen hanging above each end stand.
  const screenTex = screenTexture();
  for (const sgn of [1, -1]) {
    const scr = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 3.4),
      new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
    );
    scr.position.set(0, 17, sgn * 30);
    scr.rotation.y = sgn > 0 ? Math.PI : 0;
    arena.add(scr);
  }

  scene.add(arena);
  return arena;
}
