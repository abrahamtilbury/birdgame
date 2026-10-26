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
  stallSpeed: 12
});
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

export function updateFlightPhysics(bird, dt, world) {
  const left = bird.leftFlapCount;
  const right = bird.rightFlapCount;
  bird.leftFlapCount = bird.rightFlapCount = 0;
  const total = left + right;
  if (total) {
    bird.totalFlaps = (bird.totalFlaps || 0) + total;
    bird.flapFeedbackTimer = 0.7;
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
    bird.velocityZ += total * FLIGHT.impulsePerWing * liftMultiplier;
    bird.heading += (left - right) * FLIGHT.turnPerWing;
    bird.roll += (left - right) * 0.18;
    bird.velocityX += Math.sin(bird.heading) * FLIGHT.thrustPerWing * total * thrustMultiplier;
    bird.velocityY -= Math.cos(bird.heading) * FLIGHT.thrustPerWing * total * thrustMultiplier;
    bird.grounded = false;
  }

  const wind = world.windAt ? world.windAt(bird.x, bird.y, bird.altitude) :
    { x: 0, y: 0, up: 0 };
  const drag = FLIGHT.horizontalDrag + (bird.pitch === 'backward' ? 0.62 : 0);
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
  // Spreading the wings slows descent at sufficient airspeed; still air cannot
  // produce free altitude gain. Rising air can provide additional lift.
  const glideFraction = clamp((airspeed - FLIGHT.stallSpeed) / 45, 0, 1);
  const glideLift = bird.glide ? Math.min(FLIGHT.gravity * 0.92,
    FLIGHT.glidingLift * glideFraction) : 0;
  const forwardDive = bird.pitch === 'forward' ? 0.8 : 0;
  bird.velocityZ += (glideLift + wind.up - FLIGHT.gravity - forwardDive) * dt;
  bird.velocityZ *= Math.exp(-FLIGHT.verticalDrag * dt);
  bird.velocityZ = clamp(bird.velocityZ, -FLIGHT.maxFall, FLIGHT.maxRise);

  bird.x += bird.velocityX * dt;
  bird.y += bird.velocityY * dt;
  bird.altitude += bird.velocityZ * dt;

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
  bird.roll *= Math.exp(-3.5 * dt);
}
