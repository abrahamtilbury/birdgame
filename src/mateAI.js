// Lightweight non-player Willie Wagtail behaviour; future milestone: true AI.
export function updateMate(world, dt) {
  const mate = world.mate;
  mate.phase += dt * 8;
  mate.hopAnimation = Math.max(0, (mate.hopAnimation || 0) - dt);
  mate.hopTimer = (mate.hopTimer || 0) - dt;
  if (world.nest.started) {
    const target = world.nest.point;
    const tx = target.x + 17, ty = target.y + 13;
    const dx = tx - mate.x, dy = ty - mate.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 12) {
      const step = Math.min(distance, 58 * dt);
      mate.x += dx / distance * step;
      mate.y += dy / distance * step;
      mate.heading = Math.atan2(dx, -dy);
      mate.altitude += (Math.max(2, target.height) - mate.altitude) * Math.min(1, dt * 1.2);
      mate.grounded = false;
    } else {
      mate.altitude = target.height;
      mate.grounded = false;
      mate.x = tx; mate.y = ty;
    }
    return;
  }
  mate.altitude = 0;
  mate.grounded = true;
  if (mate.hopTimer > 0) return;
  const anchorX = 355, anchorY = 337;
  const t = world.time;
  const targetX = anchorX + 32 * Math.cos(t * 0.65);
  const targetY = anchorY + 29 * Math.sin(t * 0.83);
  const dx = targetX - mate.x, dy = targetY - mate.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 2) {
    mate.x += dx / distance * Math.min(13, distance);
    mate.y += dy / distance * Math.min(13, distance);
    mate.heading = Math.atan2(dx, -dy);
    mate.hopAnimation = 0.18;
  }
  mate.hopTimer = 0.24;
}
