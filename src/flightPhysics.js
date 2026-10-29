// Bird Flight v0.12 — deterministic, manual-wing flight model.
// Horizontal coordinates/velocities: game pixels and pixels/s.
// Altitude and vertical velocity: gameplay metres and metres/s.
// All coefficients are game-tuned; this is not a calibrated CFD model.

export const FLIGHT = Object.freeze({
  gravity: 9.8,
  impulsePerWing: 2.6,
  thrustPerWing: 17,
  maxRise: 14,
  maxFall: 22,
  maxSpeed: 165,
  maxAltitude: 40,
  horizontalDrag: 0.28,
  verticalDrag: 0.08,
  diveExchange: 2.8,
  glidingLift: 8,
  stallSpeed: 28,
  rollImpulse: 3.8,
  rollRestoring: 14,
  rollDamping: 7.5,
  heldRollTorque: 5,
  maxBank: 1.02,
  lateralAcceleration: 160,
  coordinatedStrokeWindow: 0.16,
  lateralImpulsePerWing: 18,
  yawResponse: 11
});

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const ease = (value, target, dt, rate) =>
  value + (target - value) * (1 - Math.exp(-rate * dt));

// WingFold is extension, NOT the same thing as aerodynamic surface area.
// At a fixed span, the actual stage changes the useful lifting surface.
const POSE_AREA = Object.freeze({
  rest: 0,
  raised: 0.45,
  middle: 1,
  lowered: 0.35
});

function wingArea(bird, side) {
  return clamp(bird[`${side}WingFold`] || 0, 0, 1) *
    (POSE_AREA[bird[`${side}Wing`]] ?? 0);
}

// Only *lowered* inputs are powered strokes. Events come directly from
// bird.js with their original performance.now() timestamps. A pending
// stroke may be paired ONCE with an opposite-side stroke within 160 ms.
function consumePowerStrokes(bird, world) {
  const pending = bird.pendingPowerStrokes ??= { left: null, right: null };
  const events = bird.powerStrokeEvents?.splice(0) ?? [];
  let pairedLift = 0;
  let pairedThrust = 0;
  let pairs = 0;

  for (const event of events) {
    const side = event.side;
    if (side !== 'left' && side !== 'right') continue;
    const opposite = side === 'left' ? 'right' : 'left';
    const time = Number.isFinite(event.atMs)
      ? event.atMs
      : world.time * 1000;
    const other = pending[opposite];

    if (other && time >= other.atMs &&
        time - other.atMs <= FLIGHT.coordinatedStrokeWindow * 1000) {
      pairedLift += 2 * Math.min(event.lift, other.lift);
      pairedThrust += event.thrust + other.thrust;
      pairs++;
      pending[opposite] = null;
      pending[side] = null;
    } else {
      // Same-side strokes replace older ones; no old credit can be reused.
      pending[side] = { ...event, atMs: time };
      if (pending[opposite] &&
          time - pending[opposite].atMs > FLIGHT.coordinatedStrokeWindow * 1000) {
        pending[opposite] = null;
      }
    }
  }

  return { pairedLift, pairedThrust, pairs };
}

