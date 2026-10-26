// Playable 2.5D flight: x/y are world pixels, altitude is gameplay metres.
// Intentionally tuned for clear control feedback; this is not a CFD model.
export const FLIGHT = Object.freeze({
  gravity: 4.5,
  impulsePerWing: 5.4,
  thrustPerWing: 17,
  turnPerWing: 0.16,
  maxRise: 14,
  maxFall: 9,
  maxSpeed: 165,
  horizontalDrag: 0.38,
  verticalDrag: 0.15,
  forwardAccel: 23,
  glidingLift: 8,
  stallSpeed: 12,
  maxAltitude: 40 // Temporary gameplay ceiling until a cloud layer exists.
});
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

export function updateFlightPhysics(bird, dt, world) {
  const left = bird.leftFlapCount;
  const right = bird.rightFlapCount;
  bird.leftFlapCount = bird.rightFlapCount = 0;
  const total = left + right;
  // The test-flap shortcut still works when no detailed wing impulse was queued.
  const leftLift = bird.leftLiftImpulse || left;
  const rightLift = bird.rightLiftImpulse || right;
  const leftThrust = bird.leftThrustImpulse || left;
  const rightThrust = bird.rightThrustImpulse || right;
  const brakeImpulse = bird.leftBrakeImpulse + bird.rightBrakeImpulse;
  bird.leftLiftImpulse = bird.rightLiftImpulse = 0;
  bird.leftThrustImpulse = bird.rightThrustImpulse = 0;
  bird.leftBrakeImpulse = bird.rightBrakeImpulse = 0;
  if (total) {
    bird.totalFlaps = (bird.totalFlaps || 0) + total;
    bird.flapFeedbackTimer = 0.45;
  }

  // Ground movement belongs to bird.js. The first completed stroke must lift off.
  if (bird.grounded && !total && !bird.perchedOn) {
    bird.altitude = 0;
    bird.velocityX = bird.velocityY = bird.velocityZ = 0;
    bird.x = clamp(bird.x, 12, world.width - 12);
    bird.y = clamp(bird.y, 12, world.height - 12);
    return;
  }

  if (total) {
    const liftMultiplier = bird.pitch === 'backward' ? 1.12 :
      bird.pitch === 'forward' ? 0.83 : 1;
    const thrustMultiplier = bird.pitch === 'forward' ? 1.26 :
      bird.pitch === 'backward' ? 0.62 : 1;
    bird.velocityZ += (leftLift + rightLift) * FLIGHT.impulsePerWing * liftMultiplier;
    const thrust = (leftThrust + rightThrust) * FLIGHT.thrustPerWing * thrustMultiplier;
    bird.velocityX += Math.sin(bird.heading) * thrust;
    bird.velocityY -= Math.cos(bird.heading) * thrust;
    // The outer wing produces a greater impulse, initiating a bank into a turn.
    // Right-only flaps -> negative bank (left), left-only -> positive bank (right).
    bird.bank += (leftLift - rightLift) * 0.22;
    bird.roll = bird.bank;
    const brake = brakeImpulse * 0.10;
    bird.velocityX *= (1 - Math.min(0.32, brake));
    bird.velocityY *= (1 - Math.min(0.32, brake));
    bird.grounded = false;
  }

  const wind = world.windAt ? world.windAt(bird.x, bird.y, bird.altitude) :
    { x: 0, y: 0, up: 0 };
  const drag = FLIGHT.horizontalDrag + (bird.pitch === 'backward' ? 0.62 : 0) +
    (bird.flightMode === 'flare' ? 0.75 : 0);
  if (bird.pitch === 'forward') {
    bird.velocityX += Math.sin(bird.heading) * FLIGHT.forwardAccel * dt;
    bird.velocityY -= Math.cos(bird.heading) * FLIGHT.forwardAccel * dt;
  }
  // Wind is treated as a moving air mass; it only gently advects a bird.
  bird.velocityX += (wind.x - bird.velocityX) * 0.026 * dt;
  bird.velocityY += (wind.y - bird.velocityY) * 0.026 * dt;
  bird.velocityX *= Math.exp(-drag * dt);
  bird.velocityY *= Math.exp(-drag * dt);

  const speed = Math.hypot(bird.velocityX, bird.velocityY);
  if (speed > FLIGHT.maxSpeed) {
    const ratio = FLIGHT.maxSpeed / speed;
    bird.velocityX *= ratio;
    bird.velocityY *= ratio;
  }
  const airspeed = Math.hypot(bird.velocityX - wind.x, bird.velocityY - wind.y);
  bird.airspeed = airspeed;
  // Roll-driven steering. More airspeed gives a stronger banked turn;
  // it is not an instantaneous fixed heading step for each key press.
  const bankMax = 0.65;
  bird.bank = clamp(bird.bank, -bankMax, bankMax);
  bird.heading += bird.bank * (0.18 + Math.min(0.42, airspeed * 0.004)) * dt;
  bird.bank *= Math.exp(-2.5 * dt);
  bird.roll = bird.bank;
  // Pilot-controlled glide: 4+6 spread the wings. At sufficient airspeed,
  // 2 flares/brakes and produces more lift, 5 is a regular glide, while 8
  // dives to exchange altitude for forward speed. No lift without airspeed.
  // This is intentionally a gameplay model, not a full aerodynamic solver.
  const glideFraction = clamp((airspeed - FLIGHT.stallSpeed) / 45, 0, 1);
  const modeLift = bird.flightMode === 'glide' ? 1.0 :
    bird.flightMode === 'flare' ? 1.14 :
    bird.flightMode === 'fast-glide' ? 0.56 : 0.75;
  const pitchLiftFactor = bird.pitch === 'backward' ? 1.35 :
    bird.pitch === 'forward' ? 0.54 : 1;
  const glideCeiling = bird.pitch === 'backward' ? 0.98 :
    bird.pitch === 'forward' ? 0.55 : 0.88;
  const glideLift = bird.glide ? Math.min(FLIGHT.gravity * glideCeiling,
    FLIGHT.glidingLift * glideFraction * pitchLiftFactor * modeLift) : 0;
  const forwardDive = bird.pitch === 'forward' ? 2.2 : 0;
  bird.velocityZ += (glideLift + wind.up - FLIGHT.gravity - forwardDive) * dt;
  bird.velocityZ *= Math.exp(-FLIGHT.verticalDrag * dt);
  bird.velocityZ = clamp(bird.velocityZ, -FLIGHT.maxFall, FLIGHT.maxRise);

  bird.x += bird.velocityX * dt;
  bird.y += bird.velocityY * dt;
  bird.altitude += bird.velocityZ * dt;

  // The HUD gauge covers 0–40 m. Until higher-altitude cloud gameplay exists,
  // prevent climb velocity accumulating while the bird is at the ceiling.
  const ceiling = Math.min(FLIGHT.maxAltitude, world.maxAltitude ?? FLIGHT.maxAltitude);
  if (bird.altitude >= ceiling) {
    bird.altitude = ceiling;
    if (bird.velocityZ > 0) bird.velocityZ = 0;
  }

  if (bird.altitude <= 0) {
    bird.altitude = 0;
    bird.velocityZ = 0;
    bird.velocityX = bird.velocityY = 0;
    bird.grounded = true;
  } else {
    bird.grounded = false;
  }
  const nx = clamp(bird.x, 12, world.width - 12);
  const ny = clamp(bird.y, 12, world.height - 12);
  if (nx !== bird.x) bird.velocityX = 0;
  if (ny !== bird.y) bird.velocityY = 0;
  bird.x = nx;
  bird.y = ny;
  bird.roll = bird.bank;
}
