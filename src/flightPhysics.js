
 // Bird Flight v0.9: research-informed 2.5D flight physics.
 // Horizontal positions and speeds use pixels and pixels/s.
 // Altitude and vertical speed use gameplay metres and m/s.
 // Coefficients are game-tuned, not measured Willie Wagtail values.

export const FLIGHT = Object.freeze({
  gravity: 4.5,
  impulsePerWing: 5.4,
  thrustPerWing: 17,

  maxRise: 14,
  maxFall: 9,
  maxSpeed: 165,
  maxAltitude: 40,

  horizontalDrag: 0.38,
  verticalDrag: 0.15,
  forwardAccel: 23,
  glidingLift: 8,
  stallSpeed: 12,

  // Rotational dynamics.
  rollImpulse: 3.8,
  rollRestoring: 9.0,
  rollDamping: 5.4,
  heldRollTorque: 0.95,
  maxBank: 1.02,

  // Bank-generated turning.
  lateralAcceleration: 160,
  yawResponse: 11
});

const clamp = (n, low, high) =>
  Math.max(low, Math.min(high, n));

const ease = (current, target, dt, rate) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export function updateFlightPhysics(bird, dt, world) {

  // 1. Collect and consume wing impulses.
  const left = bird.leftFlapCount || 0;
  const right = bird.rightFlapCount || 0;

  bird.leftFlapCount = 0;
  bird.rightFlapCount = 0;

  const total = left + right;

  const leftLift = bird.leftLiftImpulse || left;
  const rightLift = bird.rightLiftImpulse || right;

  const leftThrust = bird.leftThrustImpulse || left;
  const rightThrust = bird.rightThrustImpulse || right;

  bird.leftLiftImpulse = 0;
  bird.rightLiftImpulse = 0;
  bird.leftThrustImpulse = 0;
  bird.rightThrustImpulse = 0;
  bird.leftBrakeImpulse = 0;
  bird.rightBrakeImpulse = 0;

  if (total > 0) {
    bird.totalFlaps = (bird.totalFlaps || 0) + total;
    bird.flapFeedbackTimer = 0.45;
  }

  // 2. Keep the bird stationary vertically while grounded.
  if (bird.grounded && !bird.perchedOn && !total) {
    bird.altitude = 0;
    bird.velocityX = 0;
    bird.velocityY = 0;
    bird.velocityZ = 0;

    bird.rollRate = 0;
    bird.yawRate = 0;
    bird.bank = 0;
    bird.roll = 0;

    bird.x = clamp(bird.x, 12, world.width - 12);
    bird.y = clamp(bird.y, 12, world.height - 12);
    return;
  }

  // 3. Initialise any new dynamic state safely.
  bird.rollRate ??= 0;
  bird.yawRate ??= 0;
  bird.bank ??= 0;
  bird.tailSpread ??= 0.35;
  bird.tailTwist ??= 0;

  // Heading zero means facing north (negative world Y).
  const forwardX = Math.sin(bird.heading);
  const forwardY = -Math.cos(bird.heading);

  const rightX = Math.cos(bird.heading);
  const rightY = Math.sin(bird.heading);

  // 4. Sample the three-dimensional wind field.
  const wind = world.windAt?.(
    bird.x,
    bird.y,
    bird.altitude
  ) ?? { x: 0, y: 0, up: 0 };

  // 5. Apply wingbeat forces.
  const asymmetry = leftLift - rightLift;

  if (total > 0) {
    const liftMultiplier =
      bird.pitch === "backward" ? 1.12 :
      bird.pitch === "forward" ? 0.83 : 1;

    const thrustMultiplier =
      bird.pitch === "forward" ? 1.26 :
      bird.pitch === "backward" ? 0.62 : 1;

    // Banking reduces the vertical component of a flap.
    const verticalFactor = Math.max(
      0.68,
      Math.cos(bird.bank)
    );

    bird.velocityZ +=
      (leftLift + rightLift) *
      FLIGHT.impulsePerWing *
      liftMultiplier *
      verticalFactor;

    const thrust =
      (leftThrust + rightThrust) *
      FLIGHT.thrustPerWing *
      thrustMultiplier;

    bird.velocityX += forwardX * thrust;
    bird.velocityY += forwardY * thrust;

    // Unequal wing forces change roll RATE.
    // Right-only -> left bank.
    // Left-only -> right bank.
    bird.rollRate +=
      asymmetry * FLIGHT.rollImpulse;

    bird.grounded = false;
  }

  // 6. Integrate rotational dynamics.
  const heldAsymmetry =
    Number(!!bird.leftHeld) -
    Number(!!bird.rightHeld);

  const rollAcceleration =
    -FLIGHT.rollRestoring * bird.bank -
    FLIGHT.rollDamping * bird.rollRate +
    heldAsymmetry * FLIGHT.heldRollTorque;

  bird.rollRate += rollAcceleration * dt;

  bird.bank = clamp(
    bird.bank + bird.rollRate * dt,
    -FLIGHT.maxBank,
    FLIGHT.maxBank
  );

  // Prevent angular momentum accumulating against the limit.
  if (
    Math.abs(bird.bank) >= FLIGHT.maxBank &&
    bird.rollRate * bird.bank > 0
  ) {
    bird.rollRate = 0;
  }

  bird.roll = bird.bank;

  // 7. Tail spread and automatic tail coordination.
  const spreadTarget =
    bird.pitch === "backward" ||
    bird.flightMode === "flare" ? 1 :
    bird.pitch === "forward" ? 0.20 :
    bird.glide ? 0.52 : 0.35;

  bird.tailSpread = ease(
    bird.tailSpread,
    spreadTarget,
    dt,
    7
  );

  bird.tailTwist = ease(
    bird.tailTwist,
    clamp(bird.bank * 0.55, -0.60, 0.60),
    dt,
    9
  );

  // 8. Determine airspeed relative to wind.
  let airX = bird.velocityX - wind.x;
  let airY = bird.velocityY - wind.y;

  const airspeed = Math.hypot(airX, airY);
  bird.airspeed = airspeed;

  const airflowFactor = clamp(
    airspeed / 68,
    0,
    1.25
  );

  // 9. Redirect lift sideways through banking.
  const bankedSideAcceleration =
    FLIGHT.lateralAcceleration *
    Math.sin(bird.bank) *
    Math.min(1, airflowFactor);

  const tailSideAcceleration =
    8 * bird.tailTwist *
    Math.min(1, airflowFactor);

  const sideAcceleration =
    bankedSideAcceleration + tailSideAcceleration;

  // Perpendicular to the airflow.
  const sideX =
    airspeed > 2 ? -airY / airspeed : rightX;

  const sideY =
    airspeed > 2 ? airX / airspeed : rightY;

  bird.velocityX += sideX * sideAcceleration * dt;
  bird.velocityY += sideY * sideAcceleration * dt;

  // 10. Rotate the bird smoothly toward its curved flight path.
  const desiredYawRate =
    sideAcceleration / Math.max(35, airspeed);

  bird.yawRate = ease(
    bird.yawRate,
    desiredYawRate,
    dt,
    FLIGHT.yawResponse
  );

  bird.heading += bird.yawRate * dt;

  // 11. Forward pitch produces acceleration.
  const newForwardX = Math.sin(bird.heading);
  const newForwardY = -Math.cos(bird.heading);

  if (bird.pitch === "forward") {
    bird.velocityX +=
      newForwardX * FLIGHT.forwardAccel * dt;

    bird.velocityY +=
      newForwardY * FLIGHT.forwardAccel * dt;
  }

  // 12. Drag acts on speed relative to air.
  const drag =
    FLIGHT.horizontalDrag +
    (bird.pitch === "backward" ? 0.62 : 0) +
    (bird.flightMode === "flare" ? 0.75 : 0) +
    bird.tailSpread * 0.11;

  const dragFactor = Math.exp(-drag * dt);

  bird.velocityX =
    wind.x + (bird.velocityX - wind.x) * dragFactor;

  bird.velocityY =
    wind.y + (bird.velocityY - wind.y) * dragFactor;

  const groundSpeed = Math.hypot(
    bird.velocityX,
    bird.velocityY
  );

  if (groundSpeed > FLIGHT.maxSpeed) {
    const ratio = FLIGHT.maxSpeed / groundSpeed;
    bird.velocityX *= ratio;
    bird.velocityY *= ratio;
  }

  // 13. Recalculate airspeed after drag.
  airX = bird.velocityX - wind.x;
  airY = bird.velocityY - wind.y;

  const updatedAirspeed = Math.hypot(airX, airY);
  bird.airspeed = updatedAirspeed;

  // 14. Calculate gliding lift.
  const glideFraction = clamp(
    (updatedAirspeed - FLIGHT.stallSpeed) / 35,
    0,
    1
  );

  const modeLift =
    bird.flightMode === "glide" ? 1 :
    bird.flightMode === "flare" ? 1.12 :
    bird.flightMode === "fast-glide" ? 0.58 : 0.75;

  const pitchLift =
    bird.pitch === "backward" ? 1.28 :
    bird.pitch === "forward" ? 0.55 : 1;

  // Gliding cannot produce endless level flight in still air.
  const liftLimit = FLIGHT.gravity * (
    bird.pitch === "forward" ? 0.54 :
    bird.pitch === "backward" ? 0.985 : 0.90
  );

  const glideLift = bird.glide
    ? Math.min(
        liftLimit,
        FLIGHT.glidingLift *
        glideFraction *
        modeLift *
        pitchLift
      ) * Math.cos(bird.bank)
    : 0;

  const divePenalty =
    bird.pitch === "forward" ? 2.2 : 0;

  // 15. Apply gravity, lift and vertical wind.
  bird.velocityZ += (
    glideLift +
    wind.up -
    FLIGHT.gravity -
    divePenalty
  ) * dt;

  bird.velocityZ *= Math.exp(
    -FLIGHT.verticalDrag * dt
  );

  bird.velocityZ = clamp(
    bird.velocityZ,
    -FLIGHT.maxFall,
    FLIGHT.maxRise
  );

  // 16. Update world position.
  bird.x += bird.velocityX * dt;
  bird.y += bird.velocityY * dt;
  bird.altitude += bird.velocityZ * dt;

  // 17. Temporary altitude ceiling.
  const ceiling = Math.min(
    FLIGHT.maxAltitude,
    world.maxAltitude ?? FLIGHT.maxAltitude
  );

  if (bird.altitude >= ceiling) {
    bird.altitude = ceiling;
    bird.velocityZ = Math.min(0, bird.velocityZ);
  }

  // 18. Ground landing.
  if (bird.altitude <= 0) {
    bird.altitude = 0;
    bird.velocityZ = 0;
    bird.velocityX = 0;
    bird.velocityY = 0;
    bird.grounded = true;

    bird.rollRate = 0;
    bird.yawRate = 0;
    bird.bank = 0;
    bird.roll = 0;
  } else {
    bird.grounded = false;
  }

  // 19. World boundaries.
  const x = clamp(bird.x, 12, world.width - 12);
  const y = clamp(bird.y, 12, world.height - 12);

  if (x !== bird.x) bird.velocityX = 0;
  if (y !== bird.y) bird.velocityY = 0;

  bird.x = x;
  bird.y = y;
}