export function updateFlightPhysics(bird, dt, world) {
  // 1. Consume one-off impulses once per physics tick.
  const left = bird.leftFlapCount || 0;
  const right = bird.rightFlapCount || 0;
  const total = left + right;
  const leftLift = bird.leftLiftImpulse || 0;
  const rightLift = bird.rightLiftImpulse || 0;
  const leftThrust = bird.leftThrustImpulse || 0;
  const rightThrust = bird.rightThrustImpulse || 0;
  const brakeImpulse =
    (bird.leftBrakeImpulse || 0) + (bird.rightBrakeImpulse || 0);

  bird.leftFlapCount = bird.rightFlapCount = 0;
  bird.leftLiftImpulse = bird.rightLiftImpulse = 0;
  bird.leftThrustImpulse = bird.rightThrustImpulse = 0;
  bird.leftBrakeImpulse = bird.rightBrakeImpulse = 0;

  const pair = consumePowerStrokes(bird, world);
  bird.pairedStrokes = (bird.pairedStrokes || 0) + pair.pairs;

  if (total > 0) {
    bird.totalFlaps = (bird.totalFlaps || 0) + total;
    bird.flapFeedbackTimer = 0.45;
  }

  // 2. An unpaired stroke cannot launch the bird, even if tapped repeatedly.
  // Let event timestamps survive grounded ticks for staggered 1+3 takeoff.
  if (bird.grounded && !bird.perchedOn && pair.pairs === 0) {
    bird.altitude = 0;
    bird.velocityX = bird.velocityY = bird.velocityZ = 0;
    bird.rollRate = bird.yawRate = bird.bank = bird.roll = 0;
    bird.aeroSpan = bird.aeroLift = 0;
    bird.aeroState = 'GROUND';
    bird.x = clamp(bird.x, 12, world.width - 12);
    bird.y = clamp(bird.y, 12, world.height - 12);
    return;
  }

  if (bird.perchedOn && pair.pairs === 0) {
    // A perched bird must not fall or drift just because wind exists.
    bird.velocityX = bird.velocityY = bird.velocityZ = 0;
    bird.aeroLift = 0;
    return;
  }

  bird.rollRate ??= 0;
  bird.yawRate ??= 0;
  bird.bank ??= 0;
  bird.tailSpread ??= 0.35;
  bird.tailTwist ??= 0;
  const wasGrounded = bird.grounded;
  const wasPerched = !!bird.perchedOn;

  const forwardX = Math.sin(bird.heading);
  const forwardY = -Math.cos(bird.heading);
  const rightX = Math.cos(bird.heading);
  const rightY = Math.sin(bird.heading);
  const wind = world.windAt?.(bird.x, bird.y, bird.altitude) ??
    { x: 0, y: 0, up: 0 };

  // 3. Aerodynamic wing geometry, separate from the powered stroke impulse.
  const leftArea = wingArea(bird, 'left');
  const rightArea = wingArea(bird, 'right');
  const averageArea = (leftArea + rightArea) / 2;
  const glideSpan = Math.min(leftArea, rightArea);
  const turningSpan = Math.sqrt(averageArea);
  const relativeX = bird.velocityX - wind.x;
  const relativeY = bird.velocityY - wind.y;
  const preAirspeed = Math.hypot(relativeX, relativeY);
  const controlAuthority = clamp(
    (preAirspeed - FLIGHT.stallSpeed * 0.5) / 45, 0, 1
  );

  // 4. Coordinated powered downstroke creates vertical lift.
  // One-wing strokes have zero *powered vertical* lift, but still shove/roll.
  if (pair.pairs > 0) {
    const liftMultiplier =
      bird.pitch === 'backward' ? 1.12 :
      bird.pitch === 'forward' ? 0.83 : 1;
    const verticalFactor = Math.max(0.68, Math.cos(bird.bank));
    bird.velocityZ += pair.pairedLift * FLIGHT.impulsePerWing *
      liftMultiplier * verticalFactor;
    bird.grounded = false;
  }

  // 5. Airborne primitive events provide thrust, lateral shove and roll.
  // Takeoff instead uses BOTH halves of the coordinated stroke, so a
  // staggered 1-then-3 takeoff won't receive a spurious sideways kick.
  const thrustMultiplier =
    bird.pitch === 'forward' ? 1.26 :
    bird.pitch === 'backward' ? 0.62 : 1;
  if (wasGrounded || wasPerched) {
    if (pair.pairs > 0) {
      const thrust = pair.pairedThrust * FLIGHT.thrustPerWing * thrustMultiplier;
      bird.velocityX += forwardX * thrust;
      bird.velocityY += forwardY * thrust;
    }
  } else if (total > 0) {
    const thrust = (leftThrust + rightThrust) *
      FLIGHT.thrustPerWing * thrustMultiplier;
    bird.velocityX += forwardX * thrust;
    bird.velocityY += forwardY * thrust;
    // Design mapping: left wing -> right shove, right wing -> left shove.
    const asymmetry = leftLift - rightLift;
    const sideways = asymmetry * FLIGHT.lateralImpulsePerWing;
    bird.velocityX += rightX * sideways;
    bird.velocityY += rightY * sideways;
    bird.rollRate += asymmetry * FLIGHT.rollImpulse;
  }

  if (total > 0) {
    // Braking relative to the air mass; mostly the up/recovery stage.
    const brakeFactor = Math.max(0.55, 1 - brakeImpulse * 0.18);
    bird.velocityX = wind.x + (bird.velocityX - wind.x) * brakeFactor;
    bird.velocityY = wind.y + (bird.velocityY - wind.y) * brakeFactor;
  }

  // 6. Roll, bank and heading are distinct physical/gameplay states.
  const heldAsymmetry = leftArea - rightArea;
  const rollAcceleration =
    -FLIGHT.rollRestoring * bird.bank -
    FLIGHT.rollDamping * bird.rollRate +
    heldAsymmetry * FLIGHT.heldRollTorque * controlAuthority;
  bird.rollRate += rollAcceleration * dt;
  bird.bank = clamp(
    bird.bank + bird.rollRate * dt, -FLIGHT.maxBank, FLIGHT.maxBank
  );
  if (Math.abs(bird.bank) >= FLIGHT.maxBank &&
      bird.rollRate * bird.bank > 0) bird.rollRate = 0;
  bird.roll = bird.bank;

  const spreadTarget =
    bird.pitch === 'backward' || bird.flightMode === 'flare' ? 1 :
    bird.pitch === 'forward' ? 0.20 :
    glideSpan > 0.65 ? 0.52 : 0.35;
  bird.tailSpread = ease(bird.tailSpread, spreadTarget, dt, 7);
  bird.tailTwist = ease(
    bird.tailTwist, clamp(bird.bank * 0.55, -0.6, 0.6), dt, 9
  );

  // 7. Banked lift generates sideways *acceleration* at useful airspeed;
  // yaw follows the resulting curved velocity, rather than flap input itself.
  let airX = bird.velocityX - wind.x;
  let airY = bird.velocityY - wind.y;
  let airspeed = Math.hypot(airX, airY);
  const airflowFactor = clamp(airspeed / 68, 0, 1);
  const sideAcceleration = (
    FLIGHT.lateralAcceleration * Math.sin(bird.bank) +
    8 * bird.tailTwist
  ) * airflowFactor * turningSpan;
  const sideX = airspeed > 2 ? -airY / airspeed : rightX;
  const sideY = airspeed > 2 ? airX / airspeed : rightY;
  bird.velocityX += sideX * sideAcceleration * dt;
  bird.velocityY += sideY * sideAcceleration * dt;
  const desiredYawRate = sideAcceleration / Math.max(35, airspeed);
  bird.yawRate = ease(bird.yawRate, desiredYawRate, dt, FLIGHT.yawResponse);
  bird.heading += bird.yawRate * dt;

  // 8. Dive: a modest capped speed assist ONLY while descending.
  // Because horizontal and vertical units differ, this is game-tuned,
  // not claimed to conserve SI energy exactly.
  if (bird.pitch === 'forward' && bird.velocityZ < 0) {
    const assist = FLIGHT.diveExchange * clamp(-bird.velocityZ / 8, 0, 1);
    bird.velocityX += Math.sin(bird.heading) * assist * dt;
    bird.velocityY -= Math.cos(bird.heading) * assist * dt;
  }

  // 9. Drag scales with deployed wing area; tucked wings have less drag.
  const raisedArea =
    (bird.leftWing === 'raised' ? leftArea : 0) +
    (bird.rightWing === 'raised' ? rightArea : 0);
  const drag = FLIGHT.horizontalDrag +
    0.24 * averageArea +
    0.65 * raisedArea +
    (bird.pitch === 'backward' ? 0.62 : 0) +
    bird.tailSpread * 0.11;
  const dragFactor = Math.exp(-drag * dt);
  bird.velocityX = wind.x + (bird.velocityX - wind.x) * dragFactor;
  bird.velocityY = wind.y + (bird.velocityY - wind.y) * dragFactor;
  const speed = Math.hypot(bird.velocityX, bird.velocityY);
  if (speed > FLIGHT.maxSpeed) {
    const scale = FLIGHT.maxSpeed / speed;
    bird.velocityX *= scale;
    bird.velocityY *= scale;
  }

  // 10. Gliding is continuous aerodynamic lift from OPEN wings at speed.
  airX = bird.velocityX - wind.x;
  airY = bird.velocityY - wind.y;
  airspeed = Math.hypot(airX, airY);
  bird.airspeed = airspeed;
  const glideFraction = clamp(
    (airspeed - FLIGHT.stallSpeed) / 40, 0, 1
  );
  const pitchLift =
    bird.pitch === 'backward' ? 1.12 :
    bird.pitch === 'forward' ? 0.55 : 1;
  // No sustained level flight without wingbeats (or a real updraft).
  const liftLimit = FLIGHT.gravity * 0.90;
  const glideLift = Math.min(
    liftLimit,
    FLIGHT.glidingLift * glideFraction * pitchLift *
      glideSpan * Math.max(0, Math.cos(bird.bank))
  );
  const updraft = (wind.up || 0) * averageArea;
  bird.aeroSpan = glideSpan;
  bird.aeroLift = glideLift;
  bird.aeroState = glideSpan < 0.08 ? 'TUCKED' :
    airspeed < FLIGHT.stallSpeed ? 'STALL' :
    glideSpan > 0.8 ? 'GLIDE' : 'PARTIAL';

  bird.velocityZ += (glideLift + updraft - FLIGHT.gravity) * dt;
  // Higher vertical drag with more deployed wing surface.
  const verticalDrag = FLIGHT.verticalDrag * (1 + 0.8 * averageArea);
  bird.velocityZ *= Math.exp(-verticalDrag * dt);
  bird.velocityZ = clamp(bird.velocityZ, -FLIGHT.maxFall, FLIGHT.maxRise);

  // 11. Integrate momentum; only actual ground/branch contact zeros velocity.
  bird.x += bird.velocityX * dt;
  bird.y += bird.velocityY * dt;
  bird.altitude += bird.velocityZ * dt;
  const ceiling = Math.min(
    FLIGHT.maxAltitude, world.maxAltitude ?? FLIGHT.maxAltitude
  );
  if (bird.altitude >= ceiling) {
    bird.altitude = ceiling;
    bird.velocityZ = Math.min(0, bird.velocityZ);
  }
  if (bird.altitude <= 0) {
    bird.altitude = 0;
    bird.velocityZ = bird.velocityX = bird.velocityY = 0;
    bird.grounded = true;
    bird.rollRate = bird.yawRate = bird.bank = bird.roll = 0;
    // A stroke from just before landing must not count toward the next takeoff.
    bird.pendingPowerStrokes.left = null;
    bird.pendingPowerStrokes.right = null;
  } else {
    bird.grounded = false;
  }
  const x = clamp(bird.x, 12, world.width - 12);
  const y = clamp(bird.y, 12, world.height - 12);
  if (x !== bird.x) bird.velocityX = 0;
  if (y !== bird.y) bird.velocityY = 0;
  bird.x = x;
  bird.y = y;
}
