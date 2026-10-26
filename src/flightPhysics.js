// Playable three-axis flight prototype: x/y in pixels, z in gameplay metres.
// Not a real aerodynamics simulation. Wind and aerodynamic forces can be refined later.
export const FLIGHT = Object.freeze({
  gravity: 6.4,
  impulsePerWing: 3.9,
  thrustPerWing: 16,
  turnPerWing: 0.19,
  maxRise: 9.5,
  maxFall: 9,
  maxSpeed: 150,
  horizontalDrag: 0.48,
  verticalDrag: 0.30,
  forwardAccel: 19,
  glidingLift: 5.4,
  stallSpeed: 24
});
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

export function updateFlightPhysics(bird, dt, world) {
  const left = bird.leftFlapCount;
  const right = bird.rightFlapCount;
  bird.leftFlapCount = 0;
  bird.rightFlapCount = 0;
  const total = left + right;
  const airborne = !bird.grounded || bird.altitude > 0 || total > 0 || bird.perchedOn;
  if (!airborne) {
    bird.velocityX = bird.velocityY = bird.velocityZ = 0;
    bird.altitude = 0;
    bird.x = clamp(bird.x, 12, world.width - 12);
    bird.y = clamp(bird.y, 12, world.height - 12);
    return;
  }

  if (total) {
    const lift = bird.pitch === "backward" ? 1.15 : bird.pitch === "forward" ? 0.82 : 1;
    const thrust = bird.pitch === "forward" ? 1.25 : bird.pitch === "backward" ? 0.55 : 1;
    bird.velocityZ += total * FLIGHT.impulsePerWing * lift;
    bird.heading += (left - right) * FLIGHT.turnPerWing;
    bird.roll += (left - right) * 0.18;
    bird.velocityX += Math.sin(bird.heading) * FLIGHT.thrustPerWing * total * thrust;
    bird.velocityY -= Math.cos(bird.heading) * FLIGHT.thrustPerWing * total * thrust;
  }

  const speed = Math.hypot(bird.velocityX, bird.velocityY);
  const damping = FLIGHT.horizontalDrag + (bird.pitch === "backward" ? 0.7 : 0);
  const wind = world.windAt ? world.windAt(bird.x, bird.y, bird.altitude) : { x: 0, y: 0, up: 0 };
  bird.velocityX += wind.x * dt;
  bird.velocityY += wind.y * dt;

  if (bird.pitch === "forward") {
    bird.velocityX += Math.sin(bird.heading) * FLIGHT.forwardAccel * dt;
    bird.velocityY -= Math.cos(bird.heading) * FLIGHT.forwardAccel * dt;
  }
  const dragFactor = Math.exp(-damping * dt);
  bird.velocityX *= dragFactor;
  bird.velocityY *= dragFactor;

  const horizontalSpeed = Math.hypot(bird.velocityX, bird.velocityY);
  if (horizontalSpeed > FLIGHT.maxSpeed) {
    bird.velocityX *= FLIGHT.maxSpeed / horizontalSpeed;
    bird.velocityY *= FLIGHT.maxSpeed / horizontalSpeed;
  }

  // Gliding requires airspeed and wings spread. Holding 4+6 activates it.
  const airflow = Math.hypot(bird.velocityX - wind.x, bird.velocityY - wind.y);
  const liftFraction = clamp((airflow - FLIGHT.stallSpeed) / 85, 0, 1);
  const glideLift = bird.glide ? FLIGHT.glidingLift * liftFraction : 0;
  const pitchPenalty = bird.pitch === "forward" ? 1.2 : 0;
  bird.velocityZ += (glideLift + wind.up - FLIGHT.gravity - pitchPenalty) * dt;
  bird.velocityZ *= Math.exp(-FLIGHT.verticalDrag * dt);
  bird.velocityZ = clamp(bird.velocityZ, -FLIGHT.maxFall, FLIGHT.maxRise);

  bird.x += bird.velocityX * dt;
  bird.y += bird.velocityY * dt;
  bird.altitude += bird.velocityZ * dt;

  if (bird.altitude <= 0) {
    bird.altitude = 0;
    bird.velocityZ = 0;
    bird.velocityX = 0;
    bird.velocityY = 0;
    bird.grounded = true;
  } else bird.grounded = false;

  const newX = clamp(bird.x, 12, world.width - 12);
  const newY = clamp(bird.y, 12, world.height - 12);
  if (newX !== bird.x) bird.velocityX = 0;
  if (newY !== bird.y) bird.velocityY = 0;
  bird.x = newX; bird.y = newY;
  bird.roll *= Math.exp(-3.5 * dt);
}
