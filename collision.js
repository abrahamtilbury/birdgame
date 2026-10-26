
 // Bird Flight: collision and perching for the current tree-based world.
 // World x/y and branch widths are in pixels; altitude is in gameplay metres.

const BODY_RADIUS = 12;
const PERCH_MARGIN = 4;
const BRANCH_VERTICAL_TOLERANCE = 0.3;
const TAKEOFF_SPEED = 0.15;
const EPSILON = 0.01;

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function trunkRadiusAt(tree, altitude) {
  const { baseRadius, topRadius, height } = tree.trunk;
  if (altitude > height) return 0;
  const portion = clamp(altitude / height, 0, 1);
  return baseRadius + (topRadius - baseRadius) * portion;
}

function nearestPointOnBranch(tree, branch, x, y) {
  const x1 = tree.x + branch.x1;
  const y1 = tree.y + branch.y1;
  const dx = branch.x2 - branch.x1;
  const dy = branch.y2 - branch.y1;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared > 0
    ? clamp(((x - x1) * dx + (y - y1) * dy) / lengthSquared, 0, 1)
    : 0;

  return {
    x: x1 + fraction * dx,
    y: y1 + fraction * dy,
    distance: Math.hypot(x - (x1 + fraction * dx), y - (y1 + fraction * dy)),
    fraction
  };
}

function stopInwardVelocity(bird, nx, ny) {
  const inwardSpeed = bird.velocityX * nx + bird.velocityY * ny;
  if (inwardSpeed < 0) {
    bird.velocityX -= inwardSpeed * nx;
    bird.velocityY -= inwardSpeed * ny;
  }
}

// Find a solid trunk hit along the travelled horizontal segment.
// This prevents a fast bird from passing straight through a trunk.
function findSweptTrunkHit(bird, world, previous) {
  const dx = bird.x - previous.x;
  const dy = bird.y - previous.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;

  let firstHit = null;
  for (const tree of world.trees) {
    const trunkRadius = trunkRadiusAt(tree, bird.altitude);
    if (trunkRadius === 0) continue;

    const radius = trunkRadius + BODY_RADIUS;
    const fx = previous.x - tree.x;
    const fy = previous.y - tree.y;
    const c = fx * fx + fy * fy - radius * radius;
    if (c <= 0) continue; // Already inside: handled by overlap resolution.

    const b = 2 * (fx * dx + fy * dy);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) continue;

    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (t < 0 || t > 1) continue;
    if (!firstHit || t < firstHit.t) firstHit = { tree, t, radius };
  }
  return firstHit;
}

function resolveTrunkCollisions(bird, world, previous) {
  const hit = findSweptTrunkHit(bird, world, previous);
  if (hit) {
    const travelX = bird.x - previous.x;
    const travelY = bird.y - previous.y;
    const impactX = previous.x + travelX * hit.t;
    const impactY = previous.y + travelY * hit.t;
    const angle = Math.atan2(impactY - hit.tree.y, impactX - hit.tree.x);
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    bird.x = hit.tree.x + nx * (hit.radius + EPSILON);
    bird.y = hit.tree.y + ny * (hit.radius + EPSILON);
    stopInwardVelocity(bird, nx, ny);
  }

  // Resolve overlaps (including spawning inside a trunk).
  for (const tree of world.trees) {
    const trunkRadius = trunkRadiusAt(tree, bird.altitude);
    if (trunkRadius === 0) continue;

    const minDistance = trunkRadius + BODY_RADIUS;
    const dx = bird.x - tree.x;
    const dy = bird.y - tree.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= minDistance) continue;

    const nx = distance > 0 ? dx / distance : 1;
    const ny = distance > 0 ? dy / distance : 0;
    bird.x = tree.x + nx * (minDistance + EPSILON);
    bird.y = tree.y + ny * (minDistance + EPSILON);
    stopInwardVelocity(bird, nx, ny);
  }
}

// Land only while crossing a branch's altitude from above.
function findLanding(bird, world, previous) {
  if (bird.velocityZ > 0 || previous.altitude <= bird.altitude) return null;

  let bestLanding = null;
  for (const tree of world.trees) {
    for (const branch of tree.branches) {
      if (!branch.perchable) continue;
      if (previous.altitude < branch.height || bird.altitude > branch.height) continue;

      const fraction = (previous.altitude - branch.height) /
        (previous.altitude - bird.altitude);
      const contactX = previous.x + (bird.x - previous.x) * fraction;
      const contactY = previous.y + (bird.y - previous.y) * fraction;
      const point = nearestPointOnBranch(tree, branch, contactX, contactY);

      if (point.distance > branch.width / 2 + PERCH_MARGIN) continue;

      // The inner portion of the branch is occupied by the trunk.
      const distanceFromTrunk = Math.hypot(point.x - tree.x, point.y - tree.y);
      if (distanceFromTrunk < trunkRadiusAt(tree, branch.height) + BODY_RADIUS) continue;

      if (!bestLanding || branch.height > bestLanding.height) {
        bestLanding = {
          treeId: tree.id,
          branchId: branch.id,
          x: point.x,
          y: point.y,
          height: branch.height
        };
      }
    }
  }
  return bestLanding;
}

// Solid branches can obstruct lateral flight at the same altitude.
function resolveBranchCollisions(bird, world) {
  if (bird.velocityZ > TAKEOFF_SPEED) return; // Ascending birds can pass over branches.

  for (const tree of world.trees) {
    for (const branch of tree.branches) {
      if (Math.abs(bird.altitude - branch.height) > BRANCH_VERTICAL_TOLERANCE) {
        continue;
      }

      const point = nearestPointOnBranch(tree, branch, bird.x, bird.y);
      const minDistance = BODY_RADIUS + branch.width / 2;
      if (point.distance >= minDistance) continue;

      const dx = bird.x - point.x;
      const dy = bird.y - point.y;
      const nx = point.distance > 0 ? dx / point.distance : 1;
      const ny = point.distance > 0 ? dy / point.distance : 0;
      bird.x = point.x + nx * (minDistance + EPSILON);
      bird.y = point.y + ny * (minDistance + EPSILON);
      stopInwardVelocity(bird, nx, ny);
    }
  }
}

function setPerched(bird, perch) {
  bird.perchedOn = perch;
  bird.x = perch.x;
  bird.y = perch.y;
  bird.altitude = perch.height;
  bird.velocityX = 0;
  bird.velocityY = 0;
  bird.velocityZ = 0;
  bird.grounded = false;
}

// Call once per fixed physics step, AFTER updateFlightPhysics().
// previous is { x, y, altitude } captured BEFORE that physics step.
export function resolveCollisions(bird, world, previous) {
  if (bird.perchedOn) {
    if (bird.velocityZ > TAKEOFF_SPEED) {
      bird.perchedOn = null; // A completed wing stroke launches from the perch.
    } else {
      setPerched(bird, bird.perchedOn);
      return;
    }
  }

  const landing = findLanding(bird, world, previous);
  if (landing) {
    setPerched(bird, landing);
    return;
  }

  resolveTrunkCollisions(bird, world, previous);
  resolveBranchCollisions(bird, world);
}
