// 2.5D collision and branch perching. x/y: pixels; z: gameplay metres.
const BODY_RADIUS = 11;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function trunkRadiusAt(tree, z) {
  if (z >= tree.trunk.height) return 0;
  return tree.trunk.baseRadius + (tree.trunk.topRadius - tree.trunk.baseRadius) *
    clamp(z / tree.trunk.height, 0, 1);
}

function closestPoint(tree, branch, x, y) {
  const ax = tree.x + branch.x1, ay = tree.y + branch.y1;
  const dx = branch.x2 - branch.x1, dy = branch.y2 - branch.y1;
  const len = dx * dx + dy * dy;
  const t = len > 0 ? clamp(((x - ax) * dx + (y - ay) * dy) / len, 0, 1) : 0;
  const px = ax + dx * t, py = ay + dy * t;
  return { x: px, y: py, distance: Math.hypot(x - px, y - py) };
}

function perch(bird, tree, branch, point) {
  bird.perchedOn = { treeId: tree.id, branchId: branch.id, perchId: point.id,
    x: point.x, y: point.y, height: branch.height };
  bird.x = point.x; bird.y = point.y; bird.altitude = branch.height;
  bird.velocityX = bird.velocityY = bird.velocityZ = 0;
  bird.grounded = false;
}

// Space (or F) gives a forgiving branch grab, but only near a real perch.
// The vertical and horizontal ranges are deliberate gameplay tolerances.
export const GRAB_HORIZONTAL_REACH = 56;
export const GRAB_VERTICAL_REACH = 3.0;
export function findNearbyPerch(bird, world, horizontal = GRAB_HORIZONTAL_REACH,
    vertical = GRAB_VERTICAL_REACH) {
  if (bird.grounded || bird.perchedOn) return null;
  let best = null;
  for (const tree of world.trees) for (const branch of tree.branches) {
    if (!branch.perchable) continue;
    const dz = Math.abs(bird.altitude - branch.height);
    if (dz > vertical) continue;
    for (const point of branch.perchPoints) {
      const distance = Math.hypot(bird.x - point.x, bird.y - point.y);
      if (distance > horizontal) continue;
      const score = distance + dz * 13;
      if (!best || score < best.score) {
        best = { tree, branch, point, distance, dz, score };
      }
    }
  }
  return best;
}
export function tryPerch(bird, world) {
  const candidate = findNearbyPerch(bird, world);
  if (!candidate) return false;
  perch(bird, candidate.tree, candidate.branch, candidate.point);
  return true;
}

function resolveTrunks(bird, world, previous) {
  for (const tree of world.trees) {
    const radius = trunkRadiusAt(tree, bird.altitude) + BODY_RADIUS;
    if (radius <= BODY_RADIUS) continue;
    // Closest point on movement segment: catches high-speed tunnelling.
    const dx = bird.x - previous.x, dy = bird.y - previous.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0 ? clamp(
      ((tree.x - previous.x) * dx + (tree.y - previous.y) * dy) / lengthSquared, 0, 1
    ) : 1;
    const closestX = previous.x + t * dx, closestY = previous.y + t * dy;
    if (Math.hypot(closestX - tree.x, closestY - tree.y) >= radius) continue;
    const d = Math.hypot(bird.x - tree.x, bird.y - tree.y);
    // If the movement crossed through the trunk, return to the entry side.
    const previousDistance = Math.hypot(previous.x - tree.x, previous.y - tree.y);
    const referenceX = previousDistance >= radius ? closestX : bird.x;
    const referenceY = previousDistance >= radius ? closestY : bird.y;
    const refDistance = Math.hypot(referenceX - tree.x, referenceY - tree.y);
    const nx = refDistance > 0.0001 ? (referenceX - tree.x) / refDistance : 1;
    const ny = refDistance > 0.0001 ? (referenceY - tree.y) / refDistance : 0;
    if (d < radius || previousDistance >= radius) {
      bird.x = tree.x + nx * (radius + 0.1);
      bird.y = tree.y + ny * (radius + 0.1);
      const inward = bird.velocityX * nx + bird.velocityY * ny;
      if (inward < 0) {
        bird.velocityX -= inward * nx;
        bird.velocityY -= inward * ny;
      }
    }
  }
}

function landingBranch(bird, world, previous) {
  if (bird.velocityZ >= 0 || previous.altitude <= bird.altitude) return false;
  const zStart = previous.altitude, zEnd = bird.altitude;
  for (const tree of world.trees) for (const branch of tree.branches) {
    if (!branch.perchable || zStart < branch.height || zEnd > branch.height) continue;
    const timeFraction = (zStart - branch.height) / (zStart - zEnd);
    const x = previous.x + (bird.x - previous.x) * timeFraction;
    const y = previous.y + (bird.y - previous.y) * timeFraction;
    const closest = closestPoint(tree, branch, x, y);
    if (closest.distance > 12 + branch.width / 2) continue;
    const point = branch.perchPoints.reduce((best, p) =>
      Math.hypot(p.x - x, p.y - y) < Math.hypot(best.x - x, best.y - y) ? p : best,
      branch.perchPoints[0]);
    if (Math.hypot(point.x - x, point.y - y) > 28) continue;
    perch(bird, tree, branch, point);
    return true;
  }
  return false;
}

export function resolveCollisions(bird, world, previous) {
  if (bird.perchedOn) {
    if (bird.velocityZ > 0.2) bird.perchedOn = null;
    else {
      bird.x = bird.perchedOn.x;
      bird.y = bird.perchedOn.y;
      bird.altitude = bird.perchedOn.height;
      bird.velocityX = bird.velocityY = bird.velocityZ = 0;
      bird.grounded = false;
      return;
    }
  }
  if (landingBranch(bird, world, previous)) return;
  resolveTrunks(bird, world, previous);
  // The prototype leaves narrow branch-side collision to the landing system.
}
