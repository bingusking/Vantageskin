// Knife inspects: one unique animation per knife type.
//
// Each animation is a function of time T (seconds) returning:
//   roll, flex, dev   turns of the HAND (radians) about its own axes through
//                     the grip: roll = forearm turning over, flex = wrist
//                     bending (turns the flat of the blade to you), dev =
//                     wrist cocking sideways (tip up / down). The arm follows,
//                     so the hand really moves with the knife.
//   x, y, z           the hand's offset in view space (metres, +x right, +y up, +z back).
//   spins             turns of the KNIFE inside the hand: [pivot, axis, angle]
//                     in the knife's own axes (+x right, +y up, -z toward the
//                     tip), applied in order. Karambit / lanyard / ring spins
//                     pivot on the ring or lanyard at the fingers.
//   toss              the knife leaving the hand: an offset in view space (metres).
//   fold              folding blades: blade angle about its pivot (0 open, ~PI closed).
//   bf                balisong: { blade, handleB } angles (see butterfly below).
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI, TAU = Math.PI * 2;
const ease = (x) => x * x * (3 - 2 * x);
// eased 0..1 between a and b
const seg = (T, a, b) => (T <= a ? 0 : T >= b ? 1 : ease((T - a) / (b - a)));
// linear 0..1 between a and b (for spins that should keep their speed)
const lin = (T, a, b) => (T <= a ? 0 : T >= b ? 1 : (T - a) / (b - a));
// a fast start that slows to a stop: for flicks and spins that get caught
const out = (T, a, b) => { const x = lin(T, a, b); return 1 - (1 - x) ** 3; };
// a smooth 0 → 1 → 0 pulse
const bump = (T, a, b) => (T <= a || T >= b ? 0 : Math.sin((T - a) / (b - a) * PI));
// sampled key poses for the hand: rows of [t, roll, flex, dev, x, y, z]
function keys(rows) {
  return (T) => {
    if (T >= rows[rows.length - 1][0]) return rows[rows.length - 1].slice(1);
    let i = 0; while (rows[i + 1][0] < T) i++;
    const a = rows[i], b = rows[i + 1], f = ease((T - a[0]) / (b[0] - a[0]));
    return a.slice(1).map((v, k) => v + (b[k + 1] - v) * f);
  };
}
const hand = (k) => ({ roll: k[0], flex: k[1], dev: k[2], x: k[3], y: k[4], z: k[5] });

// Knife axes: the blade plane is the y/z plane, so a spin "in the blade
// plane" turns about +x; a twirl about the blade's own length turns about z.
const AX = V(1, 0, 0), AY = V(0, 1, 0), AZ = V(0, 0, 1);
const GRIP = V(0, 0, 0.04);
// up into view, a little toward the middle and closer
const UP = [-0.055, 0.034, 0.02];
const up = (dx = 0, dy = 0, dz = 0) => [UP[0] + dx, UP[1] + dy, UP[2] + dz];

