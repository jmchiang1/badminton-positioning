// Scripted rallies modelled on common patterns in high-level doubles and singles.
// Each step is one shot. The receiver nearest the shuttle plays the next shot, and
// the rule engine decides where everyone moves, so a play always agrees with the
// setup mode. `dir` is straight / middle / cross (serves: t / body / wide); `to`
// overrides the landing spot as { x, d } (d = depth from the net on the receiving side).
export const PLAYS = [
  {
    id: 'third-shot',
    mode: 'doubles',
    title: 'Short serve, third-shot attack',
    blurb: 'The server\'s side waits for the lift and attacks it straight away.',
    start: { serve: 'A', score: 'even' },
    steps: [
      { shot: 'serveShort', dir: 't', note: 'Blue serves short to the T' },
      { shot: 'lift', dir: 'straight', note: 'Orange lifts: Orange goes side-by-side' },
      { shot: 'smash', dir: 'straight', note: 'Blue smashes straight, server holds the net' },
      { shot: 'block', dir: 'straight', note: 'Orange blocks straight to the net' },
      { shot: 'kill', dir: 'middle', note: 'Blue\'s net player kills between them' },
    ],
  },
  {
    id: 'flick',
    mode: 'doubles',
    title: 'Punishing the flick serve',
    blurb: 'A flick serve is a lift, so the server\'s side drops straight into defence.',
    start: { serve: 'A', score: 'odd' },
    steps: [
      { shot: 'serveHigh', dir: 'wide', note: 'Blue flicks the serve wide' },
      { shot: 'smash', dir: 'straight', note: 'Orange smashes, Blue defends side-by-side' },
      { shot: 'block', dir: 'cross', note: 'Blue blocks cross-court' },
      { shot: 'kill', dir: 'straight', note: 'Orange\'s net player is waiting: kill' },
    ],
  },
  {
    id: 'drop-net-kill',
    mode: 'doubles',
    title: 'Drop, tight net, kill',
    blurb: 'Win the forecourt first, then attack the lift it forces.',
    start: {
      setup: { A1: { x: 1.2, z: 5.5 }, A2: { x: -1.2, z: 3.3 }, B1: { x: -1.3, z: -3.3 }, B2: { x: 1.3, z: -3.3 } },
      hitter: 'A1',
    },
    steps: [
      { shot: 'clear', dir: 'cross', note: 'Blue clears cross-court' },
      { shot: 'drop', dir: 'straight', note: 'Orange drops: Orange goes front-and-back' },
      { shot: 'net', dir: 'straight', note: 'Blue plays a tight net shot' },
      { shot: 'lift', dir: 'cross', note: 'Orange has to lift: Orange defends' },
      { shot: 'smash', dir: 'straight', note: 'Blue smashes, partner takes the net' },
      { shot: 'block', dir: 'straight', note: 'Orange blocks straight' },
      { shot: 'kill', dir: 'cross', note: 'Blue kills at the net' },
    ],
  },
  {
    id: 'counter',
    mode: 'doubles',
    title: 'Turning defence into attack',
    blurb: 'A flat drive past the net player forces a lift, and the sides swap roles.',
    start: {
      setup: { A1: { x: 1.0, z: 2.2 }, A2: { x: -1.4, z: 5.2 }, B1: { x: -1.2, z: -3.3 }, B2: { x: 1.2, z: -3.3 } },
      hitter: 'A2',
    },
    steps: [
      { shot: 'lift', dir: 'cross', note: 'Blue lifts: Blue defends side-by-side' },
      { shot: 'smash', dir: 'straight', note: 'Orange smashes straight' },
      { shot: 'drive', dir: 'straight', note: 'Blue drives flat past the net player' },
      { shot: 'lift', dir: 'cross', note: 'Orange is pushed back and lifts' },
      { shot: 'smash', dir: 'middle', note: 'Now Blue attacks: front-and-back' },
    ],
  },
  {
    id: 'singles-clear-drop',
    mode: 'singles',
    title: 'Clear, drop, net, smash',
    blurb: 'Move the opponent to the back, then the front, then attack the short lift.',
    start: { serve: 'A', score: 'even' },
    steps: [
      { shot: 'serveHigh', dir: 'body', note: 'Blue serves high' },
      { shot: 'clear', dir: 'straight', note: 'Orange clears to the back' },
      { shot: 'drop', dir: 'cross', note: 'Blue drops cross-court' },
      { shot: 'net', dir: 'straight', note: 'Orange plays a net shot' },
      { shot: 'lift', dir: 'cross', to: { x: -1.5, d: 4.6 }, note: 'Blue lifts, but it\'s short' },
      { shot: 'smash', dir: 'straight', note: 'Orange smashes the short lift' },
      { shot: 'block', dir: 'cross', note: 'Blue blocks cross' },
    ],
  },
  {
    id: 'singles-corners',
    mode: 'singles',
    title: 'Four corners',
    blurb: 'Each shot goes to a different corner. Watch the base shift each time.',
    start: { setup: { A1: { x: 0.8, z: 5.6 }, B1: { x: 0, z: -3.6 } }, hitter: 'A1' },
    steps: [
      { shot: 'clear', dir: 'straight', note: 'Blue clears to the back corner' },
      { shot: 'drop', dir: 'cross', note: 'Orange drops cross-court' },
      { shot: 'net', dir: 'straight', note: 'Blue plays a straight net shot' },
      { shot: 'lift', dir: 'cross', note: 'Orange lifts to the opposite corner' },
      { shot: 'clear', dir: 'cross', note: 'Blue clears cross-court' },
      { shot: 'drop', dir: 'straight', note: 'Orange drops straight' },
    ],
  },
];
