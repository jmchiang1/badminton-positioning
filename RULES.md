# The positioning rules

Courtwise's advice comes from a rule engine in [`src/rules.js`](src/rules.js), not from
machine learning. This page describes each rule in plain language and lists the sources
it came from. The in-app "The rules this uses" dialog ([`src/rulesDoc.js`](src/rulesDoc.js))
is a short version of this page. If you change a rule, update all three.

Coordinates: `x` runs across the court and `z` along it, with the net at `z = 0`. Blue (team A)
is the near side (`z > 0`) and Orange (team B) the far side. "Straight" keeps `x` the same on
both sides of the net. "Depth" is the distance from the net on a player's own side.

## How a shot is classified

Every shot belongs to one of four classes, and the class decides each team's formation:

| Class | Shots | Hitting side becomes | Receiving side becomes |
|---|---|---|---|
| `up` | clear, lift, high / flick serve | side-by-side (defend) | front-and-back (attack) |
| `attack` | smash, drop, net kill | front-and-back (keep attacking) | side-by-side (defend), or one forward, one back against a drop |
| `net` | net shot, block, short serve | front-and-back (ready to attack the lift) | net rusher plus back cover |
| `flat` | drive, push | level / staggered in the mid-court | level in the mid-court |

## Doubles

**Core principle.** Attack front-and-back and defend side-by-side. A front-and-back pair is
hard to beat when it's hitting down. It's easy to beat when it has to defend, because the
attacker can smash down either sideline. So when your side hits the shuttle up, you defend
side-by-side. When it hits down or tight to the net, you stay front-and-back.

**Defending (side-by-side)**, used after your side lifts and when facing a smash:
- The pair shifts toward the attacker's side by about 35% of the attacker's distance from the
  centre line, because the straight smash is the fastest and most dangerous shot.