export const KNIFE_ANIM = {
  // Field Knife: the plain one. Lift it, tilt the flat to you, turn it over.
  standard: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.12, -0.5, 0, ...up()],
      [1.3, 0.18, -0.56, 0.06, ...up()],
      [1.8, -0.55, 0.35, 0, ...up(0.005)],
      [2.7, -0.6, 0.4, -0.05, ...up(0.005)],
      [3.3, 0, 0, 0, 0, 0, 0],
    ]);
    return { dur: 3.3, f: (T) => hand(k(T)) };
  })(),

  // Bayonet: look down the spine, flip it over in the fingers, then a full
  // spin in the blade plane caught with a snap of the wrist.
  bayonet: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.1, -0.35, 0.35, ...up(0, 0.01)],
      [1.15, 0.15, -0.4, 0.4, ...up(0, 0.01)],
      [1.5, 0.05, -0.55, 0.1, ...up()],
      [2.3, 0.1, -0.5, 0.1, ...up()],
      [2.55, 0.0, -0.3, -0.35, ...up(0, -0.01)],
      [2.95, 0.05, -0.4, 0.2, ...up(0, 0.008)],
      [3.6, 0, 0, 0, 0, 0, 0],
    ]);
    return {
      dur: 3.6,
      f: (T) => ({ ...hand(k(T)), spins: [[GRIP, AZ, PI * seg(T, 1.2, 1.55)], [GRIP, AX, TAU * out(T, 2.4, 2.9)], [GRIP, AZ, PI * seg(T, 3.0, 3.35)]] }),
    };
  })(),

  // Combat Bayonet: brings the tip round toward you to look down the edge,
  // then turns it slowly on its edge.
  combat: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.5, 0.0, -0.2, -0.7, ...up(-0.01, 0.015)],
      [1.2, 0.1, -0.25, -0.75, ...up(-0.01, 0.015)],
      [1.9, 0.75, -0.2, -0.55, ...up(-0.005, 0.01)],
      [2.6, -0.5, -0.2, -0.45, ...up(-0.005, 0.01)],
      [3.0, 0.1, -0.4, 0, ...up()],
      [3.5, 0, 0, 0, 0, 0, 0],
    ]);
    return { dur: 3.5, f: (T) => hand(k(T)) };
  })(),

  // Karambit: reverse grip, index finger through the ring. Two spins forward
  // round the finger, one back, caught; then turned over to show the other face.
  karambit: (() => {
    const RING = V(0, -0.0685, 0.058);
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.45, 0.05, 0, ...up(0, 0.01)],
      [0.9, 0.35, 0.0, 0, ...up(-0.01, 0.025)],
      [1.95, 0.35, 0.0, 0, ...up(-0.01, 0.025)],
      [2.55, 0.3, 0.0, 0, ...up(-0.01, 0.02)],
      [2.9, 0.75, 0.15, 0, ...up(0, 0.01)],
      [3.3, -0.25, 0.1, 0, ...up(0, 0.01)],
      [3.8, 0, 0, 0, 0, 0, 0],
    ]);
    return {
      dur: 3.8,
      f: (T) => {
        const fwd = seg(T, 0.9, 1.95) * 2 * TAU;          // two turns forward
        const back = -out(T, 2.1, 2.55) * TAU;            // and one back
        const a = fwd + back;
        const s = hand(k(T));
        // the wrist drives the spin: a little circle per turn, and a flick to catch
        s.dev += Math.sin(a) * 0.18 * bump(T, 0.9, 2.55) + 0.25 * bump(T, 1.9, 2.15);
        s.x += Math.cos(a) * 0.006 * bump(T, 0.9, 2.55);
        s.y += Math.sin(a) * 0.008 * bump(T, 0.9, 2.55);
        return { ...s, spins: [[RING, AX, a]] };
      },
    };
  })(),

  // Balisong: the hand holds one handle while the blade and the other handle
  // swing round the pivot: a close, a rollover round the fingers, an open
  // with the bite handle flaring out, then an aerial twirl.
  butterfly: (() => {
    const PIV = V(0, 0, -0.003);
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.4, 0.15, -0.35, 0, ...up(0, 0.01)],
      [0.65, 0.25, -0.35, -0.35, ...up(0, 0.015)],   // flick to close
      [0.95, 0.1, -0.4, 0.2, ...up(0, 0.01)],
      [1.6, 0.15, -0.4, 0.1, ...up(-0.01, 0.02)],     // rollover
      [1.85, 0.2, -0.35, 0.4, ...up(0, 0.02)],       // flick to open
      [2.2, 0.1, -0.4, -0.2, ...up(0, 0.01)],
      [2.55, 0.5, -0.3, 0.0, ...up(-0.01, 0.02)],     // aerial
      [3.2, -0.2, -0.45, 0.0, ...up(-0.01, 0.02)],
      [3.55, 0.1, -0.5, 0.0, ...up()],
      [4.0, 0, 0, 0, 0, 0, 0],
    ]);
    return {
      dur: 4.0,
      f: (T) => {
        // blade angle relative to the held handle: closes (PI), then comes round open (2PI = open again)
        const blade = PI * seg(T, 0.5, 0.95) + PI * out(T, 1.75, 2.2);
        // the bite handle flares away as the blade comes out
        const handleB = -0.85 * PI * bump(T, 1.7, 2.3);
        // rollover: the closed knife turns a full circle round the fingers
        const roll = TAU * seg(T, 1.0, 1.65);
        // aerial: a full twirl about the knife's length with both handles fanned
        const aerial = TAU * seg(T, 2.5, 3.25);
        return {
          ...hand(k(T)),
          spins: [[PIV, AX, blade], [GRIP, AX, roll], [GRIP, AZ, aerial]],
          bf: { blade, handleB: handleB - 0.5 * PI * bump(T, 2.5, 3.25), fan: 0.5 * PI * bump(T, 2.5, 3.25) },
        };
      },
    };
  })(),

  // Flip Knife: folds it shut, then flicks it open with a snap of the wrist.
  flip: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.15, -0.45, 0, ...up()],
      [1.0, 0.3, -0.5, 0.1, ...up(0, 0.01)],
      [1.3, 0.3, -0.5, 0.15, ...up(0, 0.012)],
      [1.42, 0.25, -0.5, -0.45, ...up(0, 0.0)],        // the flick
      [1.7, 0.15, -0.5, 0.1, ...up(0, 0.01)],
      [2.2, -0.5, 0.3, 0, ...up(0.005)],
      [2.8, -0.55, 0.35, 0, ...up(0.005)],
      [3.4, 0, 0, 0, 0, 0, 0],
    ]);
    return { dur: 3.4, f: (T) => ({ ...hand(k(T)), fold: 3.0 * (seg(T, 0.5, 1.0) - out(T, 1.33, 1.5)) }) };
  })(),

  // Gut Hook: tossed up out of the hand, flips once in the air, caught.
  gut: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.1, -0.45, 0, ...up()],
      [0.75, 0.1, -0.4, 0.1, ...up(0, -0.012)],        // dip
      [0.9, 0.1, -0.35, 0.25, ...up(0, 0.012)],        // throw
      [1.55, 0.1, -0.4, 0.1, ...up(0, 0.02)],          // wait under it
      [1.72, 0.1, -0.4, 0.0, ...up(0, -0.008)],        // catch
      [2.0, 0.1, -0.45, 0.05, ...up()],
      [2.5, -0.55, 0.35, 0, ...up(0.005)],
      [2.9, -0.6, 0.4, 0, ...up(0.005)],
      [3.4, 0, 0, 0, 0, 0, 0],
    ]);
    return {
      dur: 3.4,
      f: (T) => {
        const air = lin(T, 0.88, 1.68);
        return { ...hand(k(T)), toss: V(0, 0.09 * 4 * air * (1 - air), 0), spins: [[GRIP, AX, TAU * air]] };
      },
    };
  })(),

  // Bowie: heavy. Raised blade-up in front of you, turned slowly both ways,
  // then a little bounce to feel the weight.
  bowie: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.55, 0.0, -0.3, 0.75, ...up(-0.01, 0.02)],
      [1.4, 0.55, -0.3, 0.75, ...up(-0.01, 0.022)],
      [2.2, -0.55, -0.3, 0.75, ...up(-0.01, 0.022)],
      [2.55, 0.0, -0.3, 0.6, ...up(-0.01, 0.012)],
      [2.75, 0.0, -0.3, 0.75, ...up(-0.01, 0.022)],
      [3.6, 0, 0, 0, 0, 0, 0],
    ]);
    return { dur: 3.6, f: (T) => hand(k(T)) };
  })(),

  // Push daggers: one in each fist (the left hand mirrors the right). The
  // fists turn the blades flat to you, cross in front, then a double jab.
  push: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.6, -0.2, 0, ...up(0.025, 0.005)],
      [1.2, 0.7, -0.25, 0, ...up(0.02, 0.01)],
      [1.7, -0.45, 0.15, 0, ...up(0.025, 0.02)],       // turned out, blades up
      [2.3, -0.5, 0.2, 0, ...up(0.025, 0.02)],
      [2.55, 0.0, 0.0, 0, ...up(0.03, 0, -0.07)],      // jab
      [2.75, 0.0, 0.0, 0, ...up(0.03, 0, 0.0)],
      [2.9, 0.0, 0.0, 0, ...up(0.03, 0, -0.06)],       // jab
      [3.1, 0.0, 0.0, 0, ...up(0.03, 0, 0.0)],
      [3.5, 0, 0, 0, 0, 0, 0],
    ]);
    return { dur: 3.5, f: (T) => hand(k(T)) };
  })(),

  // Navaja: folds closed, then ratchets open in three clicks.
  navaja: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.1, -0.55, 0, ...up()],
      [3.2, 0.2, -0.6, 0.1, ...up()],
      [3.8, 0, 0, 0, 0, 0, 0],
    ]);
    const clicks = [[1.35, 1.5], [1.9, 2.05], [2.45, 2.6]];
    return {
      dur: 3.8,
      f: (T) => {
        const s = hand(k(T));
        let fold = 2.9 * seg(T, 0.5, 1.0);
        for (const [a, b] of clicks) { fold -= (2.9 / 3) * out(T, a, b); s.dev += 0.1 * bump(T, a, b + 0.1); s.y += 0.004 * bump(T, a, b + 0.1); }
        s.roll += 0.25 * bump(T, 0.5, 1.2);
        return { ...s, fold: Math.max(0, fold) };
      },
    };
  })(),

  // Stiletto: twirled like a pen about its own length, then held tip-up.
  stiletto: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.1, -0.4, 0.1, ...up()],
      [1.7, 0.1, -0.4, 0.1, ...up(-0.01, 0.01)],
      [2.1, 0.0, -0.25, 0.85, ...up(-0.01, 0.02)],
      [2.8, 0.25, -0.25, 0.85, ...up(-0.01, 0.02)],
      [3.4, 0, 0, 0, 0, 0, 0],
    ]);
    return {
      dur: 3.4,
      f: (T) => {
        const a = 2 * TAU * seg(T, 0.5, 1.7);
        const s = hand(k(T));
        s.roll += Math.sin(a) * 0.15 * bump(T, 0.5, 1.7);     // the fingers roll it, the wrist rocks
        return { ...s, spins: [[GRIP, AZ, a]] };
      },
    };
  })(),

  // Kukri: turned to show the curve, a slow chop, then the other side.
  kukri: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.5, 0.9, -0.2, 0, ...up(0, 0.01)],
      [1.3, 1.0, -0.25, 0.1, ...up(0, 0.012)],
      [1.6, 0.4, -0.3, 0.55, ...up(0, 0.03)],          // wind up
      [1.85, 0.4, -0.3, -0.6, ...up(0, -0.02)],        // chop
      [2.1, 0.3, -0.35, -0.4, ...up(0, -0.015)],
      [2.5, -0.6, 0.35, 0, ...up(0.005)],
      [3.0, -0.65, 0.4, 0, ...up(0.005)],
      [3.5, 0, 0, 0, 0, 0, 0],
    ]);
    return { dur: 3.5, f: (T) => hand(k(T)) };
  })(),

  // Tanto: held flat across the view like a sword being presented, drawn
  // along, then the edge turned to you.
  tanto: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.55, 0.05, -0.85, -0.25, ...up(-0.03, 0.025)],
      [1.6, 0.05, -0.85, -0.25, ...up(0.0, 0.025)],
      [2.2, 0.75, -0.6, -0.2, ...up(-0.01, 0.02)],
      [2.8, 0.8, -0.6, -0.2, ...up(-0.01, 0.02)],
      [3.4, 0, 0, 0, 0, 0, 0],
    ]);
    return { dur: 3.4, f: (T) => hand(k(T)) };
  })(),

  // Survival Knife: flipped into a reverse grip, looked over, flipped back.
  survival: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.1, -0.4, 0, ...up()],
      [0.65, 0.1, -0.4, 0.35, ...up(0, 0.012)],
      [0.95, 0.1, -0.3, -0.2, ...up(0, 0.0)],
      [1.6, 0.6, -0.2, -0.1, ...up(-0.005, 0.01)],
      [2.1, 0.4, -0.2, 0.1, ...up(0, 0.01)],
      [2.35, 0.3, -0.3, -0.3, ...up(0, 0.0)],
      [2.65, 0.1, -0.45, 0.1, ...up(0, 0.01)],
      [3.6, 0, 0, 0, 0, 0, 0],
    ]);
    return { dur: 3.6, f: (T) => ({ ...hand(k(T)), spins: [[GRIP, AX, PI * out(T, 0.62, 0.95) + PI * out(T, 2.25, 2.6)]] }) };
  })(),

  // Skeleton Knife: spun round the little finger through the pommel ring.
  skeleton: (() => {
    const RING = V(0, 0, 0.108);
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.15, -0.45, 0, ...up()],
      [0.75, 0.15, -0.4, 0.25, ...up(0, 0.01)],
      [2.05, 0.1, -0.4, 0.1, ...up(-0.005, 0.015)],
      [2.6, -0.5, 0.3, 0, ...up(0.005)],
      [3.0, -0.55, 0.35, 0, ...up(0.005)],
      [3.6, 0, 0, 0, 0, 0, 0],
    ]);
    return {
      dur: 3.6,
      f: (T) => {
        const a = -3 * TAU * seg(T, 0.75, 2.05);
        const s = hand(k(T));
        s.x += Math.cos(a) * 0.006 * bump(T, 0.75, 2.05);
        s.y += Math.sin(a) * 0.006 * bump(T, 0.75, 2.05);
        return { ...s, spins: [[RING, AX, a]] };
      },
    };
  })(),

  // Hawkbill: closed, then opened slowly with the thumb on the stud.
  hawkbill: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.2, -0.5, 0, ...up()],
      [1.1, 0.35, -0.55, 0.05, ...up(-0.005, 0.01)],
      [2.3, 0.1, -0.6, 0.1, ...up(-0.005, 0.012)],
      [2.7, -0.45, 0.3, 0, ...up(0.005)],
      [3.1, -0.5, 0.35, 0, ...up(0.005)],
      [3.6, 0, 0, 0, 0, 0, 0],
    ]);
    return {
      dur: 3.6,
      f: (T) => {
        const s = hand(k(T));
        s.dev += 0.04 * Math.sin(T * 30) * bump(T, 1.4, 2.25);    // the thumb working it open
        return { ...s, fold: 3.0 * (seg(T, 0.5, 1.0) - seg(T, 1.35, 2.3)) };
      },
    };
  })(),

  // Trench Knife: a punch with the knuckle guard, then the fist rolled over
  // to show the studs.
  trench: (() => {
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.4, 0.2, -0.3, 0, ...up(0, 0, 0.01)],
      [0.6, 0.2, -0.2, 0, ...up(-0.01, 0, -0.08)],     // punch
      [0.85, 0.2, -0.3, 0, ...up(0, 0, 0.01)],
      [1.5, 1.15, -0.25, 0, ...up(-0.005, 0.015)],    // studs to you
      [2.2, 1.2, -0.3, 0.1, ...up(-0.005, 0.015)],
      [2.7, -0.45, 0.3, 0, ...up(0.005)],
      [3.2, 0, 0, 0, 0, 0, 0],
    ]);
    return { dur: 3.2, f: (T) => hand(k(T)) };
  })(),

  // Cord Knife: let go and spun round on its lanyard, then caught.
  cord: (() => {
    const LAN = V(0, 0, 0.115);
    const k = keys([
      [0, 0, 0, 0, 0, 0, 0],
      [0.45, 0.1, -0.4, 0, ...up()],
      [0.6, 0.1, -0.4, 0.2, ...up(0, 0.01)],
      [2.3, 0.1, -0.4, 0.1, ...up(-0.005, 0.015)],
      [2.55, 0.1, -0.45, -0.1, ...up(0, 0.005)],
      [3.0, -0.5, 0.3, 0, ...up(0.005)],
      [3.8, 0, 0, 0, 0, 0, 0],
    ]);
    return {
      dur: 3.8,
      f: (T) => {
        const a = PI * seg(T, 0.6, 0.85) + 2 * TAU * lin(T, 0.85, 2.0) + PI * out(T, 2.0, 2.4);
        const s = hand(k(T));
        const w = bump(T, 0.7, 2.3);
        s.x += Math.cos(a) * 0.01 * w;
        s.y += Math.sin(a) * 0.01 * w;
        s.dev += Math.sin(a) * 0.15 * w;
        return { ...s, toss: V(0, -0.01 * w, 0), spins: [[LAN, AX, a]] };
      },
    };
  })(),
};

// Folding blades: the pivot in the model's own (inner) axes, x along the blade.
export const FOLD_PIVOT = { flip: [0.008, 0], hawkbill: [0.008, 0], navaja: [0.014, 0] };
