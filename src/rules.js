// Positioning rules engine. Pure functions, no three.js, so it can be unit tested.
//
// Coordinates (metres): x runs across the court (the straight line keeps x the same
// on both sides), z runs along it with the net at z = 0. Team A is the near side
// (z > 0), team B the far side (z < 0). Inside the engine we work in "depth" =
// distance from the net on a team's own side, so the same rule serves both teams.

export const COURT = {
  halfLength: 6.7, // net to back boundary line
  shortService: 1.98, // net to short service line
  doublesLongService: 5.94, // net to doubles long service line (0.76 m inside the back line)
  doublesHalfWidth: 3.05,
  singlesHalfWidth: 2.59,
  netHeight: 1.524, // at the centre; 1.55 m at the posts
  serveHeightLimit: 1.15, // whole shuttle below 1.15 m at contact (Law 9.1.6)
};

export const TEAMS = { A: { sign: 1, name: 'Blue' }, B: { sign: -1, name: 'Orange' } };

// Shot catalogue. `cls` drives the formation logic:
//   up     - shuttle goes up to the opponents (they can attack)
//   attack - shuttle comes down hard or steep (smash, drop, kill)
//   net    - soft shot to the opponents' forecourt (net shot, block, short serve)
//   flat   - flat exchange through the mid-court (drive, push)
// `depth` is the default landing / interception depth on the receiving side,
// `contact` the usual contact height, `apex` how high the arc peaks.
export const SHOTS = {
  serveShort: { label: 'Short serve', cls: 'net', serve: true, depth: 2.25, contact: 1.0, apex: 1.75 },
  serveHigh: { label: 'High / flick serve', cls: 'up', serve: true, depth: 5.6, contact: 1.0, apex: 5.2 },
  clear: { label: 'Clear', cls: 'up', depth: 6.2, contact: 2.6, apex: 6.5 },
  lift: { label: 'Lift', cls: 'up', depth: 6.0, contact: 0.7, apex: 5.5 },
  smash: { label: 'Smash', cls: 'attack', depth: 4.0, contact: 2.7, apex: 2.7 },
  drop: { label: 'Drop', cls: 'attack', depth: 1.6, contact: 2.5, apex: 2.6 },
  kill: { label: 'Net kill', cls: 'attack', depth: 2.6, contact: 1.9, apex: 1.9 },
  drive: { label: 'Drive', cls: 'flat', depth: 4.3, contact: 1.4, apex: 1.8 },
  push: { label: 'Push', cls: 'flat', depth: 3.2, contact: 1.2, apex: 1.7 },
  net: { label: 'Net shot', cls: 'net', depth: 0.6, contact: 1.3, apex: 1.7 },
  block: { label: 'Block', cls: 'net', depth: 1.1, contact: 0.9, apex: 1.75 },
};