- The *straight defender* (on the attacker's side) covers the line and sits about 0.2 m deeper.
- The *cross defender* covers the cross-court smash and the middle. They sit about 0.2 m closer to
  the net and 0.2 m toward the centre, facing the attacker.
- When the attack comes from the middle, each player covers their own half. Agree who takes the
  middle (usually the forehand).
- Base defensive depth is about 3.25 m from the net. After a short lift (landing under 4.8 m
  from the net), it's about 3.6 m, because the attacker is closer and the smash steeper.
- Reply with a block to the net, or a drive or lift to the sidelines. Never lift to the middle.

**Attacking (front-and-back)**, used after a smash, drop or kill from your side:
- Back player: after a smash, follow in a step along its line (about 4.0 m deep). After a drop,
  hold the middle of the rear court (about 4.2 m) for the lift.
- Front player: around the T (about 2.0 m from the net), shaded toward the side the shuttle went
  (40% of the target's offset), because the straight block or drive is the most likely reply.
- If the hitter was already in the forecourt (under 3 m deep, e.g. a kill), they stay front and
  the partner takes the back.

**Net shots and blocks:**
- After a tight net shot, the hitter follows in (about 1.9 m), shaded to the side of the shot.
  The partner covers the back centre (about 4.3 m), ready to smash the lift.
- After a block, the blocker follows it to the net and the partner takes the back.

**Flat exchanges:**
- After a drive, both players stay level at about 2.9 m, each covering a half, rackets up.
  Whoever can hit down first does, and the pair goes front-and-back.
- After a push, the pusher follows in a step (about 2.4 m) and the partner stays behind on the
  other side (about 3.7 m), in a staggered shape.

**Serve and return:**
- Short serve: the server stays near the T (about 2.15 m). The partner stands behind in the middle
  (about 4.1 m), shaded to the server's side.
- High or flick serve: the server steps back, and the pair defends side-by-side.
- Receiving a short serve: attack it with a push past the server, a tight net shot, or a kill if it
  floats. The receiver's partner covers the back.
- Receiving a high serve: the receiver goes back to attack and the partner takes the front.

**Receiving team, general rule.** The receiver nearest the shuttle's landing point takes
it, and the partner takes the complementary spot for the formation above. Against a drop, the
receiver moves in to take it early and the partner holds the mid-court on the other half, ready
to go side-by-side if the reply is a lift.

## Singles

- You cover the whole court, so after every shot you recover to a **base**. The base is the centre
  of the opponent's *possible replies*, not the geometric centre of the court.
- Shade the base toward the side you hit to. The opponent's straight reply is their fastest
  shot, so the base moves sideways by 25–40% of the target's offset, depending on the shot.
- Base depth by shot:
  - High, deep clear or lift: about 3.7 m from the net. You have time, and they can smash, drop or clear.
  - Short lift: about 4.1 m. Be ready for a steep smash.
  - Smash or drop: about 3.0 m, a step in front of centre. The replies are a block, a net shot or a lift.
  - Net shot or short serve: about 2.6–2.7 m, forward but not on the net.
  - Drive or push: about 3.2–3.3 m.
- Split-step as the opponent hits. If you can't reach base in time, stop and split-step rather
  than running through.
- The opponent moves to the shuttle: behind it for high shots, in early for drops and net shots.
  Against a smash, they defend low with the racket in front, and block or lift to the corners.

## Laws of the game the app checks

Based on the BWF Laws of Badminton:
- Court: 13.40 m × 6.10 m for doubles, 5.18 m wide for singles. The short service line is
  1.98 m from the net. The doubles long service line is 0.76 m inside the back boundary line.
  The net is 1.524 m at the centre and 1.55 m at the posts.
- Service courts: the server serves from the right service court when the serving side's score
  is even, and from the left when it's odd. The serve goes diagonally to the opposite court.
- The server and receiver stand inside diagonally opposite service courts, not touching the
  lines, until the serve is struck. In doubles the service court ends at the long service line.
- **Only the receiver may return the serve.** In doubles their partner may not, even if a flick
  serve goes over the receiver towards them. After the return, either partner may hit.
- The server stands behind the short service line. The whole shuttle is below 1.15 m at
  contact, in one continuous forward swing, with both feet on the floor.
- Each side hits the shuttle once before it crosses back. Partners can't both hit it in a row.
- Doubles serves past the long service line are out. Singles uses the full length but the
  narrow width, so the outer tramlines are out in singles.

The engine always hands a serve's return to the receiver, and every next shot to the other
side. The app flags (but still explains): a serve from the wrong service court for the score,
a server outside their service court, no receiver standing in the receiving court, a serve
that isn't diagonal, short or long serves, shots landing out, overheads played from
the forecourt, net shots played from deep, and lifts or smashes to the middle.

## Not modelled (yet)

- Mixed doubles conventions (the woman holding the front court, the man covering the back).
- Player strengths (left-handers, a weak backhand corner) and opponent tendencies.
- Exact rotation timing in fast rallies. The app shows where to be *after* the current shot,
  not the path between spots.

## Sources

- [Badminton Bible: central base (singles)](https://badmintonbible.com/tactics/singles/central-base)
- [Badminton Bible: defensive angles (doubles)](https://badmintonbible.com/tactics/doubles/choosing-shots/defensive-angles)
- [Badminton Bible: scoring rules](https://www.badmintonbible.com/rules/scoring)
- [Badminton Insight: how to defend in singles](https://badminton-insight.com/how-to-defend-in-singles/)
- [Badminton Insight: serving and returning in mixed doubles](https://badminton-insight.com/how-to-serve-and-return-serve-in-mixed-doubles/)
- [BadmintonBay: defending a powerful smash in doubles](https://blog.badmintonbay.com/how-to-defend-a-powerful-smash-in-badminton-doubles-6-steps/)
- [Badminton Fanatiker: positioning and formations in doubles](https://badmintonfanatiker.com/positioning-and-formations-in-doubles/)
- [Badminton Fanatiker: footwork basics](https://badmintonfanatiker.com/footwork-basics/)
- [TeachPE: badminton doubles strategy](https://www.teachpe.com/?p=900)
- [Robinson College (Cambridge): doubles court positioning](https://www.robinson.cam.ac.uk/iar1/badminton/Graduates_Badminton_Club_Doubles_Court_Positioning.pdf)
- [UVic: half-court singles base](https://web.uvic.ca/~thopper/Unitplan452/netwall2000/Lisa&chris9Bad.2/Links/..%5CGametasks%5Chalfbase.html)
- [Badminton Coach UK: mixed doubles serve and return](https://badminton-coach.co.uk/12636/badminton-positioning-mixed-doubles-serve-return/)

The numbers (depths in metres, shading percentages) are tuned starting points drawn from
these sources and general coaching practice. They aren't published constants. Adjust them in
`src/rules.js` if your club coaches it differently.
