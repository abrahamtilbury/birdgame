
 // Prototype flight physics
 // Horizontal distance: pixels
 // Altitude: gameplay metres

const GRAVITY = 4.0;
const FLAP_LIFT = 2.5;
const FLAP_THRUST = 18;
const WING_TURN = 0.075;

const HORIZONTAL_DRAG = 0.8;
const VERTICAL_DRAG = 0.4;

const FORWARD_DIVE_ACCELERATION = 15;
const BACKWARD_BRAKE = 1.2;

const MAX_HORIZONTAL_SPEED = 140;
const MAX_RISE_SPEED = 8;
const MAX_FALL_SPEED = 10;

// Recognise a complete raised -> middle -> lowered stroke
function completedDownstroke(bird, side) {
  const position = bird[`${side}Wing`];
  const previousKey = `${side}PreviousWing`;
  const phaseKey = `${side}StrokePhase`;

  // Holding the same wing position produces no new flap
  if (position === bird[previousKey]) return false;

  bird[previousKey] = position;

  if (position === "raised") {
    bird[phaseKey] = 1;

  } else if (position === "middle") {
    bird[phaseKey] = bird[phaseKey] === 1 ? 2 : 0;

  } else if (position === "lowered") {
    const complete = bird[phaseKey] === 2;
    bird[phaseKey] = 0;
    return complete;
  }

  return false;
}

// Update position, velocity, altitude and heading
export function updateFlightPhysics(bird, deltaTime, world) {
  const leftFlap = completedDownstroke(bird, "left");
  const rightFlap = completedDownstroke(bird, "right");

  const flaps = Number(leftFlap) + Number(rightFlap);

  // Apply lift and forward thrust on completed strokes
  if (flaps > 0) {
    const liftMultiplier =
      bird.pitch === "backward" ? 1.1 :
      bird.pitch === "forward" ? 0.85 : 1;

    const thrustMultiplier =
      bird.pitch === "forward" ? 1.4 :
      bird.pitch === "backward" ? 0.6 : 1;

    bird.velocityZ += FLAP_LIFT * liftMultiplier * flaps;

    // Left-wing stroke turns right; right-wing stroke turns left
    bird.heading += WING_TURN *
      (Number(leftFlap) - Number(rightFlap));

    bird.roll += 0.12 *
      (Number(leftFlap) - Number(rightFlap));

    const thrust = FLAP_THRUST * thrustMultiplier * flaps;

    bird.velocityX += Math.sin(bird.heading) * thrust;
    bird.velocityY -= Math.cos(bird.heading) * thrust;
  }

  const airborne = bird.altitude > 0 || bird.velocityZ > 0;

  // Leaning forward during flight gains speed while diving
  if (airborne && bird.pitch === "forward") {
    bird.velocityX +=
      Math.sin(bird.heading) *
      FORWARD_DIVE_ACCELERATION * deltaTime;

    bird.velocityY -=
      Math.cos(bird.heading) *
      FORWARD_DIVE_ACCELERATION * deltaTime;

    bird.velocityZ -= 0.8 * deltaTime;
  }

  // Horizontal aerodynamic drag
  const braking =
    bird.pitch === "backward" ? BACKWARD_BRAKE : 0;

  const damping = Math.exp(
    -(HORIZONTAL_DRAG + braking) * deltaTime
  );

  bird.velocityX *= damping;
  bird.velocityY *= damping;

  // Limit horizontal speed
  const speed = Math.hypot(
    bird.velocityX,
    bird.velocityY
  );

  if (speed > MAX_HORIZONTAL_SPEED) {
    const factor = MAX_HORIZONTAL_SPEED / speed;
    bird.velocityX *= factor;
    bird.velocityY *= factor;
  }

  // Gravity and vertical drag
  bird.velocityZ -= GRAVITY * deltaTime;

  bird.velocityZ *= Math.exp(
    -VERTICAL_DRAG * deltaTime
  );

  bird.velocityZ = Math.max(
    -MAX_FALL_SPEED,
    Math.min(MAX_RISE_SPEED, bird.velocityZ)
  );

  // Update world position
  bird.x += bird.velocityX * deltaTime;
  bird.y += bird.velocityY * deltaTime;
  bird.altitude += bird.velocityZ * deltaTime;

  // Ground collision
  if (bird.altitude <= 0) {
    bird.altitude = 0;

    if (bird.velocityZ < 0) {
      bird.velocityZ = 0;
    }

    bird.grounded = true;
  } else {
    bird.grounded = false;
  }

  // Keep the bird inside the world boundaries
  if (world) {
    const x = Math.max(0, Math.min(world.width, bird.x));
    const y = Math.max(0, Math.min(world.height, bird.y));

    if (x !== bird.x) bird.velocityX = 0;
    if (y !== bird.y) bird.velocityY = 0;

    bird.x = x;
    bird.y = y;
  }

  // Gradually return from a banking movement
  bird.roll *= Math.exp(-4 * deltaTime);
}