export const SHOT_ORDER = [
  'serveShort', 'serveHigh', 'clear', 'lift', 'smash', 'drop', 'kill', 'drive', 'push', 'net', 'block',
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sideOf = (t) => (t === 'A' ? 'B' : 'A');
export const teamOf = (id) => id[0];

// World <-> team-relative depth.
export const depthOf = (team, z) => z * TEAMS[team].sign;
export const zOf = (team, depth) => depth * TEAMS[team].sign;

// Which side of the court x is on, from that team's own point of view (facing the net).
// Team A faces -z, so their right hand is +x; team B faces +z, so their right is -x.
export function sideName(team, x) {
  if (Math.abs(x) < 0.45) return 'middle';
  const right = TEAMS[team].sign > 0 ? x > 0 : x < 0;
  return right ? 'right' : 'left';
}

function halfWidth(mode) {
  return mode === 'singles' ? COURT.singlesHalfWidth : COURT.doublesHalfWidth;
}

// Spot inside the court for a team, with a small margin from the lines.
function spot(team, x, depth, mode) {
  const hw = halfWidth(mode) - 0.35;
  return { x: clamp(x, -hw, hw), z: zOf(team, clamp(depth, 0.7, COURT.halfLength - 0.25)) };
}

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

// Give two spots to two players with the least total movement.
function assign(players, spots) {
  const [p, q] = players;
  const [s, t] = spots;
  return dist2(p, s) + dist2(q, t) <= dist2(p, t) + dist2(q, s)
    ? [[p, s], [q, t]]
    : [[p, t], [q, s]];
}

// ---------------------------------------------------------------- targets

// Default target for a shot played by `hitter` from `contact` in a direction.
// Straight keeps x, cross mirrors it, middle aims at the centre line.
// Serves must go diagonally into the opposite service court.
export function defaultTarget({ mode, shot, contact, hitterTeam, direction, server }) {
  const s = SHOTS[shot];
  const recv = sideOf(hitterTeam);
  const hw = halfWidth(mode) - 0.5;
  let x;
  let depth = s.depth;
  if (s.serve) {
    // Diagonal box: opposite sign of x from the server.
    const boxSign = (server ?? contact).x >= 0 ? -1 : 1;
    const boxHw = halfWidth(mode);
    const at = { t: 0.25, body: boxHw * 0.5, wide: boxHw - 0.3 }[direction] ?? boxHw * 0.5;
    x = boxSign * at;
    if (shot === 'serveHigh' && mode === 'singles') depth = 6.4;
  } else {
    const hx = Math.abs(contact.x) < 0.4 ? (contact.x >= 0 ? 0.6 : -0.6) : contact.x;
    if (direction === 'cross') x = -Math.sign(hx) * hw;
    else if (direction === 'middle') x = 0;
    else x = clamp(hx * 1.1, -hw, hw);
  }
  return { x, z: zOf(recv, depth) };
}

// ------------------------------------------------------------- legality notes

// `server` is where the server stands (the Laws are about their feet, not the shuttle).
export function checkShot({ mode, shot, contact, hitterTeam, target, score, server }) {
  const s = SHOTS[shot];
  const notes = [];
  const recv = sideOf(hitterTeam);
  const cd = depthOf(hitterTeam, contact.z);
  const td = depthOf(recv, target.z);
  const hw = halfWidth(mode);

  if (cd <= 0) notes.push({ level: 'warn', text: 'The shuttle has to be hit from your own side of the net.' });

  if (s.serve) {
    const even = score === 'even';
    const stand = server ?? contact;
    // Server's right service court is +x for team A, -x for team B.
    const serverRight = TEAMS[hitterTeam].sign > 0 ? stand.x > 0 : stand.x < 0;
    if (serverRight !== even) {
      notes.push({
        level: 'warn',
        text: `With an ${score} score the server must serve from their ${even ? 'right' : 'left'} service court (Law 10/11).`,
      });
    }
    if (depthOf(hitterTeam, stand.z) < COURT.shortService) notes.push({ level: 'warn', text: 'The server must stand behind the short service line.' });
    if (Math.sign(target.x) === Math.sign(stand.x) && Math.abs(target.x) > 0.05) {
      notes.push({ level: 'warn', text: 'A serve must land in the service court diagonally opposite.' });
    }
    const longLine = mode === 'doubles' ? COURT.doublesLongService : COURT.halfLength;
    if (td < COURT.shortService) notes.push({ level: 'warn', text: 'That serve lands short of the short service line: fault.' });
    if (td > longLine) {
      notes.push({
        level: 'warn',
        text: mode === 'doubles'
          ? 'In doubles a serve past the long service line (0.76 m inside the back line) is out.'
          : 'That serve lands past the back line: out.',
      });
    }
    if (Math.abs(target.x) > hw) notes.push({ level: 'warn', text: 'That serve lands outside the sideline: out.' });
    notes.push({
      level: 'info',
      text: 'Serve rules: hit the shuttle below 1.15 m, one continuous forward swing, both feet in contact with the floor until it is struck.',
    });
  } else {
    if (td > COURT.halfLength) notes.push({ level: 'warn', text: 'That lands past the back line: out.' });
    if (Math.abs(target.x) > hw) {
      notes.push({
        level: 'warn',
        text: mode === 'singles'
          ? 'In singles the outer tramlines are out: that lands wide.'
          : 'That lands outside the doubles sideline: out.',
      });
    }
    if (['clear', 'smash', 'drop'].includes(shot) && cd < 2.3) {
      notes.push({ level: 'info', text: 'Overhead clears, smashes and drops are usually played from the mid or back court. From this close in, a net kill or push is the usual shot.' });
    }
    if (shot === 'net' && cd > 3.2) {
      notes.push({ level: 'info', text: 'A net shot is normally played from the forecourt. From this deep it becomes a drop or a block.' });
    }
    if (s.cls === 'up' && Math.abs(target.x) < 0.6) {
      notes.push({ level: 'info', text: 'Lifting to the middle gives the attacker every angle. Lift to the back corners instead.' });
    }
    if (shot === 'smash' && Math.abs(target.x) < 0.6 && mode === 'doubles') {
      notes.push({ level: 'info', text: 'A smash down the middle between two defenders can cause confusion, but gives them the easiest reach. Down the lines or at the body is usually stronger.' });
    }
  }
  return notes;
}

// ------------------------------------------------------------- the engine

// state: { mode, players: [{id, x, z}], hitterId, shot, target: {x,z}, contact: {x,z} }
// returns { moves: {id: {x, z, role, text}}, summary, formation: {A, B} }
export function recommend(state) {
  const { mode, shot, hitterId, target } = state;
  const s = SHOTS[shot];
  const active = state.players.filter((p) => mode === 'doubles' || p.id.endsWith('1'));
  const hitter = active.find((p) => p.id === hitterId);
  if (!hitter) return { moves: {}, summary: 'Pick who is hitting the shuttle.', formation: {} };
  const H = teamOf(hitterId);
  const R = sideOf(H);
  const contact = state.contact ?? { x: hitter.x, z: hitter.z };
  const ctx = {
    mode, shot, s, H, R, contact, target,
    hx: contact.x,
    hd: depthOf(H, contact.z),
    tx: target.x,
    td: depthOf(R, target.z),
    hitter,
    partner: active.find((p) => teamOf(p.id) === H && p.id !== hitterId),
    receivers: active.filter((p) => teamOf(p.id) === R),
  };
  return mode === 'singles' ? singles(ctx) : doubles(ctx);
}

// ------------------------------------------------------------- singles

function singles(c) {
  const { s, shot, H, R, tx, td, hx } = c;
  const moves = {};
  const opp = c.receivers[0];
  const tside = sideName(H, tx);
  const shadeText = tside === 'middle'
    ? 'Your shot went down the middle, so stay centred.'
    : `Shade a little to your ${tside}: you hit to that side, and the opponent's straight reply comes back there. It is their fastest and most likely shot.`;

  // Hitter: recover to the centre of the opponent's possible replies.
  let k = 0.25;
  let d = 3.5;
  let why = '';
  switch (s.cls) {
    case 'up':
      d = td > 5.4 ? 3.7 : 4.1;
      why = td > 5.4
        ? 'You sent it high and deep, so you have time. Recover to a base just behind the middle of the court. The opponent can smash, drop or clear from there.'
        : 'That lift is short of the back, so the opponent can hit steeply. Recover a little deeper than usual and get your racket up for the smash.';
      if (shot === 'serveHigh') why = 'After a high serve, step back to base just behind the centre and get ready for their smash, drop or clear.';
      break;
    case 'attack':
      k = 0.35;
      d = shot === 'kill' ? 2.6 : 3.0;
      why = shot === 'smash'
        ? 'Follow your smash in. The usual replies are a block to the net or a flat drive, so take your base a step in front of centre.'
        : shot === 'drop'
          ? 'After a drop the reply is a lift or a net shot. Take your base slightly in front of centre so you can reach both.'
          : 'After a kill, stay forward and ready in case it comes back.';
      break;
    case 'net':
      k = 0.4;
      d = shot === 'serveShort' ? 2.6 : 2.7;
      why = shot === 'serveShort'
        ? 'After a short serve, stay a step behind the short service line. Expect a net reply or a push.'
        : 'After a tight net shot, the opponent can only lift or play another net shot. Base forward of centre, but not on the net: you still need to reach the back corners.';
      break;
    case 'flat':
      k = 0.3;
      d = shot === 'push' ? 3.2 : 3.3;
      why = 'Flat exchanges are fast. Hold your base around the centre with your racket up in front, ready to block or drive again.';
      break;
  }
  const base = spot(H, tx * k, d, 'singles');
  moves[c.hitter.id] = {
    ...base,
    role: 'Recover to base',
    text: `${why} ${shadeText} Split-step as they hit. If you can't reach base in time, stop and split-step where you are rather than running through.`,
  };

  // Opponent: go to the shuttle.
  if (opp) {
    let m;
    switch (s.cls) {
      case 'up':
        m = {
          ...spot(R, tx, td + 0.35, 'singles'),
          role: 'Get behind the shuttle',
          text: shot === 'serveHigh'
            ? 'Move back behind the shuttle and take it overhead. A clear to the back corner or a drop are safe replies to a high serve.'
            : 'Move back and get behind the shuttle so you can hit it overhead. You choose: a straight smash if it is short, a drop or a clear if it is deep.',
        };
        break;
      case 'attack':
        if (shot === 'smash') {
          m = {
            ...spot(R, tx, Math.max(td, 3.2), 'singles'),
            role: 'Defend the smash',
            text: 'Low stance, racket in front, weight forward. Best replies are a block to the net (making them run forward) or a high lift to the back corners.',
          };
        } else if (shot === 'drop') {
          m = {
            ...spot(R, tx, td + 0.3, 'singles'),
            role: 'Take the drop early',
            text: 'Lunge forward and take it as high as you can. A tight net shot or a push keeps you in the rally. If you have to lift, lift high and to the corners.',
          };
        } else {
          m = {
            ...spot(R, tx, td, 'singles'),
            role: 'Brace',
            text: 'A net kill is very hard to return. Stay low with your racket up, and next time avoid loose net replies.',
          };
        }
        break;
      case 'net':
        m = {
          ...spot(R, tx, Math.max(td + 0.35, 1.0), 'singles'),
          role: 'Go to the net',
          text: shot === 'serveShort'
            ? 'Step in and take the serve early. A tight net reply, a push to the back corner or a flat drive all work. Lift only if you must.'
            : 'Get to the net early with your racket up. If you reach it above net height, push it or kill it. If it is low, play a net shot back or lift it high to a back corner.',
        };
        break;
      default:
        m = {
          ...spot(R, tx, td, 'singles'),
          role: 'Meet it early',
          text: 'Meet it in front of your body and keep it flat. Drive or push it into space, ideally away from where the opponent is recovering.',
        };
    }
    moves[opp.id] = m;
  }

  const formation = { [H]: 'base', [R]: 'to the shuttle' };
  const summary = `Singles: ${s.label.toLowerCase()} from ${c.H === 'A' ? 'Blue' : 'Orange'}. In singles you cover the whole court, so after every shot you go back to a base in the centre of your opponent's possible replies, not the centre of the court.`;
  return { moves, summary, formation, hx };
}

// ------------------------------------------------------------- doubles

// Side-by-side defensive spots for `team` against an attacker at x = ax.
// The pair shifts toward the attacker's straight line. The straight defender sits
// a little deeper, the cross defender slightly closer to the net and the middle.
function defenceSpots(team, ax, depth) {
  const c = clamp(ax * 0.35, -0.9, 0.9);
  const sgn = Math.abs(ax) < 0.45 ? 0 : Math.sign(ax);
  const left = { x: c - 1.25, d: depth };
  const right = { x: c + 1.25, d: depth };
  if (sgn !== 0) {
    const straight = sgn > 0 ? right : left;
    const cross = sgn > 0 ? left : right;
    straight.d = depth + 0.2;
    cross.d = depth - 0.2;
    cross.x += sgn * 0.2;
    straight.kind = 'straight';
    cross.kind = 'cross';
  } else {
    left.kind = right.kind = 'even';
  }
  return [left, right].map((p) => ({ ...spot(team, p.x, p.d, 'doubles'), kind: p.kind }));
}

function defenceText(team, sp, extra = '') {
  const side = sideName(team, sp.x);
  if (sp.kind === 'straight') {
    return `You are the straight defender. Cover the smash down your ${side} line, which is the most dangerous shot from where the attacker is. Sit slightly deeper than your partner. ${extra}`.trim();
  }
  if (sp.kind === 'cross') {
    return `You are the cross defender. Cover the cross-court smash and the middle. Stand slightly closer to the net and the centre than your partner, and face the attacker. ${extra}`.trim();
  }
  return `The attack is coming from the middle. Each of you covers your own half (you take the ${side}), and you agree beforehand who takes the shuttle down the middle (usually the forehand). ${extra}`.trim();
}

function doubles(c) {
  const { s, shot, H, R, tx, td, hx, hd, target } = c;
  const moves = {};
  const pair = [c.hitter, c.partner].filter(Boolean);
  const recv = c.receivers;
  const tside = sideName(H, tx);
  let formation = {};

  // ---- hitting team, after their shot ----
  if (s.cls === 'up') {
    const depth = td < 4.8 ? 3.6 : 3.25;
    const spots = defenceSpots(H, tx, depth);
    const extra = td < 4.8
      ? 'The lift is short, so the attacker is close and can hit steeply. Defend a little deeper than usual.'
      : '';
    for (const [p, sp] of assign(pair, spots)) {
      moves[p.id] = {
        x: sp.x, z: sp.z,
        role: sp.kind === 'straight' ? 'Straight defender' : sp.kind === 'cross' ? 'Cross defender' : 'Defend your half',
        text: `${p.id === c.hitter.id
          ? shot === 'serveHigh' ? 'After a high serve, step back.' : 'You lifted, so the opponents can attack. Move back from the shuttle into defence.'
          : 'Your partner lifted, so switch to side-by-side.'} ${defenceText(H, sp, extra)}`,
      };
    }
    formation[H] = 'side-by-side (defending)';
  } else if (s.cls === 'attack' || (s.cls === 'net' && !s.serve)) {
    // Front-and-back. Whoever is nearer the net takes the front.
    const hitterFront = hd < 3.0 || s.cls === 'net';
    const front = spot(H, tx * (s.cls === 'net' ? 0.55 : 0.4), s.cls === 'net' ? 1.9 : 2.0, 'doubles');
    const back = spot(
      H,
      s.cls === 'net' ? tx * 0.25 : hitterFront ? tx * 0.3 : hx * 0.5 + tx * 0.2,
      hitterFront ? 4.3 : shot === 'smash' ? 4.0 : 4.2,
      'doubles',
    );
    const frontText = {
      smash: `Take the net. Stand around the T, shaded to your ${tside}, where the smash went. A straight block or a drive is the most likely reply. Racket up to intercept and kill it.`,
      drop: `Take the net. After a drop the reply is a net shot or a lift. Shade to your ${tside} and kill anything that comes back tight and high.`,
      kill: 'Stay on the net after your kill, racket up, in case it comes back.',
      net: `Follow your net shot in, shaded to your ${tside}. If they play another net shot, you are there to kill it or tumble it back.`,
      block: 'You blocked to the net, so follow it in and take the front. Their likely reply is a lift (which your partner attacks) or another net shot (which you take).',
    }[shot];
    const backText = {
      smash: 'Keep the attack going. Follow your smash in a step along its line so you can hit the next lift or take a half-court reply.',
      drop: 'After your drop, stay back in the middle of the rear court and cover the lift.',
      kill: 'Cover behind your partner in case the kill comes back.',
      net: 'Cover the back, in the centre. Off a tight net shot their best reply is a lift, and you should be ready to smash it.',
      block: 'Your partner is moving to the net, so you take the back and get ready to attack the lift.',
    }[shot];
    const asg = hitterFront ? [[c.hitter, front], [c.partner, back]] : [[c.hitter, back], [c.partner, front]];
    for (const [p, sp] of asg) {
      if (!p) continue;
      const isFront = sp === front;
      moves[p.id] = {
        ...sp,
        role: isFront ? 'Front: net' : 'Back: rear court',
        text: isFront
          ? (p.id === c.hitter.id ? frontText : `Your partner is attacking from the back, so you take the front. ${frontText}`)
          : (p.id === c.hitter.id ? backText : `Your partner is at the net, so you cover the back. ${backText}`),
      };
    }
    formation[H] = 'front-and-back (attacking)';
  } else if (shot === 'serveShort') {
    const serverSpot = spot(H, hx * 0.45, 2.15, 'doubles');
    const partnerSpot = spot(H, hx * 0.15, 4.1, 'doubles');
    moves[c.hitter.id] = {
      ...serverSpot,
      role: 'Server: front',
      text: 'After a short serve, stay up near the T with your racket raised. You take any net reply and push replies in front of you.',
    };
    if (c.partner) {
      moves[c.partner.id] = {
        ...partnerSpot,
        role: 'Behind the server',
        text: 'Stand in the middle behind your partner, slightly toward their side. You cover pushes past the server and anything to the back. If you have to lift, both of you switch to side-by-side.',
      };
    }
    formation[H] = 'front-and-back (serving)';
  } else {
    // flat: drive / push
    if (shot === 'push') {
      const fwd = spot(H, tx * 0.4, 2.4, 'doubles');
      const bk = spot(H, -tx * 0.2, 3.7, 'doubles');
      moves[c.hitter.id] = {
        ...fwd,
        role: 'Follow the push',
        text: 'Follow your push forward a step. If they reply soft to the net, you take it. Racket up.',
      };
      if (c.partner) {
        moves[c.partner.id] = {
          ...bk,
          role: 'Cover behind',
          text: 'Stay a little behind and to the other side of your partner, in a staggered shape. If they lift, you attack. If they drive, you meet it.',
        };
      }
      formation[H] = 'staggered (neutral)';
    } else {
      const spots = defenceSpots(H, tx, 2.9).map((p) => ({ ...p, kind: 'even' }));
      for (const [p, sp] of assign(pair, spots)) {
        moves[p.id] = {
          x: sp.x, z: sp.z,
          role: 'Mid-court, level',
          text: `Drives keep the rally flat and fast. Stay level in the mid-court, covering your ${sideName(H, sp.x)} half, racket up in front. Whoever gets the first chance to hit down takes it, and then you go front-and-back.`,
        };
      }
      formation[H] = 'side-by-side (mid-court)';
    }
  }

  // ---- receiving team ----
  if (recv.length) {
    const closest = [...recv].sort((a, b) => dist2(a, target) - dist2(b, target));
    const [r, q] = closest;
    if (s.cls === 'up') {
      const backSp = spot(R, tx, td + 0.35, 'doubles');
      const frontSp = spot(R, tx * 0.35, 2.0, 'doubles');
      const side = sideName(R, tx);
      moves[r.id] = {
        ...backSp,
        role: 'Back: attack',
        text: shot === 'serveHigh'
          ? 'Receiving a high serve: you go back to hit and your partner takes the front. Smash or drop from the back. The straight smash is the high-percentage shot.'
          : 'The shuttle is coming up to you. Get behind it and attack. A steep smash, usually straight or at the body, or a drop if you are deep and late.',
      };
      if (q) {
        moves[q.id] = {
          ...frontSp,
          role: 'Front: net',
          text: `Your partner is attacking from the back, so you take the front around the T, shaded to your ${side}. Racket up, ready to kill a weak block or drive.`,
        };
      }
      formation[R] = 'front-and-back (attacking)';
    } else if (shot === 'smash' || shot === 'kill') {
      const spots = defenceSpots(R, hx, shot === 'kill' ? 3.5 : 3.25);
      for (const [p, sp] of assign([r, q].filter(Boolean), spots)) {
        moves[p.id] = {
          x: sp.x, z: sp.z,
          role: sp.kind === 'straight' ? 'Straight defender' : sp.kind === 'cross' ? 'Cross defender' : 'Defend your half',
          text: `${shot === 'kill' ? 'A net kill is very hard to return. Stay low and side-by-side.' : 'Smash coming: defend side-by-side with a low, wide stance and your racket in front.'} ${defenceText(R, sp, shot === 'smash' ? 'Reply with a block to the net or a drive or lift to the sidelines. Never lift to the middle.' : '')}`,
        };
      }
      formation[R] = 'side-by-side (defending)';
    } else if (shot === 'drop') {
      moves[r.id] = {
        ...spot(R, tx, td + 0.3, 'doubles'),
        role: 'Take the drop',
        text: 'Move in and take the drop early, as high as you can. A net shot or a push keeps you out of trouble. If you have to lift, lift high and to the sidelines, and then you both go side-by-side.',
      };
      if (q) {
        moves[q.id] = {
          ...spot(R, -tx * 0.6, 3.6, 'doubles'),
          role: 'Hold the other half',
          text: 'Hold the mid-court on the other half. If your partner lifts, you are already in side-by-side defence. If they play a net shot, you take the back.',
        };
      }
      formation[R] = 'moving: one forward, one back';
    } else if (s.cls === 'net') {
      moves[r.id] = {
        ...spot(R, tx, Math.max(td + 0.35, shot === 'serveShort' ? 2.1 : 1.0), 'doubles'),
        role: 'Rush the net',
        text: shot === 'serveShort'
          ? 'Receiving a short serve: step in and attack it. Push it past the server into the mid-court, play a tight net shot, or kill it if it floats. Avoid lifting.'
          : 'Get to the net fast, racket up. Take it as high as you can: kill it if it is loose, or play a tight net shot or a push. Lift only if you have to.',
      };
      if (q) {
        moves[q.id] = {
          ...spot(R, tx * 0.2, 4.2, 'doubles'),
          role: 'Cover the back',
          text: shot === 'serveShort'
            ? 'Stand behind your partner in the middle. You take anything pushed or flicked to the back.'
            : 'Cover the back in the middle. If your partner lifts, drop into side-by-side defence. If they net it, you stay back to attack the lift.',
        };
      }
      formation[R] = 'front-and-back';
    } else {
      moves[r.id] = {
        ...spot(R, tx, td, 'doubles'),
        role: 'Meet it',
        text: shot === 'push'
          ? 'Meet the push early, in front of you. Drive it flat or push it back past the net player. Do not let it drop low and force a lift.'
          : 'Meet the drive in front of your body, early and flat. Drive it back, or block it short if they are both deep.',
      };
      if (q) {
        const sp = spot(R, -Math.sign(tx || 1) * 1.2, td, 'doubles');
        moves[q.id] = {
          ...sp,
          role: 'Level, other half',
          text: 'Stay level with your partner on the other half, racket up. A flat rally is about who hits down first.',
        };
      }
      formation[R] = 'side-by-side (mid-court)';
    }
  }

  const principle = {
    up: 'The shuttle went up, so the hitting side defends side-by-side and the other side attacks front-and-back.',
    attack: 'The shuttle is coming down, so the hitting side stays front-and-back to keep attacking and the other side defends side-by-side.',
    net: 'A soft shot to the net forces the reply up, so the hitting side sets up front-and-back to attack the lift.',
    flat: 'A flat exchange is neutral. Both sides stay level in the mid-court until someone can hit down.',
  }[s.cls];
  const summary = `Doubles: ${s.label.toLowerCase()} from ${H === 'A' ? 'Blue' : 'Orange'}. ${principle}`;
  return { moves, summary, formation };
}

// ------------------------------------------------------------- serve setup

// Place players for a serve according to the Laws: even score serves from the
// right service court, odd from the left; the receiver stands diagonally opposite.
export function serveSetup({ mode, servingTeam, score }) {
  const R = sideOf(servingTeam);
  const even = score === 'even';
  // Server's right is +x for A, -x for B.
  const rightX = (team) => (TEAMS[team].sign > 0 ? 1 : -1);
  const sx = rightX(servingTeam) * (even ? 1 : -1);
  const rx = -sx; // diagonally opposite keeps the opposite x sign
  const out = {};
  if (mode === 'singles') {
    out[`${servingTeam}1`] = { x: sx * 0.5, z: zOf(servingTeam, 2.9) };
    out[`${R}1`] = { x: rx * 0.6, z: zOf(R, 3.0) };
  } else {
    out[`${servingTeam}1`] = { x: sx * 0.35, z: zOf(servingTeam, 2.2) };
    out[`${servingTeam}2`] = { x: sx * 0.15, z: zOf(servingTeam, 3.9) };
    out[`${R}1`] = { x: rx * 0.55, z: zOf(R, 2.35) };
    out[`${R}2`] = { x: -rx * 0.4, z: zOf(R, 4.1) };
  }
  return out;
}
